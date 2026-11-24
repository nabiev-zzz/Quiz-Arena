# QUIZ ARENA authentication setup

The existing username/password endpoints remain available. New phone and Google sign-in flows are additive and use the existing JWT session format.

## Railway API variables

Set these variables on the Railway API service. Do not commit credentials or put them in the mobile app.

| Variable | Purpose |
| --- | --- |
| `ESKIZ_EMAIL` | Eskiz account email used by the server to request an SMS API token |
| `ESKIZ_PASSWORD` | Eskiz API password |
| `ESKIZ_FROM` | Optional approved sender name/ID |
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 Web application client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 2.0 Web application client secret |
| `GOOGLE_REDIRECT_URI` | Exact public callback URL: `https://humorous-imagination-production.up.railway.app/api/auth/google/callback` |

Keep the existing `JWT_SECRET` configured. It is used to sign the existing application sessions and short-lived OAuth state.

## Eskiz setup

1. Create or sign in to an Eskiz business account and enable the SMS API.
2. Confirm that the account has SMS balance and an approved sender name if one is required.
3. Add `ESKIZ_EMAIL`, `ESKIZ_PASSWORD`, and optionally `ESKIZ_FROM` to Railway Variables.
4. The backend requests and caches the Eskiz bearer token server-side. The token and OTP values are never returned to the app or written to logs.

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
| POST | `/api/auth/phone/register/request-otp` | Send registration code |
| POST | `/api/auth/phone/register` | Verify code and create account |
| POST | `/api/auth/phone/link/request-otp` | Authenticated existing user requests a phone-link code |
| POST | `/api/auth/phone/link` | Authenticated existing user verifies and links a phone number |
| POST | `/api/auth/phone/login/request-otp` | Request phone sign-in code |
| POST | `/api/auth/phone/login` | Verify code and sign in |
| POST | `/api/auth/phone/password-reset/request-otp` | Request password-reset code |
| POST | `/api/auth/phone/password-reset` | Verify code and set a new password |
| GET | `/api/auth/google/start` | Start Google OAuth |
| GET | `/api/auth/google/callback` | Google server callback |
| POST | `/api/auth/google/exchange` | Exchange the short-lived app code for the normal QUIZ ARENA session |
| POST | `/api/auth/login` | Existing username/password sign-in (unchanged) |
| POST | `/api/auth/register` | Existing registration endpoint (unchanged for compatibility) |

Phone numbers are normalized to Uzbekistan's `998XXXXXXXXX` format. Password-reset responses do not disclose whether a phone number is registered.
