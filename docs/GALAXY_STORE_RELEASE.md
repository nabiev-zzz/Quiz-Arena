# QUIZ ARENA — Samsung Galaxy Store release

## Build

Use the `galaxyStore` EAS profile:

- Distribution: store
- Android output: AAB
- `GALAXY_STORE_BUILD=true`
- `eas-build-pre-install` runs a Node script before EAS installs dependencies. It adds `expo-iap` to `expo.autolinking.android.exclude` in the temporary build checkout, preventing the Google Play Billing native module from being linked into the Galaxy Store binary.
- `app.config.js` removes the `expo-iap` config plugin, marks the build as `galaxy-store`, and disables Expo Updates automatic checks for this profile.
- Google Play Billing UI is hidden; Click and Payme checkout remains available.

Build command:

```sh
eas build --platform android --profile galaxyStore
```

The Galaxy Store AAB is separate from the Google Play production AAB. Do not upload the Google Play AAB for the Samsung listing.

## Samsung review requirements to complete

1. Seller Portal account is registered and has **Commercial Seller** status approved.
2. Register a new Android app; package ID is `uz.quizarena.app`.
3. Upload the Galaxy Store AAB. Samsung must manage the signing key for AAB; choose the Galaxy Store key or import/select the signing key that will be used for all future updates.
4. Complete app information: default language, title, short/long description, category, age rating, support email, privacy-policy URL, graphics and screenshots.
5. Complete Data Safety details accurately; disclose data collected/shared and the reasons.
6. If login is required, add a dedicated review/test account in the review comments. Do not give Samsung a personal account.
7. Submit the app for Samsung review. The app is not public until Samsung approves it and the seller publishes it.

## Samsung-specific behavior

Samsung's App Distribution Guide says apps must not initiate or support automatic updates. The Galaxy Store build disables Expo Updates automatic checks; distribute future versions through Seller Portal.

Samsung recommends Samsung IAP to sell in-app products such as items and subscriptions. This build currently keeps Click/Payme and does **not** integrate Samsung IAP. Confirm with Samsung's current monetization requirements that this payment method is acceptable for the digital Premium benefits before submission; otherwise implement and test Samsung IAP first.

## Binary requirements

Samsung's current FAQ requires target API level 33 or higher and at least one 64-bit binary. Expo SDK 58 targets API 36. Confirm the final AAB contains `arm64-v8a` and is successfully signed through Galaxy Store's signing flow before submission.
