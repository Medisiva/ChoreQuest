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
- Family request creation/confirmation verifies the child’s stored session. The server serializes timezone-aware weekly quotas and enforces accept/decline/snooze/complete/confirm transitions; only the accepting parent can mark a request done, and a child cannot change an accepted price. Client request writes are denied by rules.
- Parent routes and profile selection require password reauthentication after entering child mode. Ending a child session retains the parent lock; child routes exit when the in-memory session expires. These are UI access guards; underlying Firebase parent credentials are still shared and require a separate server authorization design before production.
- Quest claiming, release, submission and parent review run in backend transactions. Claims verify the stored child session/revocation and bind child/task locks, prevent concurrent claims and multiple active quests, and initialize milestone step one. Direct client claim writes and task-lock changes are denied by rules.
- Required photo proof is captured/chosen, uploaded as JPEG and checked against the current claim’s storage object before submission. Parent review shows the image. Storage/emulator/device flows still need integration testing.
- Milestone approval advances to the next step and final completion clears the child’s active-quest lock. Late task/request award events skip deleted families.
- Child bonus/deduction operations run in authenticated backend transactions with idempotent operation IDs. Deductions floor at zero and ledger entries record the actual delta; negative/noninteger amounts are refused.
- Child reward requests validate a stored, parent/child-bound session and PIN-reset revocation, read the reward price on the server, and save that price with the pending request. Parent review checks pending status, balance and deterministic ledger state atomically; retries cannot deduct twice and concurrent approvals cannot overspend. Client redemption writes are denied by rules. Parent review displays the saved request price.
- Family data export checks revocation and canonical parent membership, validates document paths, includes settings/leaderboard data, and omits PIN credentials/session records. Settings shares the returned JSON using the Android share sheet instead of reporting a placeholder success.
- Family deletion requires recent authentication and family-creator authorization, atomically disables access and records a retryable purge job, and reports scheduling truthfully. A daily purge worker removes family storage, all Firestore descendants, leaderboard, profile mappings, and mapped parent Auth accounts; its behavior is mock-tested only and has not run against real accounts.
- Firestore and Storage membership checks deny access to deleted families. Storage paths now require actual family membership rather than any signed-in user.
- Onboarding and child creation now call authenticated server functions, which hash PINs with bcrypt and create canonical config/mapping/leaderboard documents. Concurrent bootstrap retries retain one family. Neither flow writes demo hashes or plaintext PINs to Firestore.
- Parent settings include a PIN reset screen. The backend authorizes family membership, resets failed attempts, and records a session revocation timestamp; quest, reward-request and family-request endpoints enforce that timestamp.
- Firestore rules allow each user to read their own parentProfiles mapping and the canonical settings document; family bootstrap, profile creation, membership, PIN credentials, and profile balances are server-owned.
- Profile-change triggers refresh the family document monotonically; familyStore reloads child profiles and the current parent document on updates, ignores stale async loads, and cleans up pending loads on unsubscribe. Emulator/device validation is pending.
- PIN verification stores hashed, parent/child-bound expiring session records and serializes failure counters/lockouts. Expired lockouts start a fresh window; legacy demo hashes require a parent reset. Quest, reward-request and family-request endpoints enforce these session records.
- PIN entry uses authenticated HTTP requests and configured emulator/production URLs, and passes the actual token string to the session store.
- PIN verification rejects callers from other families, deleted families, and invalid input before accessing child profiles.
- Local app is linked to Expo medisivateam/chorequest. EAS configuration lives in app/eas.json, with APK preview and AAB production profiles.

Validation: npm test passes 3 app tests and 49 backend tests. npm run app:typecheck and functions compilation pass. Tests use transactional fakes and mocked trigger envelopes; Firebase emulator integration and device tests are still required. Android Metro/Hermes export is checked separately; it does not validate native compilation or runtime behavior.

## Firebase integration and dependency validation

