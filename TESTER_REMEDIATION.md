# Tester remediation — 1.0.2

Scope selected by the user: every H/M/L finding and APK manifest observation in the October 10 tester report. No clean independent sign-off is claimed until the tester reruns the candidate. Native Samsung checks remain distinct from browser/emulator/static checks.

## Implemented acceptance checklist (verification evidence below)

- H1: child Yes/Not yet request actions complete the request loop; exactly one parent award.
- H2: wrong/unknown/duplicate account failures keep the form mounted, retain inputs, show error.
- H3: invalid family/task data rejected; poisoned family/template/child cannot stop healthy scheduled processing.
- H4: bounded milestone awards; malformed legacy award failure frees locks and is visible.
- M1: previous recurring occurrences expire; claimed in-progress occurrences remain finishable.
- M2: deadline visible and enforced on claim.
- M3: revoked/expired source child session cannot delegate to any sibling.
- M4: values, sizes and enums validated at trusted write boundaries.
- M5: family deletion preserves co-parent Auth, supports cancellation/recovery/new setup.
- M6: onboarding targets validated at their step and at backend.
- M7: bonus/deduction, consequence definitions, child edit/archive, parent invitation/join and timezone screens.
- M8: milestone amount breakdown shown; release/reclaim preserves paid progress without repeated awards.
- M9: pending reward requests visible/actionable from dashboard.
- L1: meaningful claim/submission errors.
- L2: truthful offline indicator and reconnect errors.
- L3: dashboard Review action wired.
- L4: one-star increments and correct singular/plural labels.
- L5: request send guarded/idempotent; leaves send step on success.
- L6: duplicate active child names refused atomically.
- L7: parent name collected and persisted.
- L8: onboarding narrow-width actions fit.
- L9: sent-back quest displayed on child home.
- L10: accessible tab/PIN labels; eyebrow contrast.
- L11: permission denial offers device settings with retry guidance.
- L12: empty quest title produces an explicit validation message.
- APK: remove unused overlay permission; exclude stored auth from device backup; review merged manifest.

## Verification protocol

Preserve tester evidence and original results in ignored work/tester-evidence. Import the guarded demo-only adversarial suite; fix expectations only when stricter validation now rejects an invalid fixture at creation, and record each adaptation. Run existing and new suites without suppressing failures. Verify actual UI actions using isolated emulator/browser fixtures, never real user families. Build one signed candidate after checks pass; inspect artifact and prepare an ID-by-ID retest report with remaining limitations.

## Current verification evidence

97 unit checks pass; clean 42-check emulator run passes; expanded adversarial rerun 26/26 passes. TypeScript, backend compilation, 20/20 Expo Doctor and Android Hermes export pass. Browser verified auth errors, full request return/confirmation, duplicate rename, edits, bonus/deduction, consequences, archive/restore, timezone validation and narrow onboarding. Detailed ID-by-ID evidence and remaining independent/native checks are in the local outputs/chorequest-1.0.2-retest-report.md; this is not an independent sign-off.

Imported suite adaptations: demo-only PINs; S06 rejects bad writes then injects legacy invalid data; S17 distinguishes paid steps and resumption. Original tester evidence retained unchanged in ignored work/tester-evidence. Result data stays ignored. Android merged-manifest/signature checks await the actual APK.

Final browser coverage also passed: all eight onboarding steps, dashboard Review and rejection, pending reward→approval→deduction, rejected feedback on child home, empty-title validation, and invitation→verified co-parent join. Final Android export and TypeScript checks pass after the approval label correction. NetInfo pinned exactly11.5.2, matching Expo55. Live16endpoint checks plus synthetic parent/child read-only smoke pass; rules and28functions updated. Missing artifact cleanup-policy warning is recorded; no force flag applied. Independent Samsung/native permission checks remain required.
