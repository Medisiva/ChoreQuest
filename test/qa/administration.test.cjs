const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {initializeApp,deleteApp}=require('firebase/app');
const {getAuth,connectAuthEmulator,createUserWithEmailAndPassword}=require('firebase/auth');
const {getFirestore,connectFirestoreEmulator,doc,getDoc}=require('firebase/firestore');
const {getFunctions,connectFunctionsEmulator,httpsCallable}=require('firebase/functions');
const admin=require('firebase-admin');
test('parent administration, invitations, names and family deletion recovery', {timeout:180000},async t=>{
 assert.equal(process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT,'demo-chorequest');assert.ok(process.env.FIRESTORE_EMULATOR_HOST);
 const project='demo-chorequest',apps=[],stamp=crypto.randomUUID(),password=crypto.randomBytes(20).toString('base64url');
 function client(label){const app=initializeApp({projectId:project,apiKey:'demo-key',authDomain:project+'.firebaseapp.com'},label+'-'+stamp);apps.push(app);const auth=getAuth(app);connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});const db=getFirestore(app);connectFirestoreEmulator(db,'127.0.0.1',8080);const fn=getFunctions(app);connectFunctionsEmulator(fn,'127.0.0.1',5001);return{auth,db,call:async(name,data)=>(await httpsCallable(fn,name)(data)).data};}
 const server=admin.initializeApp({projectId:project,storageBucket:project+'.appspot.com'}),db=server.firestore(),owner=client('owner'),co=client('co'),outsider=client('outsider');
 try{
  await createUserWithEmailAndPassword(owner.auth,`owner-${stamp}@example.test`,password);
  await createUserWithEmailAndPassword(co.auth,`coparent-${stamp}@example.test`,password);
  await createUserWithEmailAndPassword(outsider.auth,`outsider-${stamp}@example.test`,password);
  const {familyId}=await owner.call('setupFamily',{familyName:'Administration QA',displayName:'Alex Test',timezone:'UTC'});
  const action=data=>owner.call('setupFamily',{familyId,...data});let childId,invitation;
  await t.test('parent name persists and settings refuse invalid timezone at both boundaries',async()=>{
   assert.equal((await getDoc(doc(owner.db,'parentProfiles',owner.auth.currentUser.uid))).data().displayName,'Alex Test');
   await assert.rejects(action({action:'settings',familyName:'QA',timezone:'Not/AZone'}));
   await action({action:'settings',familyName:'Updated QA',timezone:'Asia/Kolkata'});
   assert.equal((await db.doc(`families/${familyId}`).get()).data().timezone,'Asia/Kolkata');
   await assert.rejects(outsider.call('setupFamily',{action:'settings',familyId,familyName:'Attack',timezone:'UTC'}));
  });
  await t.test('concurrent normalized duplicate nicknames create only one child',async()=>{
   const results=await Promise.allSettled(['Mia',' mia '].map(nickname=>owner.call('createChildProfile',{familyId,nickname,ageGroup:'3-5',avatarId:'avatar-06',pin:'1122'})));
   assert.equal(results.filter(v=>v.status==='fulfilled').length,1);childId=results.find(v=>v.status==='fulfilled').value.childId;
   assert.equal((await db.collection(`families/${familyId}/childProfiles`).get()).size,1);
  });
  await t.test('child edits validate targets; profile archive and restore preserve history',async()=>{
   const input={action:'editChild',childId,nickname:'Mia',ageGroup:'3-5',avatarId:'avatar-06',weeklyTargetStars:10,monthlyTargetStars:40};
   await assert.rejects(action({...input,monthlyTargetStars:5}));await action(input);
   await action({action:'archiveChild',childId});assert.equal((await db.doc(`families/${familyId}/childProfiles/${childId}`).get()).data().isArchived,true);
   await action({action:'restoreChild',childId});assert.equal((await db.doc(`families/${familyId}/childProfiles/${childId}`).get()).data().isArchived,false);
  });
  await t.test('invitation is owner-controlled and refuses an unverified or mismatched email',async()=>{
   await assert.rejects(outsider.call('setupFamily',{familyId,action:'invite',email:co.auth.currentUser.email}));
   invitation=await action({action:'invite',email:co.auth.currentUser.email});assert.ok(invitation.code);
   await assert.rejects(co.call('setupFamily',{action:'join',code:invitation.code,displayName:'Jamie Test'}));
   await server.auth().updateUser(outsider.auth.currentUser.uid,{emailVerified:true});await outsider.auth.currentUser.getIdToken(true);
   await assert.rejects(outsider.call('setupFamily',{action:'join',code:invitation.code,displayName:'Outsider'}));
  });
  await t.test('verified invited parent joins once and obtains only the invited family',async()=>{
   await server.auth().updateUser(co.auth.currentUser.uid,{emailVerified:true});await co.auth.currentUser.getIdToken(true);
   await co.call('setupFamily',{action:'join',code:invitation.code,displayName:'Jamie Test'});
   assert.equal((await getDoc(doc(co.db,'parentProfiles',co.auth.currentUser.uid))).data().familyAccountId,familyId);
   assert.equal((await db.doc(`families/${familyId}`).get()).data().memberIds.length,2);
   await assert.rejects(co.call('setupFamily',{action:'join',code:invitation.code,displayName:'Jamie Test'}));
  });
  await t.test('owner deletion is recoverable and does not disable either adult sign-in',async()=>{
   const deleted=await fetch(`http://127.0.0.1:5001/${project}/us-central1/deleteFamilyAccount`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+await owner.auth.currentUser.getIdToken()},body:JSON.stringify({familyId,confirmText:'DELETE'})});assert.equal(deleted.status,200);
   assert.equal((await getDoc(doc(co.db,'parentProfiles',co.auth.currentUser.uid))).data().familyDeleted,true);
   await server.auth().getUser(co.auth.currentUser.uid);await server.auth().getUser(owner.auth.currentUser.uid);
   await assert.rejects(co.call('setupFamily',{action:'restore',familyId}));
   await action({action:'restore'});assert.equal((await db.doc(`families/${familyId}`).get()).data().isDeleted,false);
   assert.equal((await getDoc(doc(co.db,'parentProfiles',co.auth.currentUser.uid))).data().familyDeleted,false);
   assert.equal((await db.doc(`familyDeletionQueue/${familyId}`).get()).exists,false);
  });
  await t.test('a parent can start a new family after deletion and old cleanup cannot erase the new mapping',async()=>{
   const deleted=await fetch(`http://127.0.0.1:5001/${project}/us-central1/deleteFamilyAccount`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+await owner.auth.currentUser.getIdToken()},body:JSON.stringify({familyId,confirmText:'DELETE'})});assert.equal(deleted.status,200);
   const next=await co.call('setupFamily',{familyName:'Jamie new family',displayName:'Jamie Test',timezone:'UTC'});assert.notEqual(next.familyId,familyId);
   assert.equal((await getDoc(doc(co.db,'parentProfiles',co.auth.currentUser.uid))).data().familyAccountId,next.familyId);
   await db.doc(`familyDeletionQueue/${familyId}`).update({purgeAfter:admin.firestore.Timestamp.fromMillis(0)});
   await require('../../functions/lib/scheduled/purgeDeletedFamilies').purgeDeletedFamilies.run({});
   assert.equal((await db.doc(`families/${familyId}`).get()).exists,false);
   assert.equal((await db.doc(`families/${next.familyId}`).get()).exists,true);
   assert.equal((await db.doc(`parentProfiles/${co.auth.currentUser.uid}`).get()).data().familyAccountId,next.familyId);
   await server.auth().getUser(co.auth.currentUser.uid);await server.auth().getUser(owner.auth.currentUser.uid);
  });
 }finally{for(const app of apps)await deleteApp(app);await server.delete();}
});
