# Dark arcade design — ChoreQuest 1.0.3

Approved direction: black backgrounds, vivid accents, expressive child faces and a game-like adventure hub, quest board and treasure shop. Parent, authentication, onboarding, PIN, management and review screens use the same dark palette.

## Implementation

- Shared dark semantic surfaces and bright, readable foregrounds; explicit on-accent text for filled buttons. Legacy token names remain compatible with existing screens.
- Purple character heroes with pink avatar rings, lime accents and gold stars. Child home uses actual balance, weekly earnings, preferences, streak and current claim; its featured mission links to the existing quest route.
- Bundled vector toys, book, plant, paint and treasure artwork; no new dependencies or external image requests.
- Illustrated category quest cards, a treasure-shop hero and illustrated reward cards. Existing claim, review, request and award services remain unchanged.
- Labeled line-icon child navigation and compact parent navigation. Dark app configuration/splash and light status-bar content.
- All access forms and management controls retain their validation, authorization and asynchronous state handling. Real targets and ledger earnings remain distinct from spendable stars; no invented XP or levels.

## Verification

97 unit checks (38 app/59 backend),42 emulator checks, TypeScript,20ExpoDoctor checks, native peer compatibility and final Android Hermes export pass. Browser: sign-in/player picker/PIN/child home, populated mission board/shop, real quest claim→submission→parent password barrier→dashboard review→approval→10-star award pass on a disposable demo family. Actual390px layouts inspected. Browser SVG warnings were found and corrected; final8128 console has no new errors. Final copied source8129 includes the lime hero line, duplicate quest-unit removal and corrected gold-stat contrast; all eight onboarding steps completed with a preschool child/PIN, quest and rewards saved, parent name preserved, no new browser errors.

The initial isolated preview could not resolve nested FlashList until its ignored Metro helper included the app/root dependency paths. DevTools installation emits an environment warning. CI-disabled watchers exceed the macOS file limit, so the final preview uses CI mode; it does not watch edits. Browser navigation occasionally times out long after bundling succeeds; reading the existing tab works. Do not restart or navigate unnecessarily.

Signed APK preparation and physical Samsung validation remain separate evidence. No production readiness, independent clean tester report or store publication is claimed. Production backend/data were not changed for this design; destructive regression scenarios ran only in demo emulators.
