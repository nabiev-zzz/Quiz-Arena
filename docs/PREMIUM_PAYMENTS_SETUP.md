# QUIZ ARENA Premium payments

This branch adds server-side payment processing for Click Shop API, Payme Merchant API, and Google Play subscriptions. Premium access is granted only after a provider callback or Google Play Developer API verification succeeds.

## Railway API variables

Set these in the Railway API service's Variables page. Never commit credentials or send them in chat.

### Shared plans
- `PREMIUM_MONTHLY_PRICE_UZS` / `PREMIUM_YEARLY_PRICE_UZS` — PREMIUM monthly/yearly prices.
- `PREMIUM_PRO_MONTHLY_PRICE_UZS` / `PREMIUM_PRO_YEARLY_PRICE_UZS` — PREMIUM PRO monthly/yearly prices.
- `LEGENDA_PLUS_MONTHLY_PRICE_UZS` / `LEGENDA_PLUS_YEARLY_PRICE_UZS` — LEGENDA+ monthly/yearly prices.
- Every price is a positive integer in UZS. A plan remains unavailable until its price is configured.

Prices are intentionally not hardcoded. The API returns a plan as unavailable until its price is configured.

### Click
- `CLICK_SERVICE_ID`
- `CLICK_MERCHANT_ID`
- `CLICK_SECRET_KEY`
- `CLICK_RETURN_URL` — optional HTTPS return URL for the app/web page.

Register these HTTPS callback URLs in the Click merchant cabinet:
- Prepare: `https://humorous-imagination-production.up.railway.app/api/subscriptions/click`
- Complete: `https://humorous-imagination-production.up.railway.app/api/subscriptions/click`

Click Shop API sends UZS amounts and the backend verifies the MD5 signature before changing payment state.

### Payme
- `PAYME_MERCHANT_ID`
- `PAYME_MERCHANT_KEY`
- `PAYME_CHECKOUT_URL` — optional; defaults to `https://checkout.paycom.uz`.

In the Payme cashbox, configure the account field as `payment_id` and register this HTTPS Merchant API callback URL:
- `https://humorous-imagination-production.up.railway.app/api/subscriptions/payme`

Payme Merchant API sends amounts in tiyin (UZS × 100) and uses JSON-RPC 2.0 with HTTP Basic authentication.

### Google Play
- `GOOGLE_PLAY_PACKAGE_NAME` — defaults to `uz.quizarena.app`.
- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` — complete service-account JSON, stored only as a Railway secret variable.
- `GOOGLE_PLAY_MONTHLY_PRODUCT_ID`
- `GOOGLE_PLAY_YEARLY_PRODUCT_ID`
- `GOOGLE_PLAY_PREMIUM_PRO_MONTHLY_PRODUCT_ID`
- `GOOGLE_PLAY_PREMIUM_PRO_YEARLY_PRODUCT_ID`
- `GOOGLE_PLAY_LEGENDA_PLUS_MONTHLY_PRODUCT_ID`
- `GOOGLE_PLAY_LEGENDA_PLUS_YEARLY_PRODUCT_ID`
- `GOOGLE_PLAY_ACCOUNT_ID_SECRET` — long random secret used to generate a non-reversible per-user Play account binding.
- `GOOGLE_PUBSUB_AUDIENCE` — exact HTTPS audience configured on the Pub/Sub push subscription.
- `GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL` — email of the service account used by authenticated Pub/Sub push.

Set these public product IDs in the Expo build environment:
- `EXPO_PUBLIC_GOOGLE_PLAY_MONTHLY_PRODUCT_ID`
- `EXPO_PUBLIC_GOOGLE_PLAY_YEARLY_PRODUCT_ID`
- `EXPO_PUBLIC_GOOGLE_PLAY_PREMIUM_PRO_MONTHLY_PRODUCT_ID`
- `EXPO_PUBLIC_GOOGLE_PLAY_PREMIUM_PRO_YEARLY_PRODUCT_ID`
- `EXPO_PUBLIC_GOOGLE_PLAY_LEGENDA_PLUS_MONTHLY_PRODUCT_ID`
- `EXPO_PUBLIC_GOOGLE_PLAY_LEGENDA_PLUS_YEARLY_PRODUCT_ID`

The public product IDs must exactly match the IDs in Play Console and the corresponding Railway variables. Grant the Google service account the required Play Console access and enable the Google Play Android Developer API in its Google Cloud project.

Configure Google Play Real-time Developer Notifications (RTDN) to publish subscription events to a Pub/Sub topic, then create an authenticated push subscription targeting `https://humorous-imagination-production.up.railway.app/api/subscriptions/google-play/notifications`. Set the same audience and push service-account email in the two Railway variables above. The endpoint verifies the OIDC identity token with Google before applying lifecycle changes.

The app uses `expo-iap`; Google Play Billing is not available in Expo Go. Build a native Android app and test purchases through a Play Console internal-testing track. The app requests a server-generated obfuscated account ID and attaches it to the Play purchase. The purchase token is sent to the backend, checked with `purchases.subscriptionsv2.get`, matched to that account binding, and acknowledged only after the entitlement is persisted.

## API routes

- `GET /api/subscriptions/plans` — public plan list.
- `GET /api/subscriptions/me` — JWT-protected current entitlement and server-owned feature limits.
- `POST /api/subscriptions/usage/:featureKey` — JWT-protected atomic quota consumption for `statsPdf`, `documentQuiz`, `privateBattle`, or `smartPractice`.
- `GET /api/subscriptions/google-play/account-id` — JWT-protected obfuscated account identifier for the Play Billing purchase request.
- `POST /api/subscriptions/checkout` — JWT-protected Click/Payme order creation. Body: `{ "provider": "click" | "payme", "planKey": "premium_monthly" | "premium_yearly" | "premium_pro_monthly" | "premium_pro_yearly" | "legenda_plus_monthly" | "legenda_plus_yearly" }`.
- `POST /api/subscriptions/google-play/verify` — JWT-protected server verification. Body: `{ "purchaseToken": "..." }`.
- `POST /api/subscriptions/google-play/notifications` — authenticated Google Pub/Sub RTDN push endpoint.
- `POST /api/subscriptions/click` — Click Prepare/Complete callback.
- `POST /api/subscriptions/payme` — Payme Merchant API JSON-RPC callback.

## Before going live

1. Configure test merchant credentials and test product IDs in Railway.
2. Apply the additive TypeORM migrations; they preserve existing payment and subscription records.
3. Configure Click and Payme callback URLs in their merchant dashboards.
4. Create monthly and yearly subscription products/base plans for all three paid tiers in Play Console and add the service account.
5. Run the negative and retry scenarios: wrong signature, wrong amount, unknown payment, duplicate callback, Click cancellation, Payme timeout/cancel, Google pending purchase, expired/refunded token.
6. Make a low-value sandbox/test purchase with each provider and verify the resulting entitlement through `GET /api/subscriptions/me`.

Do not enable production checkout until the merchant accounts, product IDs, callback registration, and sandbox tests are complete.
