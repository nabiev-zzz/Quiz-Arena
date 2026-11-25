import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { createSign, createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { DataSource, MoreThan, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { SubscriptionPayment, PaymentProvider } from './entities/subscription-payment.entity';
import { UserSubscription } from './entities/subscription.entity';
import { User } from '../users/entities/user.entity';
import { SubscriptionsService } from './subscriptions.service';

type ClickPayload = Record<string, string | number | undefined>;
type PaymeParams = Record<string, any>;

@Injectable()
export class SubscriptionPaymentsService {
  constructor(
    @InjectRepository(SubscriptionPayment) private readonly payments: Repository<SubscriptionPayment>,
    @InjectRepository(UserSubscription) private readonly subscriptions: Repository<UserSubscription>,
    private readonly dataSource: DataSource,
    private readonly plansService: SubscriptionsService,
  ) {}

  async createCheckout(userId: string, provider: PaymentProvider, planKey: string) {
    if (!['click', 'payme', 'google_play'].includes(provider)) throw new BadRequestException('To‘lov usuli noto‘g‘ri');
    const plan = this.plansService.plans().find((item) => item.key === planKey);
    if (!plan || !plan.available || !plan.price) throw new BadRequestException('Bu tarif hozircha sotuvda emas');
    if (provider === 'google_play') {
      throw new BadRequestException('Google Play xaridi Android ilovasida boshlanadi. Xarid tokenini serverga yuboring.');
    }
    if (provider === 'click' && (!process.env.CLICK_SERVICE_ID || !process.env.CLICK_MERCHANT_ID || !process.env.CLICK_SECRET_KEY)) {
      throw new BadRequestException('Click merchant sozlamalari hali to‘liq kiritilmagan');
    }
    if (provider === 'payme' && (!process.env.PAYME_MERCHANT_ID || !process.env.PAYME_MERCHANT_KEY)) {
      throw new BadRequestException('Payme merchant sozlamalari hali to‘liq kiritilmagan');
    }

    const payment = this.payments.create({
      userId, planKey, provider, amount: plan.price, currency: 'UZS', status: 'pending',
      providerTransactionId: null, providerOrderId: null, paidAt: null,
      providerPrepareId: null, providerState: null, providerCreatedAt: null,
      providerPerformedAt: null, providerCancelledAt: null, providerCancelReason: null,
      providerPayload: null,
    });
    const saved = await this.payments.save(payment);
    let checkoutUrl: string | null = null;

    if (provider === 'click') {
      const serviceId = process.env.CLICK_SERVICE_ID;
      const merchantId = process.env.CLICK_MERCHANT_ID;
      if (serviceId && merchantId) {
        const url = new URL('https://my.click.uz/services/pay');
        url.searchParams.set('service_id', serviceId);
        url.searchParams.set('merchant_id', merchantId);
        url.searchParams.set('amount', saved.amount.toFixed(2));
        url.searchParams.set('transaction_param', saved.id);
        if (process.env.CLICK_RETURN_URL) url.searchParams.set('return_url', process.env.CLICK_RETURN_URL);
        checkoutUrl = url.toString();
      }
    } else {
      const merchantId = process.env.PAYME_MERCHANT_ID;
      if (merchantId) {
        const account = `m=${merchantId};ac.payment_id=${saved.id};a=${saved.amount * 100}`;
        const encoded = Buffer.from(account, 'utf8').toString('base64');
        checkoutUrl = `${(process.env.PAYME_CHECKOUT_URL || 'https://checkout.paycom.uz').replace(/\/$/, '')}/${encoded}`;
      }
    }
    return { paymentId: saved.id, provider, planKey, amount: saved.amount, currency: saved.currency, checkoutUrl };
  }

  async clickCallback(payload: ClickPayload) {
    const p = payload;
    const response = {
      click_trans_id: Number(p.click_trans_id) || 0,
      merchant_trans_id: String(p.merchant_trans_id ?? ''),
      merchant_prepare_id: Number(p.merchant_prepare_id) || 0,
      merchant_confirm_id: 0,
      error: 0,
      error_note: 'Success',
    };
    const action = Number(p.action);
    const secret = process.env.CLICK_SECRET_KEY;
    const serviceId = process.env.CLICK_SERVICE_ID;
    if (!secret || !serviceId) return { ...response, error: -1, error_note: 'Click is not configured' };
    if (String(p.service_id) !== serviceId || !this.verifyClickSignature(p, secret, action)) {
      return { ...response, error: -1, error_note: 'SIGN CHECK FAILED' };
    }
    if (action !== 0 && action !== 1) return { ...response, error: -3, error_note: 'Action not found' };

    const payment = await this.payments.findOne({ where: { id: String(p.merchant_trans_id), provider: 'click' } });
    if (!payment) return { ...response, error: -5, error_note: 'Payment not found' };
    const amount = Number(p.amount);
    if (!Number.isFinite(amount) || Math.abs(amount - payment.amount) > 0.001) {
      return { ...response, error: -2, error_note: 'Incorrect parameter amount' };
    }

    if (action === 0) {
      if (payment.status === 'paid') return { ...response, error: -4, error_note: 'Already paid' };
      if (payment.status !== 'pending') return { ...response, error: -9, error_note: 'Payment cancelled' };
      const prepareId = await this.dataSource.transaction(async (manager) => {
        const locked = await manager.findOne(SubscriptionPayment, { where: { id: payment.id }, lock: { mode: 'pessimistic_write' } });
        if (!locked || locked.status !== 'pending') throw new ConflictException('Payment is not payable');
        if (locked.providerTransactionId && locked.providerTransactionId !== String(p.click_trans_id)) throw new ConflictException('Payment already has another Click transaction');
        if (locked.providerPrepareId) return Number(locked.providerPrepareId);
        const rows = await manager.query(`SELECT nextval('click_merchant_prepare_seq') AS id`);
        const id = String(rows[0].id);
        locked.providerTransactionId = String(p.click_trans_id);
        locked.providerPrepareId = id;
        locked.providerState = 1;
        locked.providerCreatedAt = new Date();
        await manager.save(locked);
        return Number(id);
      }).catch(() => null);
      if (!prepareId) return { ...response, error: -7, error_note: 'Could not prepare payment' };
      return { ...response, merchant_prepare_id: prepareId };
    }

    if (String(p.merchant_prepare_id) !== String(payment.providerPrepareId ?? '')) {
      return { ...response, error: -6, error_note: 'Prepare transaction not found' };
    }
    if (payment.status === 'paid') return { ...response, merchant_confirm_id: Number(payment.providerPrepareId) || 0 };
    if (Number(p.error) < 0) {
      await this.payments.update({ id: payment.id, status: 'pending' }, {
        status: 'cancelled', providerState: -1, providerCancelledAt: new Date(),
      });
      return { ...response, error: -9, error_note: 'Transaction cancelled' };
    }
    try {
      await this.activatePayment(payment.id, 'click', String(p.click_trans_id));
      return { ...response, merchant_confirm_id: Number(payment.providerPrepareId) || 0 };
    } catch {
      return { ...response, error: -7, error_note: 'Could not complete payment' };
    }
  }

  async paymeCallback(authorization: string | undefined, body: { id?: number; method?: string; params?: PaymeParams }) {
    const id = body?.id ?? null;
    const fail = (code: number, message: string, data?: Record<string, unknown>) => ({
      id, error: { code, message: { uz: message, ru: message, en: message }, ...(data ? { data } : {}) },
    });
    const key = process.env.PAYME_MERCHANT_KEY;
    if (!key || !this.safeEqual(authorization ?? '', `Basic ${Buffer.from(`Paycom:${key}`).toString('base64')}`)) {
      return fail(-32504, 'Недостаточно привилегий');
    }
    const params = body.params ?? {};
    try {
      switch (body.method) {
        case 'CheckPerformTransaction': {
          const payment = await this.findPaymePayment(params.account?.payment_id);
          if (!payment) return fail(-31050, 'Платёж не найден', { account: 'payment_id' });
          if (Number(params.amount) !== payment.amount * 100) return fail(-31001, 'Неверная сумма');
          if (payment.status !== 'pending') return fail(-31008, 'Платёж недоступен');
          return { id, result: { allow: true } };
        }
        case 'CreateTransaction': {
          const payment = await this.findPaymePayment(params.account?.payment_id);
          if (!payment) return fail(-31050, 'Платёж не найден', { account: 'payment_id' });
          if (Number(params.amount) !== payment.amount * 100) return fail(-31001, 'Неверная сумма');
          const txId = String(params.id ?? '');
          if (!/^[a-fA-F0-9]{24}$/.test(txId) || !Number.isSafeInteger(Number(params.time)) || Number(params.time) <= 0) return fail(-32600, 'Неверные параметры');
          if (payment.status === 'paid') return fail(-31008, 'Платёж уже выполнен');
          if (payment.providerTransactionId && payment.providerTransactionId !== txId) return fail(-31008, 'Платёж уже зарезервирован');
          const existing = await this.payments.findOne({ where: { provider: 'payme', providerTransactionId: txId } });
          if (existing && existing.id !== payment.id) return fail(-31008, 'Транзакция уже существует');
          payment.providerTransactionId = txId;
          payment.providerOrderId = payment.id;
          payment.providerState = 1;
          payment.providerCreatedAt = new Date(Number(params.time));
          await this.payments.save(payment);
          return { id, result: { transaction: payment.id, state: 1, create_time: payment.providerCreatedAt.getTime() } };
        }
        case 'PerformTransaction': {
          const payment = await this.findPaymeTransaction(params.id);
          if (!payment) return fail(-31003, 'Транзакция не найдена');
          if (payment.providerState === 2 && payment.providerPerformedAt) {
            return { id, result: { transaction: payment.id, perform_time: payment.providerPerformedAt.getTime(), state: 2 } };
          }
          if (payment.providerState !== 1 || !payment.providerCreatedAt || Date.now() - payment.providerCreatedAt.getTime() > 43_200_000) {
            return fail(-31008, 'Операцияни бажариб бўлмайди');
          }
          await this.activatePayment(payment.id, 'payme', String(params.id));
          const fresh = await this.payments.findOneByOrFail({ id: payment.id });
          return { id, result: { transaction: fresh.id, perform_time: fresh.providerPerformedAt?.getTime() ?? Date.now(), state: 2 } };
        }
        case 'CancelTransaction': {
          const payment = await this.findPaymeTransaction(params.id);
          if (!payment) return fail(-31003, 'Транзакция не найдена');
          const now = new Date();
          if (payment.providerState === -1 || payment.providerState === -2) {
            return { id, result: { transaction: payment.id, cancel_time: payment.providerCancelledAt?.getTime() ?? now.getTime(), state: payment.providerState } };
          }
          if (payment.providerState === 2) {
            await this.dataSource.transaction(async (manager) => {
              await manager.update(SubscriptionPayment, { id: payment.id }, {
                status: 'refunded', providerState: -2, providerCancelledAt: now, providerCancelReason: Number(params.reason) || null,
              });
              await manager.update(UserSubscription, { provider: 'payme', providerReference: String(params.id), status: 'active' }, { status: 'refunded' });
            });
            return { id, result: { transaction: payment.id, cancel_time: now.getTime(), state: -2 } };
          }
          await this.payments.update({ id: payment.id }, {
            status: 'cancelled', providerState: -1, providerCancelledAt: now, providerCancelReason: Number(params.reason) || null,
          });
          return { id, result: { transaction: payment.id, cancel_time: now.getTime(), state: -1 } };
        }
        case 'CheckTransaction': {
          const payment = await this.findPaymeTransaction(params.id);
          if (!payment) return fail(-31003, 'Транзакция не найдена');
          return { id, result: {
            transaction: payment.id,
            create_time: payment.providerCreatedAt?.getTime() ?? 0,
            perform_time: payment.providerPerformedAt?.getTime() ?? 0,
            cancel_time: payment.providerCancelledAt?.getTime() ?? 0,
            state: payment.providerState ?? 1,
            reason: payment.providerCancelReason,
          } };
        }
        case 'GetStatement': {
          const from = Number(params.from), to = Number(params.to);
          if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from < 0 || from > to) return fail(-32600, 'Неверный период');
          const rows = await this.payments.find({
            where: { provider: 'payme', providerCreatedAt: MoreThan(new Date(from - 1)) },
            order: { providerCreatedAt: 'ASC' },
          });
          return { id, result: { transactions: rows.filter((p) => (p.providerCreatedAt?.getTime() ?? 0) <= to).map((p) => ({
            id: p.providerTransactionId, time: p.providerCreatedAt?.getTime() ?? 0,
            amount: p.amount * 100, account: { payment_id: p.id },
            create_time: p.providerCreatedAt?.getTime() ?? 0,
            perform_time: p.providerPerformedAt?.getTime() ?? 0,
            cancel_time: p.providerCancelledAt?.getTime() ?? 0,
            transaction: p.id, state: p.providerState ?? 1, reason: p.providerCancelReason,
          })) } };
        }
        default:
          return fail(-32601, 'Метод не найден');
      }
    } catch {
      return fail(-32400, 'Внутренняя ошибка');
    }
  }

  googlePlayAccountId(userId: string) {
    const secret = process.env.GOOGLE_PLAY_ACCOUNT_ID_SECRET;
    if (!secret) throw new BadRequestException('Google Play account binding is not configured');
    return createHmac('sha256', secret).update(userId).digest('hex').slice(0, 64);
  }

  async verifyGooglePlayPurchase(userId: string, purchaseToken: string) {
    if (!purchaseToken || purchaseToken.length > 2048) throw new BadRequestException('Purchase token noto‘g‘ri');
    const packageName = process.env.GOOGLE_PLAY_PACKAGE_NAME || 'uz.quizarena.app';
    const serviceAccountRaw = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
    if (!serviceAccountRaw) throw new BadRequestException('Google Play server credentials are not configured');
    let account: { client_email: string; private_key: string };
    try { account = JSON.parse(serviceAccountRaw); } catch { throw new BadRequestException('Google Play credentials format is invalid'); }
    const accessToken = await this.googleAccessToken(account);
    const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`;
    const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!response.ok) throw new BadRequestException('Google Play xaridini tekshirib bo‘lmadi');
    const purchase = await response.json() as {
      subscriptionState?: string;
      acknowledgementState?: string;
      startTime?: string;
      latestOrderId?: string;
      lineItems?: Array<{ productId?: string; expiryTime?: string; autoRenewingPlan?: { autoRenewEnabled?: boolean } }>;
      externalAccountIdentifiers?: { obfuscatedExternalAccountId?: string };
    };
    const expectedAccountId = this.googlePlayAccountId(userId);
    if (purchase.externalAccountIdentifiers?.obfuscatedExternalAccountId !== expectedAccountId) {
      throw new UnauthorizedException('Google Play xaridi ushbu QUIZ ARENA akkauntiga bog‘lanmagan');
    }
    const item = purchase.lineItems?.[0];
    const productId = item?.productId;
    const googleProducts: Array<{ env: string; planKey: string }> = [
      { env: 'GOOGLE_PLAY_MONTHLY_PRODUCT_ID', planKey: 'premium_monthly' },
      { env: 'GOOGLE_PLAY_YEARLY_PRODUCT_ID', planKey: 'premium_yearly' },
      { env: 'GOOGLE_PLAY_PREMIUM_PRO_MONTHLY_PRODUCT_ID', planKey: 'premium_pro_monthly' },
      { env: 'GOOGLE_PLAY_PREMIUM_PRO_YEARLY_PRODUCT_ID', planKey: 'premium_pro_yearly' },
      { env: 'GOOGLE_PLAY_LEGENDA_PLUS_MONTHLY_PRODUCT_ID', planKey: 'legenda_plus_monthly' },
      { env: 'GOOGLE_PLAY_LEGENDA_PLUS_YEARLY_PRODUCT_ID', planKey: 'legenda_plus_yearly' },
    ];
    const planKey = googleProducts.find((item) => Boolean(process.env[item.env]) && process.env[item.env] === productId)?.planKey ?? null;
    if (!planKey || !productId || !item?.expiryTime) throw new BadRequestException('Google Play mahsuloti tan olinmadi');
    if (!['SUBSCRIPTION_STATE_ACTIVE', 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD', 'SUBSCRIPTION_STATE_CANCELED'].includes(purchase.subscriptionState ?? '')) {
      throw new BadRequestException('Google Play obunasi faol emas');
    }
    const expiry = new Date(item.expiryTime);
    if (!Number.isFinite(expiry.getTime()) || expiry.getTime() <= Date.now()) throw new BadRequestException('Google Play obunasi muddati tugagan');
    const price = this.plansService.plans().find((p) => p.key === planKey)?.price;
    if (!price) throw new BadRequestException('Premium tarif narxi sozlanmagan');

    let payment = await this.payments.findOne({ where: { provider: 'google_play', providerTransactionId: purchaseToken } });
    if (payment && payment.userId !== userId) throw new UnauthorizedException('Purchase token boshqa akkauntga tegishli');
    if (!payment) {
      payment = this.payments.create({
        userId, planKey, provider: 'google_play', amount: price, currency: 'UZS', status: 'pending',
        providerTransactionId: purchaseToken, providerOrderId: purchase.latestOrderId ?? null, paidAt: null,
        providerPrepareId: null, providerState: null, providerCreatedAt: null,
        providerPerformedAt: null, providerCancelledAt: null, providerCancelReason: null, providerPayload: null,
      });
      payment = await this.payments.save(payment);
    }
    await this.activatePayment(payment.id, 'google_play', purchaseToken, expiry, item.autoRenewingPlan?.autoRenewEnabled ?? false, purchase.startTime ? new Date(purchase.startTime) : undefined);
    if (purchase.acknowledgementState !== 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED') {
      const ackUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`;
      const ack = await fetch(ackUrl, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: '{}' });
      if (!ack.ok) throw new BadRequestException('Google Play xaridi tasdiqlanmadi; keyinroq qayta urinib ko‘ring');
    }
    return { isPremium: true, expiresAt: expiry, provider: 'google_play' };
  }

  async handleGooglePlayNotification(authorization: string | undefined, body: { message?: { data?: string }; subscription?: string }) {
    const bearer = authorization?.match(/^Bearer\\s+(.+)$/i)?.[1];
    const audience = process.env.GOOGLE_PUBSUB_AUDIENCE;
    const serviceEmail = process.env.GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL;
    if (!bearer || !audience || !serviceEmail) throw new UnauthorizedException('Google Pub/Sub push is not configured');
    const tokenInfoResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(bearer)}`);
    if (!tokenInfoResponse.ok) throw new UnauthorizedException('Invalid Pub/Sub identity token');
    const tokenInfo = await tokenInfoResponse.json() as { aud?: string; email?: string; email_verified?: boolean };
    if (tokenInfo.aud !== audience || tokenInfo.email !== serviceEmail || tokenInfo.email_verified !== true) {
      throw new UnauthorizedException('Pub/Sub identity does not match');
    }
    if (!body.message?.data) return { received: true };
    let notification: { subscriptionNotification?: { purchaseToken?: string; notificationType?: number }; testNotification?: unknown };
    try { notification = JSON.parse(Buffer.from(body.message.data, 'base64').toString('utf8')); }
    catch { throw new BadRequestException('Invalid Pub/Sub message data'); }
    const event = notification.subscriptionNotification;
    if (!event?.purchaseToken) return { received: true, ignored: true };
    const payment = await this.payments.findOne({
      where: { provider: 'google_play', providerTransactionId: event.purchaseToken },
    });
    if (!payment) return { received: true, ignored: true };
    const type = Number(event.notificationType);
    if (type === 12 || type === 13 || type === 5 || type === 10) {
      const nextStatus = type === 12 ? 'refunded' : type === 13 ? 'expired' : 'cancelled';
      await this.subscriptions.update(
        { provider: 'google_play', providerReference: event.purchaseToken, status: 'active' },
        { status: nextStatus },
      );
      if (type === 12) await this.payments.update({ id: payment.id }, { status: 'refunded', providerState: -2, providerCancelledAt: new Date() });
      return { received: true, updated: true };
    }
    if (!payment.userId) return { received: true, ignored: true };
    try {
      await this.verifyGooglePlayPurchase(payment.userId, event.purchaseToken);
    } catch {
      // Google Play remains the source of truth; an expired or revoked token never gains access.
      await this.subscriptions.update(
        { provider: 'google_play', providerReference: event.purchaseToken, status: 'active' },
        { status: 'expired' },
      );
    }
    return { received: true, updated: true };
  }

  private async googleAccessToken(account: { client_email: string; private_key: string }) {
    if (!account.client_email || !account.private_key) throw new BadRequestException('Google Play service account is incomplete');
    const now = Math.floor(Date.now() / 1000);
    const enc = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const unsigned = `${enc({ alg: 'RS256', typ: 'JWT' })}.${enc({
      iss: account.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher',
      aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
    })}`;
    const signer = createSign('RSA-SHA256');
    signer.update(unsigned); signer.end();
    const assertion = `${unsigned}.${signer.sign(account.private_key.replace(/\\n/g, '\n'), 'base64url')}`;
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    });
    if (!response.ok) throw new BadRequestException('Google Play authorization failed');
    const data = await response.json() as { access_token?: string };
    if (!data.access_token) throw new BadRequestException('Google Play access token missing');
    return data.access_token;
  }

  private async activatePayment(paymentId: string, provider: PaymentProvider, reference: string, exactExpiry?: Date, autoRenew = false, exactStart?: Date) {
    await this.dataSource.transaction(async (manager) => {
      const payment = await manager.findOne(SubscriptionPayment, { where: { id: paymentId }, lock: { mode: 'pessimistic_write' } });
      if (!payment) throw new BadRequestException('Payment not found');
      if (payment.provider !== provider || (payment.providerTransactionId && payment.providerTransactionId !== reference)) {
        throw new ConflictException('Payment provider reference mismatch');
      }
      if (!payment.userId) throw new BadRequestException('Payment account has been deleted');
      const user = await manager.findOne(User, { where: { id: payment.userId }, lock: { mode: 'pessimistic_write' } });
      if (!user) throw new BadRequestException('Subscription owner not found');
      const now = new Date();
      const existing = await manager.findOne(UserSubscription, { where: { provider, providerReference: reference } });
      if (payment.status === 'paid') {
        if (provider === 'google_play' && existing && exactExpiry && exactExpiry > now) {
          if (!existing.expiresAt || exactExpiry > existing.expiresAt) existing.expiresAt = exactExpiry;
          existing.status = 'active';
          existing.autoRenew = autoRenew;
          await manager.save(existing);
          payment.providerPerformedAt = now;
          await manager.save(payment);
        }
        return;
      }
      const active = await manager.findOne(UserSubscription, {
        where: { userId: payment.userId, status: 'active', expiresAt: MoreThan(now) },
        order: { expiresAt: 'DESC' },
        lock: { mode: 'pessimistic_write' },
      });
      const planDays = payment.planKey === 'premium_yearly' ? 365 : 30;
      const startsAt = exactStart ?? (active?.expiresAt && active.expiresAt > now ? active.expiresAt : now);
      const expiresAt = exactExpiry ?? new Date(startsAt.getTime() + planDays * 86_400_000);
      if (active && active.id !== existing?.id) {
        await manager.update(UserSubscription, { id: active.id }, { status: 'expired', expiresAt: now });
      }
      payment.status = 'paid';
      payment.paidAt = now;
      payment.providerState = 2;
      payment.providerPerformedAt = now;
      await manager.save(payment);
      if (existing) {
        existing.status = 'active'; existing.startsAt = startsAt; existing.expiresAt = expiresAt;
        existing.autoRenew = autoRenew;
        await manager.save(existing);
      } else {
        await manager.save(manager.create(UserSubscription, {
          userId: payment.userId, planKey: payment.planKey, provider, status: 'active',
          providerReference: reference, startsAt, expiresAt, autoRenew,
        }));
      }
    });
  }

  private async findPaymePayment(id: unknown) {
    if (typeof id !== 'string' || id.length > 64) return null;
    return this.payments.findOne({ where: { id, provider: 'payme' } });
  }

  private async findPaymeTransaction(id: unknown) {
    if (typeof id !== 'string' || id.length > 64) return null;
    return this.payments.findOne({ where: { provider: 'payme', providerTransactionId: id } });
  }

  private verifyClickSignature(p: ClickPayload, secret: string, action: number) {
    const fields = [p.click_trans_id, p.service_id, secret, p.merchant_trans_id];
    if (action === 1) fields.push(p.merchant_prepare_id);
    fields.push(p.amount, p.action, p.sign_time);
    const expected = createHash('md5').update(fields.map((v) => String(v ?? '')).join('')).digest('hex');
    return this.safeEqual(expected.toLowerCase(), String(p.sign_string ?? '').toLowerCase());
  }

  private safeEqual(a: string, b: string) {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    return left.length === right.length && timingSafeEqual(left, right);
  }
}