- Installed Firebase CLI and rule test tooling with a separate demo-project emulator configuration. Tests never connect to chorequest-prod.
- Five real emulator rule tests cover own-family/mapping reads, cross-family/anonymous denial, protected profile balances/credentials/membership, claim/ledger/redemption/request write denial, task locks, Storage image/size/membership validation, and deleted-family access denial.
- A full Auth/Firestore/Functions emulator test creates a family and child, verifies the PIN, claims/submits/reviews a quest, observes the asynchronous star-award trigger, and verifies repeat approval leaves one ledger entry and one award.
- The real Functions test exposed a runtime timestamp-helper failure missed by mocks. Backend code now imports FieldValue/Timestamp explicitly from firebase-admin/firestore.
- Dependency audit after targeted updates: 0 critical, 0 high, 28 moderate and 3 low findings remain. An unrestricted npm audit fix failed on Expo peer resolution and was not forced. Bcrypt 6 removes the old pre-gyp chain (release notes: https://github.com/kelektiv/node.bcrypt.js/releases/tag/v6.0.0). A scoped Firestore grpc override selects the patched 1.x transport and is covered by the real emulator flow.
- Validation commands: npm test, npm run app:typecheck, npm run test:integration, and Android Metro/Hermes export. Integration coverage is six tests; combined with the existing 52 tests, this is 58 passing tests. No native/device build or visual validation is implied.

## Next implementation work

1. Resolve the remaining server boundary between parent and child mode. UI routes now require parent password reauthentication and child mutation endpoints validate PIN sessions, but existing parent Firebase credentials still grant parent privileges in child mode. PIN hashing, reset, request authentication, and atomic lockout handling are repaired.
2. Extend Firebase emulator integration coverage beyond the validated bootstrap/rules/quest flow to rewards, family requests, PIN resets, photo proof, export/deletion and scheduled jobs. Server bootstrap and canonical paths are repaired. Child star adjustments and redemptions now use server-owned ledgers. Parent rewards/redemptions and any remaining balance mutations still need auditing. Java 21 and Firebase CLI/emulator tooling are installed; npm run test:integration runs against demo-chorequest.
3. Validate recurring tasks in Firebase emulators and on device, including template editing/cancellation and scheduled weekly/monthly boundaries. The schema, duplicate generation, recursive copying, and timezone period bugs are repaired.
4. Replace mock leaderboard and accountability data, connect consequence clearing and task editing, and validate profile balance refresh after awards. Reject/resubmit, single-active-quest locks, milestone progression and photo proof need full emulator/device integration tests.
5. Audit weekly/monthly jobs, badge criteria, push notifications, photo proof, reward redemptions, export authorization, and validate export/deletion in emulators. The purge worker is implemented but has not been deployed or exercised against real Firebase Storage/Auth; exports currently share JSON text instead of attaching a file. Individual parent leave/delete behavior for multi-parent families still needs a product flow.
6. Finish shared design tokens, parent/child layouts, accessibility, app branding, loading/error/empty states, and inspect real screens visually.
7. Review remaining dependency advisories; configure authentication persistence and Android permissions; validate EAS environments and notification credentials.
8. Build a signed internal APK, test on a physical Android device and emulator, prepare accurate store screenshots/listing/privacy disclosures, then prepare the AAB and applicable Play testing/review steps.

## Accounts and user actions

- Firebase: chorequest-prod; client configuration is in ignored app/.env.local. Local development uses emulators. No production writes were made during this work.
- Expo: medisivateam/chorequest; project ID a130f2f3-ac0b-47e1-97cd-09a324ccdff8. CLI authorization was pending at the last interactive check. Do not extract browser session credentials to bypass it.
- Google Play: Medisiva personal account. Identity, Android device, and phone verification were confirmed; Create app is enabled. No app has been created yet.
- User input is not needed for the independent development above. CLI login, final release declarations/legal acceptance, any paid actions, and physical-device testing may need the user later. Avoid interrupting overnight work for these until necessary.
