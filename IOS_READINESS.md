# ChoreQuest iOS readiness — October 13, 2026

Readiness checks are complete. Native compilation and simulator execution are pending Xcode installation. This is an engineering handoff for app version 1.0.4, not an installable Apple release.

Code lives in `Desktop/MyCoding/FamilyQuest/ChoreQuest-1.0.4/ChoreQuest`, on branch `codex/ios-readiness`. Starting Android release commit: `c79e6fcf46f2236b1293337a690d04a17f758075`. The previously delivered Android APK is unchanged. No backend deployment, cloud build, TestFlight upload, or store submission was performed for this work.

## Changes

- Both parent and child tab bars now account for the bottom safe-area inset without shrinking their usable content area. Verified with mocked 0, 20 and 34 point insets; appearance on real iPhone and iPad screens still requires simulator testing.
- Notification permission checks use Apple's native authorization status, accepting authorized, provisional (quiet) and ephemeral permission. Permanent denial no longer causes a redundant permission request. Push registration uses the same decision; Android channel settings remain intact.
- Alert error text now refers to the user's device rather than Android.
- Added `ios-simulator` EAS profile extending the existing preview environment, with simulator enabled, no development client, and no automatic version increment. It is intended for standalone simulator builds; no build was submitted.
- Added `npm run ios:simulator` in the app workspace for local native compilation after Xcode is available. Existing Android and iOS start scripts are preserved.
- Excluded generated native directories from cloud uploads so Expo config remains the source of truth. Generated local iOS files remain ignored by Git.

## Verified evidence

| Check | Result | Evidence in repository |
| --- | --- | --- |
| TypeScript | Passed, exit 0 | `work/ios-readiness-typecheck.log` |
| App unit/component/service tests | 46 passed, 0 failed | `work/ios-readiness-tests.log` |
| Backend unit tests | 59 passed, 0 failed | `work/ios-readiness-tests.log` |
| Focused notification and tab tests | 8 passed, 0 failed | `work/ios-readiness-focused-tests.log` |
| iOS Metro/Hermes export after fixes | Passed, exit 0 | `work/ios-readiness-export.log`, `work/ios-readiness-export/metadata.json` |
| Expo native config introspection | Passed, exit 0 | `work/ios-readiness-native-config.json` |
| iOS native project generation (`prebuild --no-install`) | Passed, exit 0 | `work/ios-readiness-prebuild.log`, ignored `app/ios/` |
| CocoaPods install / Xcode compilation | Not run | Xcode and CocoaPods unavailable |
| iPhone/iPad simulator interaction | Not run | Xcode app and simulator runtime not found |
| Physical iPhone/iPad testing | Not run | Pending later device testing |

Generated config includes camera and photo-library explanations and no microphone usage description. The Xcode project targets iPhone and iPad (`TARGETED_DEVICE_FAMILY = 1,2`) and declares iOS 15.1. That is a generated configuration value, not proof of runtime compatibility. Native auth selects the existing AsyncStorage-backed persistence implementation for iOS; real cold-launch persistence still needs testing.

The JavaScript export used the existing preview environment; no live user flows were run. The local `.env.local` currently enables emulators on `localhost`; do not assume a simulator launch will connect to the production backend. Use the explicit demo environment in the [simulator guide](IOS_SIMULATOR_TEST_GUIDE.md).

## Remaining work

Install full Xcode, finish its first-launch setup, and install an iOS Simulator runtime. Then install native dependencies, compile, and execute the [iPhone/iPad test matrix](IOS_SIMULATOR_TEST_GUIDE.md). Photo capture requires physical-device confirmation; the simulator can exercise gallery selection and permission-denial paths. Background/remote push delivery also remains unverified.

No build or run success should be claimed until those stages produce actual evidence. The current check results establish source, configuration and JavaScript-bundle readiness only.
