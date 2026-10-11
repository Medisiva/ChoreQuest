const test = require('node:test'); const assert = require('node:assert/strict'); const fs = require('node:fs');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, setDoc, updateDoc, getDoc, Timestamp } = require('firebase/firestore');
const { ref, uploadBytes, getBytes } = require('firebase/storage');
let env;
test.before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-chorequest', firestore: { rules: fs.readFileSync('firestore.rules', 'utf8') }, storage: { rules: fs.readFileSync('storage.rules', 'utf8') } });
});
test.after(async () => { if (env) await env.cleanup(); });
test.beforeEach(async () => {
  await env.clearFirestore(); await env.clearStorage();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'families/f'), { isDeleted: false, familyName: 'Family', memberIds: ['p'] });
    await setDoc(doc(db, 'families/f/parentUsers/p'), { displayName: 'Parent', starBalance: 10 });
    await setDoc(doc(db, 'families/f/childProfiles/c'), { nickname: 'Kid', starBalance: 10, pinHash: 'legacy-private' });
    await setDoc(doc(db, 'families/f/childCredentials/c'), { pinHash: 'private' });
    await setDoc(doc(db, 'parentProfiles/p'), { familyAccountId: 'f' });
    await setDoc(doc(db, 'families/f/settings/config'), { leaderboardEnabled: true });
    await setDoc(doc(db, 'families/f/tasks/t'), { familyAccountId:'f',title: 'Tidy',category:'Household',starValue:5,isMilestone:false, isActive: true, activeClaimId: 'claim' });
  });
});
test('parents read their mapping and family; anonymous and other-family users cannot', async () => {
  const parent = env.authenticatedContext('p').firestore(); const other = env.authenticatedContext('other').firestore();
  await assertSucceeds(getDoc(doc(parent, 'parentProfiles/p')));
  await assertSucceeds(getDoc(doc(parent, 'families/f')));
  await assertSucceeds(getDoc(doc(parent, 'families/f/settings/config')));
  await assertFails(getDoc(doc(other, 'parentProfiles/p')));
  await assertFails(getDoc(doc(other, 'families/f/childProfiles/c')));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'families/f')));
});
test('profile appearance edits succeed; credentials, balances and membership are server-owned', async () => {
  const db = env.authenticatedContext('p').firestore();
  await assertFails(updateDoc(doc(db, 'families/f/childProfiles/c'), { nickname: 'New name' })); // Names go through canonical server uniqueness checks.
  await assertSucceeds(updateDoc(doc(db, 'families/f/childProfiles/c'), { progressDisplayStyle: 'Countdown' }));
  await assertFails(updateDoc(doc(db, 'families/f/childProfiles/c'), { starBalance: 999 }));
  await assertFails(updateDoc(doc(db, 'families/f/childProfiles/c'), { pinHash: 'fake' }));
  await assertFails(getDoc(doc(db, 'families/f/childCredentials/c')));
  await assertFails(setDoc(doc(db, 'families/f/parentUsers/other'), { starBalance: 0 }));
  await assertFails(updateDoc(doc(db, 'families/f'), { memberIds: ['p', 'other'] }));
  await assertFails(setDoc(doc(db, 'families/new'), { isDeleted: false }));
});
test('claim, ledger, redemption and request writes are refused; task lock cannot be edited', async () => {
  const db = env.authenticatedContext('p').firestore();
  for (const path of ['taskClaims/claim', 'starTransactions/tx', 'redemptions/r', 'familyRequests/r', 'childSessions/s', 'familyDeletionQueue/job']) {
    await assertFails(setDoc(doc(db, `families/f/${path}`), { status: 'approved' }));
  }
  await assertSucceeds(updateDoc(doc(db, 'families/f/tasks/t'), { title: 'Tidy again' }));
  await assertFails(updateDoc(doc(db, 'families/f/tasks/t'), { activeClaimId: 'fake' }));
  await assertFails(updateDoc(doc(db, 'families/f/tasks/t'), { starValue: 999 }));
  await assertFails(updateDoc(doc(db, 'families/f/tasks/t'), { requiresPhoto: true }));
});
test('storage rejects other families, nonimages, and oversized photos', async () => {
  const parent = env.authenticatedContext('p').storage(); const other = env.authenticatedContext('other').storage();
  const photo = 'families/f/taskProofs/claim/proof.jpg';
  await assertSucceeds(uploadBytes(ref(parent, photo), new Uint8Array([1, 2, 3]), { contentType: 'image/jpeg' }));
  await assertFails(getBytes(ref(other, photo)));
  await assertFails(uploadBytes(ref(other, photo), new Uint8Array([1]), { contentType: 'image/jpeg' }));
  await assertFails(uploadBytes(ref(parent, photo), new Uint8Array([1]), { contentType: 'text/plain' }));
  await assertFails(uploadBytes(ref(parent, photo), new Uint8Array(5 * 1024 * 1024), { contentType: 'image/jpeg' }));
});
test('soft deletion blocks existing authenticated family access in Firestore and Storage', async () => {
  await env.withSecurityRulesDisabled(async (context) => updateDoc(doc(context.firestore(), 'families/f'), { isDeleted: true }));
  const context = env.authenticatedContext('p');
  await assertFails(getDoc(doc(context.firestore(), 'families/f')));
  await assertFails(updateDoc(doc(context.firestore(), 'families/f/childProfiles/c'), { nickname: 'Other' }));
  await assertFails(uploadBytes(ref(context.storage(), 'families/f/taskProofs/claim/proof.jpg'), new Uint8Array([1]), { contentType: 'image/jpeg' }));
  assert.ok(true);
});

