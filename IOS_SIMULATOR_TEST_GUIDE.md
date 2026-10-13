# ChoreQuest iPhone/iPad simulator guide

Status: prepared October 13, 2026. No simulator testing has been performed yet.

## Prepare the Mac

1. Install Xcode from the Mac App Store, open it, and finish first-launch setup. Install an iOS Simulator runtime from Xcode's component settings.
2. Select Xcode under Xcode > Settings > Locations > Command Line Tools. If installed in a custom location, use that Xcode installation.
3. Verify `xcrun simctl list devices available` shows at least one iPhone and one iPad simulator.
4. Ensure CocoaPods is available. Expo's local build may offer to install it; resolve any required installation or permissions before compilation.

## Compile against disposable demo data

Use two terminals. This prevents destructive test cases from touching the Android validation family's data. Commands below use a `demo-` Firebase project, never a live family.

Terminal 1, from the repository:

```sh
cd /Users/smedisetti/Desktop/MyCoding/FamilyQuest/ChoreQuest-1.0.4/ChoreQuest
npm run functions:build
FIREBASE_EMULATORS_PATH=./work/firebase-emulators XDG_CONFIG_HOME=./work/firebase-config ./node_modules/.bin/firebase emulators:start --config firebase.test.json --project demo-chorequest --only auth,firestore,functions,storage
```

Terminal 2:

```sh
cd /Users/smedisetti/Desktop/MyCoding/FamilyQuest/ChoreQuest-1.0.4/ChoreQuest/app
EXPO_PUBLIC_FIREBASE_PROJECT_ID=demo-chorequest EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=demo-chorequest.appspot.com EXPO_PUBLIC_USE_EMULATORS=true EXPO_PUBLIC_EMULATOR_HOST=localhost npm run ios:simulator -- --device
```

Choose a simulator from the device list, rather than a connected physical device. Keep the emulator terminal running and stop if any Firebase emulator fails to start. Create new disposable users and a new demo family; Android production test accounts will not exist in this environment. Confirm the app logs say `[Firebase] Connected to emulators` before testing. This local debug build requires Metro, which the Expo command starts.

If Metro is already running with different environment values, stop it before launching this command. Use `npx expo start --clear` with the same environment overrides if cached settings need resetting.

## Test matrix and evidence

Run on an iPhone with a home indicator, a small iPhone screen if available, and an iPad. Record device model, OS/runtime version, build source commit, test data family identifier (no passwords/PINs), and pass/fail evidence.

| Area | Required checks |
| --- | --- |
| Startup | Launch without red screen; fonts/images load; no startup crash |
| Authentication | Register, log in, invalid password, password reset path; terminate/relaunch and verify intended persistence |
| Family setup | Create a disposable family, add children, validate invalid PIN/date/star inputs, join a demo family |
| Parent/child access | Enter child mode; child cannot access parent tabs; wrong password cannot unlock parent mode; correct password restores it |
| Keyboard and layout | All auth/setup forms stay usable when keyboard opens; parent/child tabs clear the home indicator; small-screen scrolling and iPad portrait layout |
| Quests | Create, claim, release, submit proof, parent approve/reject; balances and status update once |
| Photo proof | Cancel gallery picker, pick a sample image, denied permission recovery, upload with demo Storage; camera capture deferred to physical iPhone |
| Requests/rewards | Submit a request once despite repeated taps; parent accepts/completes; child confirms; reward requests and approvals update correctly |
| Device alerts | First permission request, denial, re-enable via Settings, local request/badge alert; provisional authorization behavior where available |
| Offline/relaunch | Disconnect, reject unsafe save, reconnect and retry; terminate/reopen; session expiry and role isolation |
| Export and settings | Share sheet opens with correct JSON; cancel share; links open; disposable account-deletion flow only |
| Accessibility | Larger text, VoiceOver labels, touch targets, tab labels and error visibility |

Screenshot each screen family and any defect. Redact emails and personal data; never put passwords, PINs, tokens or private access files in screenshots or shared evidence. No clean simulator sign-off until the matrix is run.

## Optional standalone simulator build later

The `ios-simulator` EAS profile is prepared. After local tests and checking account build availability, a cloud simulator build can use `eas build --platform ios --profile ios-simulator`. It inherits the preview environment and therefore uses the production backend; use a new disposable validation family for its non-destructive checks. It does not use the demo environment above. Do not run account/family deletion checks against the shared Android test family.

A standalone simulator build is distinct from a signed iPhone/TestFlight build. Apple Developer membership is not required for the simulator build. No cloud build, payment, credential setup or TestFlight upload has been performed in this readiness stage.

References: [Expo simulator builds](https://docs.expo.dev/build-reference/simulators/), [Expo local iOS development](https://docs.expo.dev/guides/local-app-development/), [iOS notification permissions](https://docs.expo.dev/versions/latest/sdk/notifications/).
