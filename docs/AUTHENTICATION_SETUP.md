# QUIZ ARENA authentication setup

Username/password login and Google sign-in remain available. Email verification and email-based password recovery use the existing JWT session format. SMS endpoints are retained for a later rollout but are not used by the current mobile authentication screens.

## Railway API variables

Set these variables on the Railway API service. Do not commit credentials or put them in the mobile app.

| Variable | Purpose |
| --- | --- |
| `RESEND_API_KEY` | Resend API key used by the server to send transactional email |
| `EMAIL_FROM` | Verified sender, for example `QUIZ ARENA <auth@your-domain.uz>` |
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 Web application client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 2.0 Web application client secret |
| `GOOGLE_REDIRECT_URI` | Exact public callback URL: `https://humorous-imagination-production.up.railway.app/api/auth/google/callback` |
| `TELEGRAM_CLIENT_ID` | Telegram Login Client ID provided by @BotFather |
| `TELEGRAM_CLIENT_SECRET` | Telegram Login Client Secret provided by @BotFather; server-only |
| `TELEGRAM_REDIRECT_URI` | Exact public callback URL: `https://humorous-imagination-production.up.railway.app/api/auth/telegram/callback` |

Keep the existing `JWT_SECRET` configured. It is used to sign the existing application sessions and short-lived OAuth state.

## Optional Telegram sign-in

Telegram is an additional sign-in method. Username/password and Google sign-in remain unchanged. Telegram identities are stored in a separate nullable `telegramSubject` field; a Telegram account is never automatically merged with an existing account based only on a matching display name or username.

1. Open @BotFather in Telegram and select or create the bot representing QUIZ ARENA.
2. Open the bot's **Login Widget** settings and register this exact allowed redirect URL:
   `https://humorous-imagination-production.up.railway.app/api/auth/telegram/callback`
3. Copy the Login Widget **Client ID** and **Client Secret** from BotFather.
4. Add them to the Railway API service as `TELEGRAM_CLIENT_ID` and `TELEGRAM_CLIENT_SECRET`.
5. Set `TELEGRAM_REDIRECT_URI` to the exact callback URL above and redeploy the API.

The app opens Telegram's official OpenID Connect authorization page. The backend uses Authorization Code + PKCE, validates the Telegram ID-token RS256 signature against Telegram's published JWKS, checks issuer/audience/expiry/nonce, and exchanges a short-lived single-use code for the normal QUIZ ARENA session. No Telegram bot token or client secret is placed in the mobile app. A new app build is not required solely for this feature because the existing `quizarena://auth` deep-link scheme is reused.

## Eskiz setup

1. Create or sign in to an Eskiz business account and enable the SMS API.
2. Confirm that the account has SMS balance and an approved sender name if one is required.
3. Register and get Eskiz to approve a sender name and an OTP SMS template. The template must contain the literal `{code}` placeholder.
4. Add `ESKIZ_EMAIL`, `ESKIZ_PASSWORD`, `ESKIZ_OTP_TEMPLATE`, and optionally `ESKIZ_FROM` to Railway Variables.
5. The backend requests and caches the Eskiz bearer token server-side. The token and OTP values are never returned to the app or written to logs.

SMS codes expire after five minutes. Each code allows up to five verification attempts. A phone/purpose pair is limited to one new code per 60 seconds and three codes per hour.

## Google OAuth setup

1. In Google Cloud Console, create an OAuth 2.0 Client ID with application type **Web application**.
2. Add this exact authorized redirect URI: `https://humorous-imagination-production.up.railway.app/api/auth/google/callback`.
3. Add the resulting client ID and client secret to Railway Variables as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
4. Set `GOOGLE_REDIRECT_URI` to the same callback URI.
5. Re-deploy the API after setting variables.

Google sign-in uses the server-side authorization-code flow, a signed short-lived state, an OIDC nonce, verified Google email claims, and a single-use app exchange code. The Google client secret stays on the server.

The Expo app has the `quizarena://` deep-link scheme. Because this changes native app configuration, publish a new EAS Android/iOS build before expecting the installed production app to receive the Google callback. Expo Go is not a production validation target for this custom scheme.

## API routes

| Method | Route | Purpose |
| --- | --- | --- |
| POST | `/api/auth/register` | Create a pending account and send email verification code |\n| POST | `/api/auth/email/verification/request` | Resend a pending email verification code |\n| POST | `/api/auth/email/verify` | Verify email and create a session |\n| POST | `/api/auth/email/password-reset/request` | Request an email password-reset code |\n| POST | `/api/auth/email/password-reset` | Verify code and set a new password |\n| POST | `/api/auth/phone/register/request-otp` | Legacy SMS registration endpoint (not used in current app UI) |
| POST | `/api/auth/phone/register` | Legacy SMS registration endpoint |
| POST | `/api/auth/phone/link/request-otp` | Authenticated existing user requests a phone-link code |
| POST | `/api/auth/phone/link` | Authenticated existing user verifies and links a phone number |
| POST | `/api/auth/phone/login/request-otp` | Request phone sign-in code |
| POST | `/api/auth/phone/login` | Verify code and sign in |
| POST | `/api/auth/phone/password-reset/request-otp` | Request password-reset code |
| POST | `/api/auth/phone/password-reset` | Verify code and set a new password |
| GET | `/api/auth/google/start` | Start Google OAuth |\n| GET | `/api/auth/telegram/start` | Start optional Telegram OIDC sign-in |\n| GET | `/api/auth/telegram/callback` | Telegram server callback |\n| POST | `/api/auth/telegram/exchange` | Exchange the short-lived Telegram app code for the normal QUIZ ARENA session |
| GET | `/api/auth/google/callback` | Google server callback |
| POST | `/api/auth/google/exchange` | Exchange the short-lived app code for the normal QUIZ ARENA session |
| POST | `/api/auth/login` | Existing username/password sign-in (unchanged) |
| POST | `/api/auth/register` | Existing registration endpoint (unchanged for compatibility) |

Phone numbers are normalized to Uzbekistan's `998XXXXXXXXX` format. Password-reset responses do not disclose whether a phone number is registered.
