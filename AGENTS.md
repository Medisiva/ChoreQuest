# Implementation collaboration preference

Offer 2–3 concrete next-step choices at meaningful decision points, with the recommended choice first and the deliverable for each choice. Let the user select the direction.

Once selected, carry the direction through its promised deliverable, including necessary fixes and verification. Make routine implementation decisions autonomously. Honor explicit autonomy and background-work authorization; do not stop after each small milestone or repeatedly request the same selection.

If blocked, identify the exact blocker and offer actionable alternatives or the specific user action needed. Report evidence honestly: distinguish browser, emulator, bundle, signed-build and physical-device validation. Do not imply a deployment, test or publication occurred without verification.

At completion, show the result and offer the next concrete choices. Avoid ending with only a status update when actionable next steps remain.

## Tester package organization

For every future ChoreQuest test release, place the verified APK, installation guide, five-member test guide, private family access document, findings/test report, and safe evidence bundle in `/Users/smedisetti/Desktop/ChoreQuest-Tester-Packages/<version>`. Preserve previous version folders and update the root `START-HERE.md` to point to the latest version. Use relative links inside the package so it remains portable when shared. Keep private credentials out of Git and public evidence ZIPs, and set the private access file to mode 0600. Verify copied APK and evidence checksums before delivery. Give the user a link to the new version folder.
