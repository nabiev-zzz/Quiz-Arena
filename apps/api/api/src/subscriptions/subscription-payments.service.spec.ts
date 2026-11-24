import { jest } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import { SubscriptionPaymentsService } from './subscription-payments.service';

describe('SubscriptionPaymentsService', () => {
  const originalEnv = { ...process.env };
  const payments = {
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => ({ ...value, id: 'payment-123' })),
    findOne: jest.fn(),
    findOneByOrFail: jest.fn(),
    update: jest.fn(),
  };
  const subscriptions = { findOne: jest.fn(), update: jest.fn() };
  const dataSource = { transaction: jest.fn(), query: jest.fn() };
  const plansService = {
    plans: jest.fn(() => [
      { key: 'premium_monthly', name: 'Premium', durationDays: 30, price: 25000, currency: 'UZS', available: true },
      { key: 'premium_yearly', name: 'Premium', durationDays: 365, price: 250000, currency: 'UZS', available: true },
    ]),
  };
  let service: SubscriptionPaymentsService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.CLICK_SERVICE_ID;
    delete process.env.CLICK_MERCHANT_ID;
    delete process.env.CLICK_SECRET_KEY;
    delete process.env.PAYME_MERCHANT_ID;
    delete process.env.PAYME_MERCHANT_KEY;
    service = new SubscriptionPaymentsService(
      payments as never,
      subscriptions as never,
      dataSource as never,
      plansService as never,
    );
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('does not create a Click order until merchant credentials are configured', async () => {
    await expect(service.createCheckout('user-1', 'click', 'premium_monthly'))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(payments.create).not.toHaveBeenCalled();
  });

  it('rejects Click callbacks with an invalid signature before reading or changing an order', async () => {
    process.env.CLICK_SERVICE_ID = 'service-1';
    process.env.CLICK_SECRET_KEY = 'test-secret';

    const result = await service.clickCallback({
      click_trans_id: '123',
      service_id: 'service-1',
      merchant_trans_id: 'payment-123',
      amount: '25000.00',
      action: '0',
      sign_time: '2026-11-24 10:00:00',
      sign_string: 'not-a-valid-signature',
    });

    expect(result.error).toBe(-1);
    expect(payments.findOne).not.toHaveBeenCalled();
    expect(payments.update).not.toHaveBeenCalled();
  });

  it('rejects unauthorized Payme JSON-RPC requests', async () => {
    process.env.PAYME_MERCHANT_KEY = 'test-secret';

    const result = await service.paymeCallback('Basic invalid', {
      id: 7,
      method: 'CheckPerformTransaction',
      params: {},
    });

    expect(result.error?.code).toBe(-32504);
    expect(payments.findOne).not.toHaveBeenCalled();
  });

  it('rejects Payme payments when the amount in tiyin does not match the UZS order', async () => {
    process.env.PAYME_MERCHANT_KEY = 'test-secret';
    payments.findOne.mockResolvedValue({
      id: 'payment-123',
      provider: 'payme',
      amount: 25000,
      status: 'pending',
    });
    const authorization = `Basic ${Buffer.from('Paycom:test-secret').toString('base64')}`;

    const result = await service.paymeCallback(authorization, {
      id: 8,
      method: 'CheckPerformTransaction',
      params: { amount: 25000, account: { payment_id: 'payment-123' } },
    });

    expect(result.error?.code).toBe(-31001);
    expect(payments.save).not.toHaveBeenCalled();
  });
});
