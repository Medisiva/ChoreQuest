const test = require('node:test'); const assert = require('node:assert/strict');
const { initializeApp, deleteApp } = require('firebase/app');
const { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithCustomToken, signInWithEmailAndPassword, signOut } = require('firebase/auth');
const { getFirestore, connectFirestoreEmulator, collection, getDocs, doc, getDoc } = require('firebase/firestore');
const { getFunctions, connectFunctionsEmulator, httpsCallable } = require('firebase/functions');

test('real Firebase setup, PIN, quest review and trigger retry-safe star award', { timeout: 60000 }, async () => {
  const app = initializeApp({ apiKey: 'demo-key', projectId: 'demo-chorequest', authDomain: 'demo-chorequest.firebaseapp.com' }, 'flow');
  const auth = getAuth(app); connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const db = getFirestore(app); connectFirestoreEmulator(db, '127.0.0.1', 8080);
  const functions = getFunctions(app); connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  const call = async (name, data) => (await httpsCallable(functions, name)(data)).data;
  try {
    const { user } = await createUserWithEmailAndPassword(auth, `parent-${Date.now()}@example.test`, 'Test-only-password-123');
    const setup = { familyName: 'Integration Family', timezone: 'America/New_York', child: { nickname: 'Kid', avatarId: 'avatar-01', ageGroup: '6-8', pin: '1234' }, task: { title: 'Tidy room', category: 'Household', starValue: 5 } };
    const family = await call('setupFamily', setup);
    assert.equal((await call('setupFamily', setup)).familyId, family.familyId);
    assert.equal((await getDoc(doc(db, 'parentProfiles', user.uid))).data().familyAccountId, family.familyId);
    const children = await getDocs(collection(db, 'families', family.familyId, 'childProfiles'));
    const childId = children.docs[0].id;
    assert.equal(children.docs[0].data().pinHash, undefined);
    await assert.rejects(getDoc(doc(db, 'families', family.familyId, 'childCredentials', childId)));
    const tasks = await getDocs(collection(db, 'families', family.familyId, 'tasks')); const taskId = tasks.docs[0].id;
    const token = await user.getIdToken();
    const verify = await fetch('http://127.0.0.1:5001/demo-chorequest/us-central1/verifyChildPin', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ familyId: family.familyId, childProfileId: childId, pin: '1234' }) });
    const result = await verify.json(); assert.equal(verify.status, 200, JSON.stringify(result));
    const parentEmail = user.email;
    await signOut(auth);
    await signInWithCustomToken(auth, result.customToken);
    assert.notEqual(auth.currentUser.uid, user.uid);
    await assert.rejects(call('setupFamily', setup));
    await assert.rejects(call('adjustChildStars', { familyId: family.familyId, childId, amount: 999, reason: 'Attack', type: 'bonusStar', operationId: 'attack' }));
    await assert.rejects(call('resetChildPin', { familyId: family.familyId, childId, pin: '9999' }));
    const context = { familyId: family.familyId, childId, sessionToken: result.sessionToken.token };
    await assert.rejects(call('claimChildQuest', { ...context, sessionToken: '', taskId, operationId: 'invalid' }));
    const claim = await call('claimChildQuest', { ...context, taskId, operationId: 'integration-claim' });
    await call('updateChildQuest', { ...context, claimId: claim.claimId, status: 'submitted' });
    await assert.rejects(call('reviewChildQuests', { familyId: family.familyId, claimIds: [claim.claimId], decision: 'approved' }));
    await signInWithEmailAndPassword(auth, parentEmail, 'Test-only-password-123');
    await call('reviewChildQuests', { familyId: family.familyId, claimIds: [claim.claimId], decision: 'approved' });
    const profileRef = doc(db, 'families', family.familyId, 'childProfiles', childId);
    let profile;
    for (let attempt = 0; attempt < 100; attempt++) {
      profile = (await getDoc(profileRef)).data();
      if (profile.starBalance === 5) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.equal(profile.starBalance, 5); assert.equal(profile.activeQuestId, undefined);
    await call('reviewChildQuests', { familyId: family.familyId, claimIds: [claim.claimId], decision: 'approved' });
    assert.equal((await getDoc(profileRef)).data().starBalance, 5);
    const ledger = await getDocs(collection(db, 'families', family.familyId, 'starTransactions')); assert.equal(ledger.size, 1);
  } finally { await deleteApp(app); }
});
