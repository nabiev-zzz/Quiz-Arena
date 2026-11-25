# QUIZ ARENA — Samsung Galaxy Store release

## Build

Use the galaxyStore EAS profile:

- distribution: store
- Android output: AAB
- GALAXY_STORE_BUILD=true
- Google Play Billing controls are hidden; Click and Payme checkout remains available.
- app.config.js disables expo-updates automatic checks for this profile.

Build command:

eas build --platform android --profile galaxyStore

The Galaxy Store AAB is separate from Google Play production AAB. Do not upload the Google Play AAB for the Samsung listing unless its store-specific behavior has been validated.

## Samsung review requirements to complete

1. Seller Portal account is registered and has Commercial Seller status approved.
2. Register a new Android app; package ID is uz.quizarena.app.
3. Upload the Galaxy Store AAB and select a Galaxy Store-managed signing key (or a seller-managed key that will be preserved for every future update).
4. Complete app information: default language, title, short/long description, category, age rating, support email, privacy-policy URL, graphics and screenshots.
5. Complete the mandatory Data Safety tab accurately; disclose data collected/shared and the reasons.
6. If login is required, add a dedicated review/test account in the review comments. Do not give Samsung a personal account.
7. Submit the app for Samsung review. The app is not public until Samsung approves and the seller publishes it.

## Samsung-specific behavior

Samsung's App Distribution Guide says apps must not initiate or support automatic updates. The Galaxy Store build disables Expo Updates automatic checks; distribute later versions through Seller Portal.

Samsung recommends Samsung IAP for in-app products and subscriptions. This version keeps the existing Click/Payme checkout and does not claim to have Samsung IAP integration. If native Galaxy Store subscriptions are needed, implement and test Samsung IAP in a separate update.

## Binary requirements

Samsung's current FAQ requires target API level 33 or higher and at least one 64-bit binary. Expo SDK 58 targets API 36. The native build should include arm64-v8a; confirm the final AAB before submitting.
