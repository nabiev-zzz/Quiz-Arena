# QUIZ ARENA — Google Play release checklist

## Store build identity

- Android application ID: `uz.quizarena.app` (must never change after publication)
- App version: `1.0.0`
- Android version code started at `1`; EAS local auto-increment reserved `2` for the first Google Play test build. Later Google Play builds increment the local value automatically
- Artifact: Android App Bundle (`.aab`)
- EAS profile: `googlePlay`
- EAS Update channel: `google-play` (isolated from direct/preview builds)
- Store marker: `extra.distributionStore = google-play`

Build only after release gates are cleared:

```bash
eas build --platform android --profile googlePlay
```

## Premium and payment policy boundary

The Google Play app build is a consumption-only Premium experience. It reads the signed-in user's server-side Premium entitlement, but does not show external checkout buttons, payment URLs, or Google Play Billing purchase controls. The Google Play native build excludes `expo-iap` from the config plugin and Android autolinking, and the Play Premium screen contains no Billing purchase UI. The dependency remains in the shared lockfile for other distribution builds.

Click and Payme checkout remain in the existing web/direct-distribution product and backend. Do not add in-app text, buttons, links, QR codes, or instructions that direct Google Play users to an external payment method for digital Premium access. Do not publish a production OTA update that bypasses the store-specific Premium guard.

## Technical checks

- [ ] EAS AAB build completes and artifact is downloaded from the exact Google Play profile
- [ ] Inspect final merged Android manifest: target SDK is Android 16 / API 36 or higher (required for new apps from 31 Aug 2026)
- [ ] Verify package, version code, app label, icon, adaptive icon, splash screen and signing certificate
- [ ] Verify release AAB with bundletool / Play Console pre-launch report
- [ ] Test install, update, login, registration, email/phone verification, password reset, profile/avatar, learning, quiz, Battle, reconnect, rankings, premium entitlement read-only state, deep links and offline/error states on physical Android devices
- [ ] Confirm no payment checkout URL or external billing action is reachable from the Google Play build
- [ ] Confirm production API/database configuration has not changed

## Mandatory Play Console declarations and legal release gates

- [x] Public HTTPS privacy policy source page created at `/privacy.html`; deploy and verify the public URL before submission
- [x] Account deletion flow implemented in the app and on a public web resource, with password or verified-email confirmation; deploy and test it end-to-end before submission.
- [ ] Complete Data safety form from an audited inventory of all app, API, hosting, payment and authentication data flows
- [ ] Complete Data deletion questions and provide the external account-deletion URL
- [ ] Complete app access instructions/test account for reviewers, if any feature requires sign-in
- [ ] Complete target audience, content rating (IARC), ads declaration, app category, contact details and store listing
- [ ] Provide accurate phone/tablet screenshots and feature graphic; do not use mock UI that differs from the release app
- [ ] Confirm all third-party SDK/data disclosures and permission declarations
- [ ] If the Play Console account is a new personal developer account created after 13 Nov 2023, complete closed testing with at least 12 opted-in testers continuously for 14 days before applying for production access
- [ ] Developer account owner must meet Google Play's legal eligibility and identity-verification requirements

## Current known release blockers

1. The privacy, support and account-deletion pages are in the source tree but have not yet been deployed and verified at their public URLs.
2. A real, monitored developer support email address has not yet been supplied or configured.
3. The two account-deletion migrations must be applied by the API deployment and the full deletion flow must be tested against a disposable account and real database.
4. The generated project targets compile SDK 37 and target SDK 36; verify these values again in the exact EAS build.
5. No AAB artifact has yet been produced or physically device-tested from the final Google Play release commit.

Do not mark the app as production-ready until each blocker is resolved and the resulting build is tested.
