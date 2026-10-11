// Imported independent QA suite (Claude, 2026-10-10), with documented remediation fixtures.
// This maintained rerun is not an independent tester sign-off. Each subtest asserts correct behaviour;
// a failing subtest is a defect. Runs only against the demo-chorequest emulator.
const test = require('node:test'); const assert = require('node:assert/strict'); const crypto = require('node:crypto');
const path = require('node:path');
const { initializeApp, deleteApp } = require('firebase/app');
const { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithCustomToken } = require('firebase/auth');
const { getFirestore, connectFirestoreEmulator, collection, getDocs, doc, getDoc, setDoc, updateDoc, Timestamp, query, where } = require('firebase/firestore');
const { getFunctions, connectFunctionsEmulator, httpsCallable } = require('firebase/functions');
const admin = require('firebase-admin');

const PROJECT = 'demo-chorequest';
const results = [];
const record = (id, ok, detail) => { results.push({ id, ok, detail }); console.log(`RESULT|${id}|${ok ? 'PASS' : 'FAIL'}|${detail}`); };

test('ChoreQuest adversarial QA', { timeout: 900000 }, async (t) => {
  assert.equal(process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT, PROJECT, 'Emulator only');
  const apps = []; let n = 0;
  const client = () => {
    const app = initializeApp({ apiKey: 'demo-key', projectId: PROJECT, authDomain: `${PROJECT}.firebaseapp.com`, storageBucket: `${PROJECT}.appspot.com` }, `qa-adv-${++n}`); apps.push(app);
    const auth = getAuth(app); connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    const db = getFirestore(app); connectFirestoreEmulator(db, '127.0.0.1', 8080);
    const fns = getFunctions(app); connectFunctionsEmulator(fns, '127.0.0.1', 5001);
    return { app, auth, db, call: async (name, data) => (await httpsCallable(fns, name)(data)).data };
  };
  const server = admin.initializeApp({ projectId: PROJECT, storageBucket: `${PROJECT}.appspot.com` }, 'qa-adv-admin'); const sdb = server.firestore();
  // In-process copy of the deployed backend, used only to invoke scheduled jobs directly.
  const backend = require(path.join(__dirname, '../../functions/lib/index.js'));
  const { evaluateFamilies } = require(path.join(__dirname, '../../functions/lib/scheduled/evaluateFamilies.js'));
  const http = async (c, name, body) => { const r = await fetch(`http://127.0.0.1:5001/${PROJECT}/us-central1/${name}`, { method: 'POST', headers: { Authorization: `Bearer ${await c.auth.currentUser.getIdToken()}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return { status: r.status, data: await r.json() }; };
  const waitFor = async (read, check, ms = 15000) => { const end = Date.now() + ms; let last; while (Date.now() < end) { last = await read(); if (check(last)) return last; await new Promise(r => setTimeout(r, 150)); } return last; };
  const settle = (ms = 4000) => new Promise(r => setTimeout(r, ms));
  const outcome = async (p) => { try { return { ok: true, value: await p }; } catch (e) { return { ok: false, code: e.code, message: e.message }; } };
  const pw = crypto.randomBytes(18).toString('base64url');

  // ── Fixture: the five-member family described in the brief (emulator copy) ──
  const alex = client(), jamie = client(), stranger = client();
  const stamp = Date.now();
  const alexUser = (await createUserWithEmailAndPassword(alex.auth, `alex-${stamp}@example.test`, pw)).user;
  const { familyId } = await alex.call('setupFamily', { familyName: 'ChoreQuest Test Family', timezone: 'America/New_York', child: { nickname: 'Mia', ageGroup: '3-5', avatarId: 'avatar-06', pin: '1470' }, childRewards: [{ name: 'Bedtime story', starCost: 5 }, { name: 'Sticker', starCost: 5 }] });
  const mia = (await getDocs(collection(alex.db, 'families', familyId, 'childProfiles'))).docs[0].id;
  const leo = (await alex.call('createChildProfile', { familyId, nickname: 'Leo', ageGroup: '6-8', avatarId: 'avatar-07', pin: '2580' })).childId;
  const jamieUser = (await createUserWithEmailAndPassword(jamie.auth, `jamie-${stamp}@example.test`, pw)).user;
  const jp = { familyAccountId: familyId, firebaseUid: jamieUser.uid, displayName: 'Jamie Test', avatarId: 'default-parent', starBalance: 0, totalStarsEarned: 0, totalStarsRedeemed: 0, createdAt: admin.firestore.Timestamp.now() };
  await sdb.doc(`families/${familyId}/parentUsers/${jamieUser.uid}`).set(jp); await sdb.doc(`parentProfiles/${jamieUser.uid}`).set(jp);
  await sdb.doc(`families/${familyId}`).update({ memberIds: [alexUser.uid, jamieUser.uid] });
  const ava = (await jamie.call('createChildProfile', { familyId, nickname: 'Ava', ageGroup: '12-14', avatarId: 'avatar-14', pin: '3690' })).childId;
  const strangerUser = (await createUserWithEmailAndPassword(stranger.auth, `stranger-${stamp}@example.test`, pw)).user;
  const other = await stranger.call('setupFamily', { familyName: 'Other Family', timezone: 'Europe/London', child: { nickname: 'Zed', ageGroup: '9-11', avatarId: 'avatar-02', pin: '4444' } });
  const kids = {};
  const childLogin = async (childId, pin, via = alex) => {
    const v = await http(via, 'verifyChildPin', { familyId, childProfileId: childId, pin });
    if (v.status !== 200) throw Object.assign(new Error(`PIN ${v.status} ${JSON.stringify(v.data)}`), { status: v.status, data: v.data });
    const c = client(); await signInWithCustomToken(c.auth, v.data.customToken);
    return { c, ctx: { familyId, childId, sessionToken: v.data.sessionToken.token } };
  };
  kids.mia = await childLogin(mia, '1470'); kids.leo = await childLogin(leo, '2580'); kids.ava = await childLogin(ava, '3690');
  let taskN = 0;
  const makeTask = async (extra = {}, id = `qa-task-${++taskN}`) => { await setDoc(doc(alex.db, 'families', familyId, 'tasks', id), { familyAccountId: familyId, title: `QA ${id}`, category: 'Household', starValue: 5, difficulty: 'Easy', isActive: true, requiresPhoto: false, isMilestone: false, recurrenceType: 'none', createdByParentId: alexUser.uid, createdAt: Timestamp.now(), ...extra }); return id; };
  const childDoc = async (id) => (await sdb.doc(`families/${familyId}/childProfiles/${id}`).get()).data();
  const setBalance = (id, stars) => sdb.doc(`families/${familyId}/childProfiles/${id}`).update({ starBalance: stars });
  const clearQuest = (id) => sdb.doc(`families/${familyId}/childProfiles/${id}`).update({ activeQuestId: admin.firestore.FieldValue.delete() });
  const sub = async (name, fn) => t.test(name, async () => { try { await fn(); } catch (e) { record(name.split(' ')[0], false, `harness error: ${e.message}`); throw e; } });

  try {
    // ════════════════ Scheduler robustness / multi-tenant isolation ════════════════
    await sub('S01 rules-refuse-invalid-family-timezone', async () => {
      const r = await outcome(updateDoc(doc(stranger.db, 'families', other.familyId), { timezone: 'Not/AZone' }));
      record('S01', !r.ok, r.ok ? 'Any parent can write an arbitrary timezone string to their family document (rules only check affectedKeys).' : 'Denied');
      if (r.ok) await updateDoc(doc(stranger.db, 'families', other.familyId), { timezone: 'Europe/London' });
      assert.ok(!r.ok, 'invalid timezone accepted');
    });

    const twoDaysAgo = admin.firestore.Timestamp.fromMillis(Date.now() - 2 * 86400000);
    const recurring = await makeTask({ title: 'Make bed', recurrenceType: 'daily' }, 'qa-daily-make-bed');
    await sdb.doc(`families/${familyId}/tasks/${recurring}`).update({ createdAt: twoDaysAgo });
    const countInstances = async () => (await sdb.collection(`families/${familyId}/tasks`).where('sourceTaskId', '==', recurring).get()).size;

    await sub('S02 one-bad-family-must-not-stop-recurrence-for-others', async () => {
      // A family whose doc id sorts first and whose timezone is garbage (writable via rules, see S01).
      await sdb.doc('families/00-bad-timezone').set({ familyName: 'Bad TZ', ownerUid: 'x', memberIds: ['x'], timezone: 'Not/AZone', isDeleted: false, createdAt: admin.firestore.Timestamp.now() });
      const run = await outcome(backend.dailyRecurrenceGenerate.run({}));
      const made = await countInstances();
      await sdb.doc('families/00-bad-timezone').delete();
      record('S02', run.ok && made === 1, `job ${run.ok ? 'completed' : 'threw: ' + run.message}; daily instances created for the healthy family: ${made}`);
      assert.ok(run.ok && made === 1);
    });

    await sub('S03 one-bad-family-must-not-stop-weekly-evaluation-for-others', async () => {
      await sdb.doc(`families/${familyId}/childProfiles/${mia}`).update({ createdAt: admin.firestore.Timestamp.fromMillis(Date.now() - 40 * 86400000) });
      await sdb.doc('families/00-bad-timezone').set({ familyName: 'Bad TZ', ownerUid: 'x', memberIds: ['x'], timezone: 'Not/AZone', isDeleted: false, createdAt: admin.firestore.Timestamp.now() });
      const run = await outcome(evaluateFamilies('weekly', new Date()));
      const logs = (await sdb.collection(`families/${familyId}/accountabilityLogs`).get()).size;
      await sdb.doc('families/00-bad-timezone').delete();
      record('S03', run.ok && logs > 0, `weekly evaluation ${run.ok ? 'completed' : 'threw: ' + run.message}; accountability logs written for healthy family: ${logs}`);
      assert.ok(run.ok && logs > 0);
    });

    await sub('S04 one-malformed-recurring-task-must-not-stop-recurrence-for-others', async () => {
      // A parent in ANOTHER family stores a recurring quest with a non-numeric star value (allowed by rules).
      const w = await outcome(setDoc(doc(stranger.db, 'families', other.familyId, 'tasks', 'evil'), { familyAccountId: other.familyId, title: 'Evil', category: 'Household', starValue: 'lots', isActive: true, recurrenceType: 'weekly', createdAt: Timestamp.fromMillis(Date.now() - 20 * 86400000) }));
      const before = (await sdb.collection(`families/${familyId}/tasks`).get()).size;
      await makeTask({ title: 'Water plants', recurrenceType: 'weekly' }, 'qa-weekly-plants');
      await sdb.doc(`families/${familyId}/tasks/qa-weekly-plants`).update({ createdAt: admin.firestore.Timestamp.fromMillis(Date.now() - 20 * 86400000) });
      // Make sure the malformed family is processed first.
      const order = [other.familyId, familyId].sort();
      const run = await outcome(backend.weeklyRecurrenceGenerate.run({}));
      const made = (await sdb.collection(`families/${familyId}/tasks`).where('sourceTaskId', '==', 'qa-weekly-plants').get()).size;
      await sdb.doc(`families/${other.familyId}/tasks/evil`).delete();
      record('S04', w.ok === false || (run.ok && made === 1), `rules ${w.ok ? 'ACCEPTED' : 'refused'} starValue:"lots"; job ${run.ok ? 'completed' : 'threw: ' + run.message}; healthy family instance created: ${made} (malformed family sorts ${order[0] === other.familyId ? 'first' : 'second'})`);
      assert.ok(w.ok === false || (run.ok && made === 1));
    });

    await sub('S05 missed-daily-quests-must-not-pile-up', async () => {
      const RealDate = Date; const base = RealDate.now();
      const runAt = async (offsetDays) => {
        const fake = base + offsetDays * 86400000;
        global.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [fake])); } static now() { return fake; } };
        try { await backend.dailyRecurrenceGenerate.run({}); } finally { global.Date = RealDate; }
      };
      await runAt(1); await runAt(2); await runAt(3);
      const active = (await sdb.collection(`families/${familyId}/tasks`).where('sourceTaskId', '==', recurring).where('isActive', '==', true).get()).size;
      record('S05', active <= 1, `After 4 days with nobody doing "Make bed", ${active} separate active "Make bed" quests are claimable after prior occurrences expire.`);
      assert.ok(active <= 1);
    });

    // ════════════════ Award pipeline robustness ════════════════
    await sub('S06 invalid-milestone-rejected-and-legacy-award-frees-child', async () => {
      const invalid = {title:'Bad legacy reward',category:'Household',isActive:true,isMilestone:true,milestoneSteps:1,starsPerStep:20000,milestoneBonus:0,starValue:10};
      const refused=await outcome(makeTask(invalid,'qa-invalid-write'));assert.equal(refused.ok,false,'Rules must refuse the bad reward before claim');
      await clearQuest(leo);
      // Admin-only corruption tests the defensive path for data written before validation.
      await sdb.doc(`families/${familyId}/tasks/legacy-bad`).set({...invalid,activeClaimId:'legacy-bad-claim'});
      await sdb.doc(`families/${familyId}/childProfiles/${leo}`).update({activeQuestId:'legacy-bad-claim'});
      const ref=sdb.doc(`families/${familyId}/taskClaims/legacy-bad-claim`);
      await ref.set({taskId:'legacy-bad',childProfileId:leo,status:'submitted',currentMilestoneStep:1});
      await ref.update({status:'approved'});
      const recovered=await waitFor(async()=>({claim:(await ref.get()).data(),child:await childDoc(leo)}),v=>v.claim.status==='awardFailed' && !v.child.activeQuestId);
      assert.equal(recovered.claim.status,'awardFailed');assert.equal(recovered.child.activeQuestId,undefined);
      const next=await makeTask({title:'Next safe quest'});await kids.leo.c.call('claimChildQuest',{...kids.leo.ctx,taskId:next,operationId:'after-legacy-bad'});
      await kids.leo.c.call('updateChildQuest',{...kids.leo.ctx,claimId:'after-legacy-bad',status:'released'});
      // A v1 approval may have been stuck before the new trigger was deployed.
      await sdb.doc(`families/${familyId}/tasks/legacy-already-approved`).set({...invalid,activeClaimId:'old-approved'});
      await sdb.doc(`families/${familyId}/taskClaims/old-approved`).set({taskId:'legacy-already-approved',childProfileId:leo,status:'approved',currentMilestoneStep:1});
      await sdb.doc(`families/${familyId}/childProfiles/${leo}`).update({activeQuestId:'old-approved'});
      const healthy=await makeTask({title:'Recovery without a new approval event'});
      await kids.leo.c.call('claimChildQuest',{...kids.leo.ctx,taskId:healthy,operationId:'after-old-approved'});
      assert.equal((await sdb.doc(`families/${familyId}/taskClaims/old-approved`).get()).data().status,'awardFailed');
      await kids.leo.c.call('updateChildQuest',{...kids.leo.ctx,claimId:'after-old-approved',status:'released'});
      record('S06',true,'Bad client reward refused; malformed new and pre-existing approvals recovered; child can claim another quest.');
    });

    await sub('S07 rules-refuse-negative-or-non-integer-task-stars', async () => {
      const neg = await outcome(makeTask({ starValue: -50 }));
      const str = await outcome(makeTask({ starValue: 'five' }));
      record('S07', !neg.ok && !str.ok, `Firestore rules accepted starValue -50: ${neg.ok}; accepted "five": ${str.ok}`);
      assert.ok(!neg.ok && !str.ok);
    });

    await sub('S08 past-deadline-quest-must-not-be-claimable', async () => {
      const id = await makeTask({ title: 'Expired chore', deadline: Timestamp.fromMillis(Date.now() - 3 * 86400000) });
      await clearQuest(ava);
      const r = await outcome(kids.ava.c.call('claimChildQuest', { ...kids.ava.ctx, taskId: id, operationId: 'expired-claim' }));
      if (r.ok) await kids.ava.c.call('updateChildQuest', { ...kids.ava.ctx, claimId: 'expired-claim', status: 'released' });
      record('S08', !r.ok, `Quest whose deadline passed 3 days ago: claim ${r.ok ? 'SUCCEEDED (deadline is stored but never enforced by backend or child UI)' : 'refused'}`);
      assert.ok(!r.ok);
    });

    // ════════════════ PIN / session security ════════════════
    await sub('S09 PIN-lockout-blocks-correct-PIN-and-parallel-guesses', async () => {
      const guesses = await Promise.all(['0000', '0001', '0002', '0003', '0004', '0005', '0006', '0007'].map(pin => http(alex, 'verifyChildPin', { familyId, childProfileId: ava, pin })));
      const statuses = guesses.map(g => g.status);
      const correct = await http(alex, 'verifyChildPin', { familyId, childProfileId: ava, pin: '3690' });
      const nonLocked401 = statuses.filter(s => s === 401).length;
      const ok = nonLocked401 <= 2 && correct.status === 403 && correct.data.locked === true;
      record('S09', ok, `8 parallel wrong PINs -> statuses ${JSON.stringify(statuses)}; correct PIN while locked -> ${correct.status} locked=${correct.data.locked}`);
      await sdb.doc(`families/${familyId}/childCredentials/${ava}`).update({ lockedUntil: admin.firestore.Timestamp.fromMillis(Date.now() - 1000), failedPinAttempts: 3 });
      const after = await http(alex, 'verifyChildPin', { familyId, childProfileId: ava, pin: '3690' });
      record('S09b', after.status === 200, `After lockout window expires, correct PIN -> ${after.status}`);
      assert.ok(ok && after.status === 200);
    });

    await sub('S10 PIN-reset-revocation-must-end-child-mode-on-that-device', async () => {
      const leoDevice = await childLogin(leo, '2580');
      await alex.call('resetChildPin', { familyId, childId: leo, pin: '2581' });
      const oldSession = await outcome(leoDevice.c.call('getChildRequestCount', leoDevice.ctx));
      const sibling = await http(leoDevice.c, 'verifyChildPin', { familyId, childProfileId: mia, pin: '1470' });
      record('S10', !oldSession.ok && sibling.status !== 200, `After parent reset Leo's PIN: Leo's old session -> ${oldSession.ok ? 'still valid' : 'rejected'}; the same revoked child device can still open Mia with Mia's PIN -> HTTP ${sibling.status} (source-session revocation is checked before sibling delegation)`);
      await alex.call('resetChildPin', { familyId, childId: leo, pin: '2580' });
      kids.leo = await childLogin(leo, '2580');
      assert.ok(!oldSession.ok && sibling.status !== 200);
      const expiredDevice=await childLogin(leo,'2580');
      const tokenClaims=(await expiredDevice.c.auth.currentUser.getIdTokenResult()).claims;
      await sdb.doc(`families/${familyId}/childSessions/${tokenClaims.sessionHash}`).update({expiresAt:admin.firestore.Timestamp.fromMillis(0)});
      const expiredSibling=await http(expiredDevice.c,'verifyChildPin',{familyId,childProfileId:mia,pin:'1470'});
      const renewSelf=await http(expiredDevice.c,'verifyChildPin',{familyId,childProfileId:leo,pin:'2580'});
      assert.equal(expiredSibling.status,403);assert.equal(renewSelf.status,200);
      record('S10b',true,'Expired child source cannot open a sibling; fresh correct own PIN can renew the same profile.');
    });

    await sub('S11 child-cannot-read-credentials-sessions-or-other-parent-mappings', async () => {
      const creds = await outcome(getDoc(doc(kids.mia.c.db, 'families', familyId, 'childCredentials', mia)));
      const sessions = await outcome(getDocs(collection(kids.mia.c.db, 'families', familyId, 'childSessions')));
      const mapping = await outcome(getDoc(doc(kids.mia.c.db, 'parentProfiles', alexUser.uid)));
      const parentSessions = await outcome(getDocs(collection(alex.db, 'families', familyId, 'childSessions')));
      const ok = !creds.ok && !sessions.ok && !mapping.ok && !parentSessions.ok;
      record('S11', ok, `child read credentials:${creds.ok} sessions:${sessions.ok} parent mapping:${mapping.ok}; parent read sessions:${parentSessions.ok}`);
      assert.ok(ok);
    });

    await sub('S12 cross-family-isolation', async () => {
      const a = await outcome(stranger.call('reviewChildQuests', { familyId, claimIds: ['x'], decision: 'approved' }));
      const b = await outcome(stranger.call('adjustChildStars', { familyId, childId: mia, amount: 50, type: 'bonusStar', reason: 'x', operationId: 'x1' }));
      const c = await http(stranger, 'exportFamilyData', { familyId });
      const d = await outcome(getDocs(collection(stranger.db, 'families', familyId, 'childProfiles')));
      const e = await http(stranger, 'verifyChildPin', { familyId, childProfileId: mia, pin: '1470' });
      const f = await outcome(kids.mia.c.call('claimChildQuest', { familyId: other.familyId, childId: mia, taskId: 'x', operationId: 'x2', sessionToken: kids.mia.ctx.sessionToken }));
      const ok = !a.ok && !b.ok && c.status === 403 && !d.ok && e.status === 403 && !f.ok;
      record('S12', ok, `stranger review:${a.ok} bonus:${b.ok} export:${c.status} read kids:${d.ok} PIN:${e.status}; Mia session in other family:${f.ok}`);
      assert.ok(ok);
    });

    await sub('S13 sibling-session-cannot-act-as-another-child', async () => {
      const id = await makeTask({ title: 'Impersonation bait' });
      const a = await outcome(kids.leo.c.call('claimChildQuest', { ...kids.leo.ctx, childId: mia, taskId: id, operationId: 'imp-1' }));
      const reward = (await getDocs(collection(alex.db, 'families', familyId, 'rewards'))).docs[0].id;
      await setBalance(mia, 50);
      const b = await outcome(kids.leo.c.call('requestChildRedemption', { ...kids.leo.ctx, childId: mia, rewardId: reward, operationId: 'imp-2' }));
      const req = (await kids.ava.c.call('createFamilyRequest', { ...kids.ava.ctx, title: 'Help with reading', category: 'Learning', suggestedStars: 5, operationId: 'ava-req-1' })).requestId;
      await jamie.call('updateFamilyRequest', { familyId, requestId: req, status: 'accepted', agreedStars: 5 });
      await jamie.call('updateFamilyRequest', { familyId, requestId: req, status: 'completed' });
      const c = await outcome(kids.leo.c.call('updateFamilyRequest', { ...kids.leo.ctx, requestId: req, status: 'confirmed' }));
      const d = await outcome(alex.call('updateFamilyRequest', { familyId, requestId: req, status: 'confirmed' }));
      await setBalance(mia, 0);
      const ok = !a.ok && !b.ok && !c.ok && !d.ok;
      record('S13', ok, `Leo claiming as Mia:${a.ok} Leo redeeming Mia's stars:${b.ok} Leo confirming Ava's request:${c.ok} parent confirming child's request:${d.ok}`);
      await kids.ava.c.call('updateFamilyRequest', { ...kids.ava.ctx, requestId: req, status: 'confirmed' });
      const j = await waitFor(async () => (await sdb.doc(`families/${familyId}/parentUsers/${jamieUser.uid}`).get()).data(), x => x.starBalance === 5);
      record('S13b', j.starBalance === 5, `Ava confirms -> Jamie (accepting parent) awarded ${j.starBalance} stars`);
      assert.ok(ok && j.starBalance === 5);
    });

    // ════════════════ Concurrency / double-spend ════════════════
    await sub('S14 two-siblings-claim-same-quest-simultaneously', async () => {
      const id = await makeTask({ title: 'Race quest' });
      await Promise.all([clearQuest(mia), clearQuest(ava)]);
      const [x, y] = await Promise.all([outcome(kids.mia.c.call('claimChildQuest', { ...kids.mia.ctx, taskId: id, operationId: 'race-mia' })), outcome(kids.ava.c.call('claimChildQuest', { ...kids.ava.ctx, taskId: id, operationId: 'race-ava' }))]);
      const claims = (await sdb.collection(`families/${familyId}/taskClaims`).where('taskId', '==', id).get()).size;
      record('S14', [x.ok, y.ok].filter(Boolean).length === 1 && claims === 1, `Mia:${x.ok} Ava:${y.ok}; claims stored:${claims}`);
      for (const [k, cid] of [['mia', 'race-mia'], ['ava', 'race-ava']]) await outcome(kids[k].c.call('updateChildQuest', { ...kids[k].ctx, claimId: cid, status: 'released' }));
      assert.equal(claims, 1);
    });

    await sub('S15 concurrent-redemption-approvals-cannot-overspend', async () => {
      await setBalance(mia, 5);
      const rewards = (await getDocs(collection(alex.db, 'families', familyId, 'rewards'))).docs.map(d => d.id);
      const r1 = (await kids.mia.c.call('requestChildRedemption', { ...kids.mia.ctx, rewardId: rewards[0], operationId: 'ds-1' })).redemptionId;
      const r2 = (await kids.mia.c.call('requestChildRedemption', { ...kids.mia.ctx, rewardId: rewards[1], operationId: 'ds-2' })).redemptionId;
      const [a, b] = await Promise.all([outcome(alex.call('reviewChildRedemption', { familyId, redemptionId: r1, status: 'approved' })), outcome(jamie.call('reviewChildRedemption', { familyId, redemptionId: r2, status: 'approved' }))]);
      const bal = (await childDoc(mia)).starBalance;
      record('S15', [a.ok, b.ok].filter(Boolean).length === 1 && bal === 0, `Mia (5★) asked for two 5★ rewards; both parents approved at once -> approvals succeeded: ${[a.ok, b.ok]}; balance ${bal}`);
      assert.ok(bal === 0 && [a.ok, b.ok].filter(Boolean).length === 1);
    });

    await sub('S16 weekly-request-quota-under-parallel-submits', async () => {
      await sdb.doc(`families/${familyId}/settings/config`).set({ weeklyRequestLimitPerChild: { [leo]: 3 } }, { merge: true });
      const rs = await Promise.all([1, 2, 3, 4, 5, 6].map(i => outcome(kids.leo.c.call('createFamilyRequest', { ...kids.leo.ctx, title: `Ask ${i}`, category: 'Hobbies', suggestedStars: 1, operationId: `quota-${i}` }))));
      const created = (await sdb.collection(`families/${familyId}/familyRequests`).where('requestedByChildId', '==', leo).get()).size;
      record('S16', created <= 3, `6 simultaneous requests with a limit of 3 -> ${rs.filter(r => r.ok).length} accepted, ${created} stored`);
      assert.ok(created <= 3);
    });

    await sub('S17 milestone-release-resumes-without-replaying-a-paid-step', async () => {
      const id=await makeTask({title:'Build a model',isMilestone:true,milestoneSteps:3,starsPerStep:4,milestoneBonus:2});
      await clearQuest(ava);await setBalance(ava,0);
      await kids.ava.c.call('claimChildQuest',{...kids.ava.ctx,taskId:id,operationId:'ms-a'});
      await kids.ava.c.call('updateChildQuest',{...kids.ava.ctx,claimId:'ms-a',status:'submitted'});
      await jamie.call('reviewChildQuests',{familyId,claimIds:['ms-a'],decision:'approved'});
      await waitFor(async()=>(await sdb.doc(`families/${familyId}/taskClaims/ms-a`).get()).data(),v=>v.status==='claimed' && v.currentMilestoneStep===2);
      await kids.ava.c.call('updateChildQuest',{...kids.ava.ctx,claimId:'ms-a',status:'released'});
      await kids.ava.c.call('claimChildQuest',{...kids.ava.ctx,taskId:id,operationId:'ms-b'});
      assert.equal((await sdb.doc(`families/${familyId}/taskClaims/ms-b`).get()).data().currentMilestoneStep,2,'Reclaim must resume step two');
      assert.equal((await childDoc(ava)).starBalance,4,'Reclaim itself must not award stars');
      await kids.ava.c.call('updateChildQuest',{...kids.ava.ctx,claimId:'ms-b',status:'submitted'});
      await jamie.call('reviewChildQuests',{familyId,claimIds:['ms-b'],decision:'approved'});
      await waitFor(async()=>childDoc(ava),v=>v.starBalance===8);
      assert.equal((await childDoc(ava)).starBalance,8,'Two distinct paid steps earn eight, not a replay of step one');
      const entries=(await sdb.collection(`families/${familyId}/starTransactions`).where('childProfileId','==',ava).get()).docs.map(d=>d.data()).filter(v=>['ms-a','ms-b'].includes(v.taskClaimId));
      assert.deepEqual(entries.map(v=>v.milestoneStep).sort(),[1,2]);
      await kids.ava.c.call('updateChildQuest',{...kids.ava.ctx,claimId:'ms-b',status:'released'});
      record('S17',true,'Release/reclaim retains paid progress: one step-one award and one distinct step-two award.');
    });

    // ════════════════ Evaluation correctness (DST, targets, consequences) ════════════════
    await sub('S18 weekly-evaluation-across-DST-end', async () => {
      // America/New_York DST ends Sun 2026-11-01 02:00. Week Mon 2026-10-26 .. Sun 2026-11-01.
      const kid = (await alex.call('createChildProfile', { familyId, nickname: 'Dst', ageGroup: '6-8', avatarId: 'avatar-03', pin: '1111' })).childId;
      await sdb.doc(`families/${familyId}/childProfiles/${kid}`).update({ createdAt: admin.firestore.Timestamp.fromDate(new Date('2026-10-01T00:00:00Z')), weeklyTargetStars: 10 });
      const tx = (id, iso, stars) => sdb.doc(`families/${familyId}/starTransactions/${id}`).set({ familyAccountId: familyId, childProfileId: kid, deltaStars: stars, transactionType: 'taskApproval', createdAt: admin.firestore.Timestamp.fromDate(new Date(iso)) });
      await tx('dst-in-1', '2026-10-26T04:30:00Z', 4);  // Mon 00:30 EDT -> in week
      await tx('dst-in-2', '2026-11-02T04:30:00Z', 6);  // Sun 23:30 EST -> in week
      await tx('dst-out', '2026-11-02T05:30:00Z', 50);  // Mon 00:30 EST -> next week
      await evaluateFamilies('weekly', new Date('2026-11-02T12:00:00Z'));
      const log = (await sdb.doc(`families/${familyId}/accountabilityLogs/weekly-2026-10-26-${kid}`).get()).data();
      record('S18', log && log.starsEarned === 10 && log.met === true, `Week of 2026-10-26 (DST end) -> starsEarned ${log?.starsEarned}, met ${log?.met}`);
      await evaluateFamilies('weekly', new Date('2026-11-02T18:00:00Z'));
      const logs = (await sdb.collection(`families/${familyId}/accountabilityLogs`).where('childProfileId', '==', kid).get()).size;
      record('S18b', logs === 1, `Re-running evaluation for same week -> ${logs} log(s)`);
      assert.ok(log && log.starsEarned === 10 && logs === 1);
    });

    await sub('S19 missed-target-activates-consequence-and-parent-can-clear', async () => {
      const kid = (await alex.call('createChildProfile', { familyId, nickname: 'Miss', ageGroup: '9-11', avatarId: 'avatar-04', pin: '2222' })).childId;
      await sdb.doc(`families/${familyId}/childProfiles/${kid}`).update({ createdAt: admin.firestore.Timestamp.fromDate(new Date('2026-09-01T00:00:00Z')) });
      await setDoc(doc(alex.db, 'families', familyId, 'consequenceDefinitions', 'yellow-' + kid), { familyAccountId: familyId, childProfileId: kid, level: 'Yellow', name: 'No tablet Saturday', description: '' });
      await evaluateFamilies('weekly', new Date('2026-10-05T12:00:00Z'));
      const active = (await sdb.collection(`families/${familyId}/activeConsequences`).where('childProfileId', '==', kid).get()).docs;
      const cleared = active.length ? await outcome(jamie.call('clearConsequence', { familyId, consequenceId: active[0].id })) : { ok: false };
      const childTry = active.length ? await outcome(kids.mia.c.call('clearConsequence', { familyId, consequenceId: active[0].id })) : { ok: true };
      record('S19', active.length === 1 && cleared.ok && !childTry.ok, `0★ vs 20★ target -> consequences activated: ${active.length} (${active[0]?.data().name}); parent clear:${cleared.ok}; child clear:${childTry.ok}`);
      assert.ok(active.length === 1 && cleared.ok && !childTry.ok);
    });

    // ════════════════ Data-quality limits enforced only in the UI ════════════════
    await sub('S20 rules-limit-profile-and-family-text-length', async () => {
      const long = 'x'.repeat(5000);
      const a = await outcome(updateDoc(doc(alex.db, 'families', familyId, 'childProfiles', mia), { nickname: long }));
      const b = await outcome(updateDoc(doc(alex.db, 'families', familyId), { familyName: long }));
      const c = await outcome(updateDoc(doc(alex.db, 'families', familyId, 'childProfiles', mia), { weeklyTargetStars: 'twenty' }));
      if (a.ok) await updateDoc(doc(alex.db, 'families', familyId, 'childProfiles', mia), { nickname: 'Mia' });
      if (b.ok) await updateDoc(doc(alex.db, 'families', familyId), { familyName: 'ChoreQuest Test Family' });
      if (c.ok) await updateDoc(doc(alex.db, 'families', familyId, 'childProfiles', mia), { weeklyTargetStars: 20 });
      record('S20', !a.ok && !b.ok && !c.ok, `rules accepted 5000-char nickname:${a.ok}, 5000-char family name:${b.ok}, non-numeric weekly target:${c.ok}`);
      assert.ok(!a.ok && !b.ok && !c.ok);
    });

    await sub('S21 deactivated-quest-in-progress', async () => {
      const id = await makeTask({ title: 'Will be cancelled' }); await clearQuest(mia);
      await kids.mia.c.call('claimChildQuest', { ...kids.mia.ctx, taskId: id, operationId: 'cancel-1' });
      await updateDoc(doc(alex.db, 'families', familyId, 'tasks', id), { isActive: false });
      const submit = await outcome(kids.mia.c.call('updateChildQuest', { ...kids.mia.ctx, claimId: 'cancel-1', status: 'submitted' }));
      const release = await outcome(kids.mia.c.call('updateChildQuest', { ...kids.mia.ctx, claimId: 'cancel-1', status: 'released' }));
      const after = await childDoc(mia);
      record('S21', !submit.ok && release.ok && !after.activeQuestId, `Parent archives a quest mid-progress: submit -> ${submit.ok ? 'accepted' : 'refused'}, release -> ${release.ok}, child freed:${!after.activeQuestId}`);
      assert.ok(!submit.ok && release.ok && !after.activeQuestId);
    });

    await sub('S22 star-adjustments-bounds-and-idempotency', async () => {
      await setBalance(leo, 10);
      const big = await outcome(alex.call('adjustChildStars', { familyId, childId: leo, amount: 10001, type: 'bonusStar', reason: 'x', operationId: 'adj-big' }));
      await alex.call('adjustChildStars', { familyId, childId: leo, amount: 25, type: 'deduction', reason: 'Broke a rule', operationId: 'adj-ded' });
      await alex.call('adjustChildStars', { familyId, childId: leo, amount: 25, type: 'deduction', reason: 'Broke a rule', operationId: 'adj-ded' });
      const bal = (await childDoc(leo)).starBalance;
      const ledger = (await sdb.doc(`families/${familyId}/starTransactions/adjust-adj-ded`).get()).data();
      record('S22', !big.ok && bal === 0 && ledger.deltaStars === -10, `bonus 10001 refused:${!big.ok}; 25★ deduction from 10★ twice (same op id) -> balance ${bal}, ledger delta ${ledger.deltaStars}`);
      assert.ok(!big.ok && bal === 0 && ledger.deltaStars === -10);
    });

    await sub('S23 first-quest-badge-awarded-once', async () => {
      const id = await makeTask({ title: 'Badge quest' }); await clearQuest(mia);
      await kids.mia.c.call('claimChildQuest', { ...kids.mia.ctx, taskId: id, operationId: 'badge-1' });
      await kids.mia.c.call('updateChildQuest', { ...kids.mia.ctx, claimId: 'badge-1', status: 'submitted' });
      await alex.call('reviewChildQuests', { familyId, claimIds: ['badge-1'], decision: 'approved' });
      await alex.call('reviewChildQuests', { familyId, claimIds: ['badge-1'], decision: 'approved' });
      const ach = await waitFor(async () => (await sdb.collection(`families/${familyId}/achievements`).get()).docs.map(d => d.data()).filter(a => a.childProfileId === mia), x => x.length > 0);
      const first = ach.filter(a => /first/i.test(a.badgeId || a.badgeName || a.name || '')).length;
      record('S23', first === 1, `Mia achievements after first approved quest: ${JSON.stringify(ach.map(a => a.badgeId || a.name))}`);
      assert.equal(first, 1);
    });

    await sub('S24 export-has-family-but-no-secrets', async () => {
      const e = await http(jamie, 'exportFamilyData', { familyId });
      const s = JSON.stringify(e.data);
      const ok = e.status === 200 && !/pinHash|childSessions|childCredentials|sessionToken/.test(s) && e.data.data.parentUsers.length === 2;
      record('S24', ok, `export status ${e.status}, ${s.length} bytes, parents ${e.data.data.parentUsers.length}, children ${e.data.data.childProfiles.length}, secret fields present: ${/pinHash|childSessions|sessionToken/.test(s)}`);
      assert.ok(ok);
    });

    await sub('S25 owner-deletion-must-not-delete-co-parent-login', async () => {
      // Separate scratch family so the main fixture stays intact.
      const o = client(), co = client();
      const ou = (await createUserWithEmailAndPassword(o.auth, `own-${stamp}@example.test`, pw)).user;
      const f = (await o.call('setupFamily', { familyName: 'Delete me', timezone: 'UTC' })).familyId;
      const cu = (await createUserWithEmailAndPassword(co.auth, `co-${stamp}@example.test`, pw)).user;
      const p = { familyAccountId: f, firebaseUid: cu.uid, displayName: 'Co', avatarId: 'default-parent', starBalance: 0, totalStarsEarned: 0, totalStarsRedeemed: 0, createdAt: admin.firestore.Timestamp.now() };
      await sdb.doc(`families/${f}/parentUsers/${cu.uid}`).set(p); await sdb.doc(`parentProfiles/${cu.uid}`).set(p);
      const del = await http(o, 'deleteFamilyAccount', { familyId: f, confirmText: 'DELETE' });
      await sdb.doc(`familyDeletionQueue/${f}`).update({ purgeAfter: admin.firestore.Timestamp.fromMillis(Date.now() - 1000) });
      const purge = await outcome(backend.purgeDeletedFamilies.run({}));
      const coExists = await outcome(server.auth().getUser(cu.uid));
      const ownerExists = await outcome(server.auth().getUser(ou.uid));
      record('S25', coExists.ok, `owner delete -> ${del.status}; purge ${purge.ok ? 'ran' : 'failed: ' + purge.message}; owner login exists:${ownerExists.ok}; CO-PARENT login exists:${coExists.ok} (co-parent was never asked)`);
      assert.ok(coExists.ok);
    });
  } finally {
    require('node:fs').writeFileSync(path.join(__dirname, '../../work/remediation-adversarial-results.json'), JSON.stringify(results, null, 1));
    for (const a of apps) await deleteApp(a).catch(() => {});
    await server.delete().catch(() => {});
  }
});
