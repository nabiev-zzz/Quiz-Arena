# QUIZ ARENA mobile release

## Build profiles

- preview: internal Android APK and iOS IPA builds for device testing; updates use the preview channel.
- production: Android App Bundle (AAB) and iOS App Store build; updates use the production channel.

## OTA updates

The project uses expo-updates with runtimeVersion.policy = appVersion.
Only JavaScript, TypeScript, styles, and compatible bundled assets can be sent over the air.
Changes to native dependencies, permissions, config plugins, native app configuration, or the Expo SDK require a new binary build.

Publish a preview update only after QA:
eas update --channel preview --message "Describe the change" --environment preview

Publish a production update only after release approval:
eas update --channel production --message "Describe the change" --environment production

The preview and production environments must be configured in EAS and must not contain secrets in client-side public variables.

## Build and distribution

Android test build:
eas build --platform android --profile preview

iOS test build:
eas build --platform ios --profile preview

Google Play build:
eas build --platform android --profile googlePlay

The Google Play profile uses its own `google-play` EAS Update channel and a consumption-only Premium screen. Click/Payme checkout stays in the web/direct distribution; it is not shown inside the Google Play build.

App Store / TestFlight build:
eas build --platform ios --profile production

The first internal iOS IPA requires an Apple Developer account and registered test-device UDIDs (Ad Hoc distribution). TestFlight/App Store distribution requires App Store Connect setup and signing credentials.

## Release safety

1. Keep changes on a feature branch and require CI checks.
2. Install the preview APK/IPA and test login, matchmaking, Battle reconnect, payments and deep links on physical devices.
3. Do not publish a production OTA update unless it matches the installed binary runtime version.
4. For native changes, create and distribute a new binary instead of OTA.
5. Keep production API/database configuration unchanged during mobile release preparation.