test('restricted child session can read family but cannot perform parent writes; expiry/reset block reads', async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'families/f/childSessions/hash'), { childAuthUid: 'child-c', childProfileId: 'c', parentUid: 'p', createdAt: Timestamp.fromMillis(Date.now() - 1000), expiresAt: Timestamp.fromMillis(Date.now() + 60000) });
    await setDoc(doc(db, 'families/f/taskClaims/own'), { childProfileId: 'c', status: 'claimed' });
    await setDoc(doc(db, 'families/f/taskClaims/sibling'), { childProfileId: 'other', status: 'claimed' });
  });
  const child = env.authenticatedContext('child-c', { role: 'child', familyId: 'f', childProfileId: 'c', sessionHash: 'hash' });
  const db = child.firestore();
  await assertSucceeds(getDoc(doc(db, 'families/f')));
  for (const [path, payload] of [['tasks/t', { title: 'Attack' }], ['childProfiles/c', { weeklyTargetStars: 1 }], ['parentUsers/p', { displayName: 'Attack' }], ['rewards/r', { starCost: 1 }], ['activeConsequences/cons', { clearedByParentAt: Timestamp.now() }]]) await assertFails(setDoc(doc(db, `families/f/${path}`), payload, { merge: true }));
  await assertFails(getDoc(doc(db, 'families/f/childCredentials/c')));
  await assertFails(getDoc(doc(db, 'families/f/childProfiles/c'))); // Legacy public PIN hash is never readable in child mode.
  await assertFails(getDoc(doc(db, 'families/other')));
  await assertSucceeds(uploadBytes(ref(child.storage(), 'families/f/taskProofs/own/proof.jpg'), new Uint8Array([1]), { contentType: 'image/jpeg' }));
  await assertFails(uploadBytes(ref(child.storage(), 'families/f/taskProofs/sibling/proof.jpg'), new Uint8Array([1]), { contentType: 'image/jpeg' }));
  await env.withSecurityRulesDisabled(async (context) => updateDoc(doc(context.firestore(), 'families/f/childProfiles/c'), { sessionsRevokedAt: Timestamp.now() }));
  await assertFails(getDoc(doc(db, 'families/f')));
  await assertFails(uploadBytes(ref(child.storage(), 'families/f/taskProofs/own/proof.jpg'), new Uint8Array([1]), { contentType: 'image/jpeg' }));
  await env.withSecurityRulesDisabled(async (context) => {
    await updateDoc(doc(context.firestore(), 'families/f/childProfiles/c'), { sessionsRevokedAt: Timestamp.fromMillis(0) });
    await updateDoc(doc(context.firestore(), 'families/f/childSessions/hash'), { expiresAt: Timestamp.fromMillis(1) });
  });
  await assertFails(getDoc(doc(db, 'families/f')));
});

test('1.0.4 adult-supervised quests accept 31 milestone steps and refuse 32', async () => {
  const db = env.authenticatedContext('p').firestore();
  const task = {familyAccountId:'f', title:'Supervised project', category:'LifeSkills', starValue:0,
    difficulty:'AdultSupervised', isActive:true, requiresPhoto:false, isMilestone:true,
    milestoneSteps:31, starsPerStep:2, milestoneBonus:5, recurrenceType:'none',
    createdByParentId:'p', createdAt:Timestamp.now()};
  await assertSucceeds(setDoc(doc(db,'families/f/tasks/steps31'),task));
  await assertFails(setDoc(doc(db,'families/f/tasks/steps32'),{...task,milestoneSteps:32}));
  await assertFails(setDoc(doc(db,'families/f/tasks/difficulty'),{...task,difficulty:'Unknown'}));
});
