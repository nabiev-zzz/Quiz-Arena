# QUIZ ARENA — Google Play Data safety preparation

This is a code-based inventory for the Play Console form, not a substitute for reviewing the live production environment, provider contracts, logs, and the exact release build before submission.

## Data types present in the application

| Play Console category | Data type | Why it is processed | Sharing / processing |
|---|---|---|---|
| Personal info | Name | Account profile and public profile | Stored by QUIZ ARENA; may be sent to selected authentication/service providers only as needed |
| Personal info | Email address | Account login/recovery and email verification | Resend for delivery; Google only when Google sign-in is selected |
| Personal info | Phone number | Phone login, verification and recovery | Eskiz for SMS delivery |
| Personal info | User IDs | Account identity, ranking, Battle and subscription ownership | Stored by QUIZ ARENA; Google/Telegram authentication identifiers are processed when those sign-in options are selected |
| Photos and videos | Photos | User-selected avatar image, stored in the account profile | Uploaded to QUIZ ARENA API as compressed Base64 image data |
| App activity | App interactions | Quiz/learning attempts, Battle participation, XP and rankings | Stored by QUIZ ARENA |
| App activity | Other user-generated content | AI Tutor messages and conversation history | Stored by QUIZ ARENA; message/context data may be sent to Groq and/or Google Gemini to generate AI responses |
| Financial info | Purchase history | Premium plan and payment status/history | Click or Payme processes the payment; QUIZ ARENA stores transaction metadata, not full card credentials |

## Security and deletion answers to validate

- Data is encrypted in transit: **Yes**, for production app/API and external provider connections using HTTPS/TLS.
- Users can request deletion: **Yes**, in the app at Settings → Permanently delete account and externally at `https://quiz-arena-website-production.up.railway.app/account-deletion.html` after the updated website is deployed.
- Data is sold: **No**. The app does not sell personal data.
- Advertising: no advertising SDK or ad-supported monetization was found in the mobile package during this repository review. Recheck the exact release dependency tree before declaring “No” in Play Console.
- Location, contacts, health, financial account credentials and full payment-card data: no collection flow was found in the reviewed app/API code.

## Third-party processors identified in code

- Groq and Google Gemini: AI Tutor prompts, user messages and relevant conversation/progress context.
- Google and Telegram: authentication when the user selects those providers.
- Resend: email verification and recovery messages.
- Eskiz: SMS one-time codes.
- Click and Payme: payment processing and transaction callbacks.
- Railway: API and website hosting/database infrastructure.

Confirm current processor terms, retention, data regions and any SDK-side collection before submission. The Data safety form must reflect the actual production configuration, not just this source-code inventory.

## Important deletion behavior

- Account profile, avatar data, AI Tutor messages, learning attempts, learning web sessions, follows, subscriptions, OAuth codes, email codes and phone OTP records are removed.
- Battle match rows involving the deleted user are removed because the current schema has restrictive foreign keys and embeds per-player identifiers/results.
- Payment ledger rows are retained only in a de-linked form: `userId` becomes NULL, pending transactions are cancelled, and any stored provider payload is cleared. This preserves minimal transaction reconciliation history without retaining the app account link. State this retention clearly in the privacy policy and validate whether the payment provider or applicable law requires any additional record retention.
- Database backups expire through the normal backup rotation process. Do not promise an exact backup-erasure period until the actual database backup retention is confirmed.

## Before filling Play Console

- [ ] Deploy the website update and verify the privacy and account-deletion URLs return HTTP 200 publicly without login walls on the privacy page.
- [ ] Verify account deletion end-to-end with a disposable test account, including all tables and payment ledger anonymization.
- [x] Developer support email is published on the privacy policy and support page: `zelqencoresupport@gmail.com`.
- [ ] Add the same email to Google Play Console developer contact details and verify that the inbox is monitored.
- [ ] Reconcile this inventory against the live Railway environment, logs, database backups, and the exact Google Play AAB.
- [ ] Answer all Play Console Data safety and account-deletion questions truthfully; do not guess.
