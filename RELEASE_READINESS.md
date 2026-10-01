# ChoreQuest Android release work

Status: in development. No signed APK/AAB, deployed backend, store listing, or store submission has been produced. iOS follows the Android release.

## Verified baseline

- Expo Router launches the app instead of the starter screen; screen imports resolve.
- Email sign-in and registration display service failures; incomplete social sign-in buttons are removed.
- Family/profile routing and task/request subscriptions are connected.
- Quest creation saves data, handles optional fields, and reports failure without losing input.
- Parent approval, rejection, and approve-all persist through a transactional service instead of console logs.
- Claims use a task-document lock to serialize simultaneous claim attempts. Release clears the matching lock; submitted claims cannot be released.
- Task awards use deterministic per-claim/per-step ledger IDs. Trigger retries do not award stars twice. Milestones reopen for the next step; the completion bonus is only awarded on the final step.
- Completed one-off quests are deactivated. Recurring source tasks retain their completed lock until the scheduler generates a new instance.
- Parent request awards use acceptedByParentId, parentUsers, and the canonical transaction fields instead of the incompatible members/parentUid schema. Retry awards are idempotent.
- Recurrence generation uses canonical task fields, deterministic create-only instance IDs, family-local day/week/month periods, and nonrecurring copies. Concurrent scheduler retries create one occurrence; completed template locks are hidden from the child feed.
- Rejected quests show parent feedback and can resubmit. Submission uses a transaction and refuses already submitted/approved claims.
- Onboarding and child creation now call authenticated server functions, which hash PINs with bcrypt and create canonical config/mapping/leaderboard documents. Concurrent bootstrap retries retain one family. Neither flow writes demo hashes or plaintext PINs to Firestore.
- Parent settings include a PIN reset screen. The backend authorizes family membership, resets failed attempts, and records a session revocation timestamp; enforcement of that timestamp by child mutation endpoints remains pending.
- Firestore rules allow each user to read their own parentProfiles mapping and the canonical settings document; family bootstrap, profile creation, membership, PIN credentials, and profile balances are server-owned.
- Profile-change triggers refresh the family document monotonically; familyStore reloads child profiles and the current parent document on updates, ignores stale async loads, and cleans up pending loads on unsubscribe. Emulator/device validation is pending.
- PIN verification stores hashed, parent/child-bound expiring session records and serializes failure counters/lockouts. Expired lockouts start a fresh window; legacy demo hashes require a parent reset. Session enforcement by child mutation endpoints is still pending.
- PIN entry uses authenticated HTTP requests and configured emulator/production URLs, and passes the actual token string to the session store.
- PIN verification rejects callers from other families, deleted families, and invalid input before accessing child profiles.
- Local app is linked to Expo medisivateam/chorequest. EAS configuration lives in app/eas.json, with APK preview and AAB production profiles.

Validation: npm test passes 6 app service tests and 26 backend tests. npm run app:typecheck and functions compilation pass. Tests use transactional fakes and mocked trigger envelopes; Firebase emulator integration and device tests are still required. Android Metro/Hermes export is checked separately; it does not validate native compilation or runtime behavior.

## Next implementation work

1. Enforce server session records and PIN-reset revocation on child operations; guard parent/child mode boundaries. Existing parent Firebase credentials still grant full family access in child mode. PIN hashing, reset, request authentication, and atomic lockout handling are repaired.
2. Run Firebase emulator integration tests for bootstrap/profile rules, authorized updates, and denied balance/credential writes. Server bootstrap and canonical paths are repaired. Audit client star writes versus rules that reserve ledgers for the backend. Java 21 is installed, but Firebase CLI/emulator tooling is not installed in the project.
3. Validate recurring tasks in Firebase emulators and on device, including template editing/cancellation and scheduled weekly/monthly boundaries. The schema, duplicate generation, recursive copying, and timezone period bugs are repaired.
4. Replace mock leaderboard and accountability data, connect consequence clearing and task editing, and validate profile balance refresh after awards. Reject/resubmit and milestone flows need full integration tests.
5. Audit weekly/monthly jobs, badge criteria, push notifications, photo proof, reward redemptions, export authorization, and genuine account/data deletion. The current deletion endpoint promises a 30-day purge without a purge implementation.
6. Finish shared design tokens, parent/child layouts, accessibility, app branding, loading/error/empty states, and inspect real screens visually.
7. Review remaining dependency advisories; configure authentication persistence and Android permissions; validate EAS environments and notification credentials.
8. Build a signed internal APK, test on a physical Android device and emulator, prepare accurate store screenshots/listing/privacy disclosures, then prepare the AAB and applicable Play testing/review steps.

## Accounts and user actions

- Firebase: chorequest-prod; client configuration is in ignored app/.env.local. Local development uses emulators. No production writes were made during this work.
- Expo: medisivateam/chorequest; project ID a130f2f3-ac0b-47e1-97cd-09a324ccdff8. CLI authorization was pending at the last interactive check. Do not extract browser session credentials to bypass it.
- Google Play: Medisiva personal account. Identity, Android device, and phone verification were confirmed; Create app is enabled. No app has been created yet.
- User input is not needed for the independent development above. CLI login, final release declarations/legal acceptance, any paid actions, and physical-device testing may need the user later. Avoid interrupting overnight work for these until necessary.
