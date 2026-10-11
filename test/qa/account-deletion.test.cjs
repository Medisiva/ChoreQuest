// Google Play account deletion: every adult can delete their own login and personal data.
const test = require('node:test'); const assert = require('node:assert/strict'); const crypto = require('node:crypto'); const path = require('node:path');
const { initializeApp, deleteApp } = require('firebase/app');
const { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithCustomToken } = require('firebase/auth');
const { getFirestore, connectFirestoreEmulator, collection, getDocs } = require('firebase/firestore');
const { getFunctions, connectFunctionsEmulator, httpsCallable } = require('firebase/functions');
const admin = require('firebase-admin');
const P = 'demo-chorequest';

test('account deletion for co-parent, owner with co-parent, and sole owner', { timeout: 300000 }, async () => {
  assert.equal(process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT, P, 'Emulator only');
  const apps = []; let n = 0; const stamp = Date.now(); const pw = crypto.randomBytes(16).toString('base64url');
  const client = () => { const app = initializeApp({ apiKey: 'demo-key', projectId: P, authDomain: `${P}.firebaseapp.com` }, `del-${stamp}-${++n}`); apps.push(app); const auth = getAuth(app); connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true }); const db = getFirestore(app); connectFirestoreEmulator(db, '127.0.0.1', 8080); const f = getFunctions(app); connectFunctionsEmulator(f, '127.0.0.1', 5001); return { auth, db, call: async (name, data) => (await httpsCallable(f, name)(data)).data }; };
  const server = admin.initializeApp({ projectId: P, storageBucket: `${P}.appspot.com` }, `del-admin-${stamp}`); const sdb = server.firestore();
  const backend = require(path.join(__dirname, '../../functions/lib/index.js'));
  const exists = async (uid) => { try { await server.auth().getUser(uid); return true; } catch { return false; } };
  const http = async (c, name, body) => { const r = await fetch(`http://127.0.0.1:5001/${P}/us-central1/${name}`, { method: 'POST', headers: { Authorization: `Bearer ${await c.auth.currentUser.getIdToken()}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return { status: r.status, data: await r.json() }; };
  const family = async (label) => {
    const owner = client(); const ou = (await createUserWithEmailAndPassword(owner.auth, `del-own-${label}-${stamp}@example.test`, pw)).user;
    const { familyId } = await owner.call('setupFamily', { familyName: `Delete ${label}`, displayName: 'Owner', timezone: 'UTC', child: { nickname: 'Kid', ageGroup: '6-8', avatarId: 'avatar-01', pin: '1234' } });
    return { owner, ou, familyId };
  };
  const addCoParent = async (f, label) => {
    const co = client(); const cu = (await createUserWithEmailAndPassword(co.auth, `del-co-${label}-${stamp}@example.test`, pw)).user;
    const p = { familyAccountId: f.familyId, firebaseUid: cu.uid, displayName: 'Co', avatarId: 'default-parent', starBalance: 0, totalStarsEarned: 0, totalStarsRedeemed: 0, createdAt: admin.firestore.Timestamp.now() };
    await sdb.doc(`families/${f.familyId}/parentUsers/${cu.uid}`).set(p); await sdb.doc(`parentProfiles/${cu.uid}`).set(p);
    await sdb.doc(`families/${f.familyId}`).update({ memberIds: [f.ou.uid, cu.uid] });
    return { co, cu };
  };
  try {
    // 1. Co-parent deletes their own account; an accepted request returns to pending.
    const a = await family('a'); const { co, cu } = await addCoParent(a, 'a');
    await assert.rejects(co.call('setupFamily', { action: 'deleteAccount' }), /DELETE/);
    await sdb.doc(`families/${a.familyId}/familyRequests/r1`).set({ familyAccountId: a.familyId, requestedByChildId: 'x', title: 'Help', category: 'Learning', suggestedStars: 3, status: 'accepted', acceptedByParentId: cu.uid, agreedStars: 3 });
    await sdb.doc(`families/${a.familyId}/parentStarTransactions/w1`).set({ familyAccountId: a.familyId, parentUserId: cu.uid, deltaStars: 2 });
    const r1 = await co.call('setupFamily', { action: 'deleteAccount', confirmText: 'DELETE' });
    assert.equal(r1.familyScheduledForDeletion, false);
    assert.equal(await exists(cu.uid), false);
    assert.equal((await sdb.doc(`parentProfiles/${cu.uid}`).get()).exists, false);
    assert.equal((await sdb.doc(`families/${a.familyId}/parentUsers/${cu.uid}`).get()).exists, false);
    assert.equal((await sdb.doc(`families/${a.familyId}/parentStarTransactions/w1`).get()).exists, false);
    const fam = (await sdb.doc(`families/${a.familyId}`).get()).data();
    assert.deepEqual(fam.memberIds, [a.ou.uid]); assert.equal(fam.ownerUid, a.ou.uid); assert.equal(fam.isDeleted, false);
    const req = (await sdb.doc(`families/${a.familyId}/familyRequests/r1`).get()).data();
    assert.equal(req.status, 'pending'); assert.equal(req.acceptedByParentId, undefined);
    assert.equal(await exists(a.ou.uid), true);

    // 2. Owner with a co-parent hands the family over.
    const b = await family('b'); const coB = await addCoParent(b, 'b');
    const r2 = await b.owner.call('setupFamily', { action: 'deleteAccount', confirmText: 'DELETE' });
    assert.equal(r2.familyScheduledForDeletion, false);
    assert.equal(await exists(b.ou.uid), false);
    const famB = (await sdb.doc(`families/${b.familyId}`).get()).data();
    assert.equal(famB.ownerUid, coB.cu.uid); assert.deepEqual(famB.memberIds, [coB.cu.uid]); assert.equal(famB.isDeleted, false);
    assert.equal((await getDocs(collection(coB.co.db, 'families', b.familyId, 'childProfiles'))).size, 1, 'new owner keeps the children');
    await coB.co.call('setupFamily', { action: 'invite', familyId: b.familyId, email: `next-${stamp}@example.test` });

    // 3. Sole owner: family disabled now and purged later, including the child's sign-in.
    const c = await family('c');
    const kid = (await getDocs(collection(c.owner.db, 'families', c.familyId, 'childProfiles'))).docs[0].id;
    const pin = await http(c.owner, 'verifyChildPin', { familyId: c.familyId, childProfileId: kid, pin: '1234' }); assert.equal(pin.status, 200);
    const child = client(); await signInWithCustomToken(child.auth, pin.data.customToken);
    await assert.rejects(child.call('setupFamily', { action: 'deleteAccount', confirmText: 'DELETE' }));
    const r3 = await c.owner.call('setupFamily', { action: 'deleteAccount', confirmText: 'DELETE' });
    assert.equal(r3.familyScheduledForDeletion, true);
    assert.equal(await exists(c.ou.uid), false);
    assert.equal((await sdb.doc(`families/${c.familyId}`).get()).data().isDeleted, true);
    await sdb.doc(`familyDeletionQueue/${c.familyId}`).update({ purgeAfter: admin.firestore.Timestamp.fromMillis(Date.now() - 1000) });
    await backend.purgeDeletedFamilies.run({});
    assert.equal((await sdb.doc(`families/${c.familyId}`).get()).exists, false);
    assert.equal((await sdb.collection(`families/${c.familyId}/childProfiles`).get()).size, 0);
    assert.equal(await exists(`child-${crypto.createHash('sha256').update(`${c.familyId}/${kid}`).digest('hex')}`), false);
    assert.equal((await sdb.doc(`familyDeletionQueue/${c.familyId}`).get()).exists, false);

    // 4. An account with no family can still be deleted.
    const lone = client(); const lu = (await createUserWithEmailAndPassword(lone.auth, `del-lone-${stamp}@example.test`, pw)).user;
    await lone.call('setupFamily', { action: 'deleteAccount', confirmText: 'DELETE' });
    assert.equal(await exists(lu.uid), false);

    // Stale mapping must not alter another family's ownership or membership.
    const outsider = client(); const outsiderUser = (await createUserWithEmailAndPassword(outsider.auth, `del-outsider-${stamp}@example.test`, pw)).user;
    await sdb.doc(`parentProfiles/${outsiderUser.uid}`).set({ familyAccountId: b.familyId });
    await assert.rejects(outsider.call('setupFamily', { action: 'deleteAccount', confirmText: 'DELETE' }), /membership/);
    assert.equal(await exists(outsiderUser.uid), true);
    assert.equal((await sdb.doc(`families/${b.familyId}`).get()).data().ownerUid, coB.cu.uid);

    // The destructive handler independently checks recent sign-in and token presence.
    const handler = require(path.join(__dirname, '../../functions/lib/http/deleteMyAccount.js')).deleteMyAccount;
    const token = await outsider.auth.currentUser.getIdToken();
    const stale = { auth: { uid: outsiderUser.uid, token: { auth_time: Math.floor(Date.now()/1000)-600 } }, data: { confirmText: 'DELETE' }, rawRequest: { headers: { authorization: `Bearer ${token}` } } };
    await assert.rejects(handler(stale), /sign out and sign in again/);
    await assert.rejects(handler({ ...stale, rawRequest: { headers: {} } }), /Sign in again/);
    assert.equal(await exists(outsiderUser.uid), true);

  } finally {
    for (const app of apps) await deleteApp(app).catch(() => {}); await server.delete().catch(() => {});
  }
});
