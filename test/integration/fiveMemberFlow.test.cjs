const test=require('node:test');const assert=require('node:assert/strict');const crypto=require('node:crypto');
const {initializeApp,deleteApp}=require('firebase/app');const {getAuth,connectAuthEmulator,createUserWithEmailAndPassword,signInWithEmailAndPassword,signInWithCustomToken,signOut}=require('firebase/auth');
const {getFirestore,connectFirestoreEmulator,collection,getDocs,doc,getDoc,setDoc,Timestamp,query,where,updateDoc,disableNetwork,enableNetwork}=require('firebase/firestore');const {getFunctions,connectFunctionsEmulator,httpsCallable}=require('firebase/functions');const {getStorage,connectStorageEmulator,ref,uploadBytes,getDownloadURL}=require('firebase/storage');const admin=require('firebase-admin');
test('five-member family: both parents, PIN-only ages 3–5, sibling security, all quest modes, rewards, requests, export and PIN revocation',{timeout:180000},async()=>{
 assert.equal(process.env.GCLOUD_PROJECT||process.env.GOOGLE_CLOUD_PROJECT,'demo-chorequest','Never run destructive QA against live data');
 const apps=[];const password=crypto.randomBytes(20).toString('base64url');const emails=[1,2].map(i=>`qa-${i}-${Date.now()}@example.test`);
 const client=i=>{const app=initializeApp({apiKey:'demo-key',projectId:'demo-chorequest',authDomain:'demo-chorequest.firebaseapp.com',storageBucket:'demo-chorequest.appspot.com'},`qa-five-${i}`);apps.push(app);const auth=getAuth(app);connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});const db=getFirestore(app);connectFirestoreEmulator(db,'127.0.0.1',8080);const functions=getFunctions(app);connectFunctionsEmulator(functions,'127.0.0.1',5001);const storage=getStorage(app);connectStorageEmulator(storage,'127.0.0.1',9199);return{app,auth,db,storage,call:async(name,data)=>(await httpsCallable(functions,name)(data)).data};};
 const p1=client(1),p2=client(2),kid=client(3);const server=admin.initializeApp({projectId:'demo-chorequest',storageBucket:'demo-chorequest.appspot.com'},'qa-admin');
 const waitFor=async(read,check)=>{const end=Date.now()+20000;while(Date.now()<end){const result=await read();if(check(result))return result;await new Promise(r=>setTimeout(r,100));}assert.fail('Server trigger did not settle');};
 const http=async(c,name,body)=>{const response=await fetch(`http://127.0.0.1:5001/demo-chorequest/us-central1/${name}`,{method:'POST',headers:{Authorization:`Bearer ${await c.auth.currentUser.getIdToken()}`,'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:response.status,data:await response.json()};};
 try{
  const first=(await createUserWithEmailAndPassword(p1.auth,emails[0],password)).user;
  const {familyId}=await p1.call('setupFamily',{familyName:'Five Member QA',timezone:'America/New_York',child:{nickname:'Mia',ageGroup:'3-5',avatarId:'avatar-06',pin:'1234'},childRewards:[{name:'Story time',starCost:5}]});
  const mia=(await getDocs(collection(p1.db,'families',familyId,'childProfiles'))).docs[0].id;
  const leo=(await p1.call('createChildProfile',{familyId,nickname:'Leo',ageGroup:'6-8',avatarId:'avatar-07',pin:'2345'})).childId;
  const second=(await createUserWithEmailAndPassword(p2.auth,emails[1],password)).user;
  // Trusted test-only fixture membership: exercises independent parent identities.
  const profile={familyAccountId:familyId,firebaseUid:second.uid,displayName:'Jamie QA',avatarId:'default-parent',starBalance:0,totalStarsEarned:0,totalStarsRedeemed:0,createdAt:admin.firestore.Timestamp.now()};
  await server.firestore().doc(`families/${familyId}/parentUsers/${second.uid}`).set(profile);await server.firestore().doc(`parentProfiles/${second.uid}`).set(profile);await server.firestore().doc(`families/${familyId}`).update({memberIds:[first.uid,second.uid]});
  const ava=(await p2.call('createChildProfile',{familyId,nickname:'Ava',ageGroup:'12-14',avatarId:'avatar-14',pin:'3456'})).childId;
  const profiles=await getDocs(collection(p2.db,'families',familyId,'childProfiles'));assert.equal(profiles.size,3);assert.equal((await getDocs(collection(p1.db,'families',familyId,'parentUsers'))).size,2);assert.ok(profiles.docs.every(d=>d.data().pinHash===undefined));
  await assert.rejects(p1.call('createChildProfile',{familyId,nickname:' ',ageGroup:'3-5',avatarId:'avatar-01',pin:'1234'}));
  const wrong=await http(p1,'verifyChildPin',{familyId,childProfileId:mia,pin:'0000'});assert.equal(wrong.data.success,false);
  const login=async(id,pin)=>{const verified=await http(p1,'verifyChildPin',{familyId,childProfileId:id,pin});assert.equal(verified.status,200);assert.equal(verified.data.success,true);await signInWithCustomToken(kid.auth,verified.data.customToken);assert.equal(kid.auth.currentUser.email,null);const claims=(await kid.auth.currentUser.getIdTokenResult()).claims;assert.equal(claims.role,'child');return {familyId,childId:id,sessionToken:verified.data.sessionToken.token};};
  const warm=client(4);await signInWithEmailAndPassword(warm.auth,emails[0],password);await getDocs(collection(warm.db,'families',familyId,'childProfiles'));
  const warmPin=await http(p1,'verifyChildPin',{familyId,childProfileId:mia,pin:'1234'});assert.equal(warmPin.data.success,true);await disableNetwork(warm.db);await signOut(warm.auth);await signInWithCustomToken(warm.auth,warmPin.data.customToken);await enableNetwork(warm.db);
  assert.equal((await getDocs(query(collection(warm.db,'families',familyId,'childProfiles'),where('credentialsPrivate','==',true)))).size,3);
  let context=await login(mia,'1234');
  const childDirectory=await getDocs(query(collection(kid.db,'families',familyId,'childProfiles'),where('credentialsPrivate','==',true)));assert.equal(childDirectory.size,3);assert.ok(childDirectory.docs.every(d=>d.data().pinHash===undefined));
  await assert.rejects(updateDoc(doc(p1.db,'families',familyId,'childProfiles',mia),{credentialsPrivate:false}));
  await assert.rejects(kid.call('createChildProfile',{familyId,nickname:'Intruder',ageGroup:'3-5',avatarId:'avatar-01',pin:'1234'}));
  await assert.rejects(kid.call('adjustChildStars',{familyId,childId:mia,amount:999,reason:'attack',type:'bonusStar',operationId:'attack'}));
  await assert.rejects(getDoc(doc(kid.db,'families',familyId,'childCredentials',mia)));
  const task=async(id,extra={})=>setDoc(doc(p1.db,'families',familyId,'tasks',id),{familyAccountId:familyId,title:`QA ${id}`,category:'Household',starValue:5,difficulty:'Easy',isActive:true,requiresPhoto:false,isMilestone:false,recurrenceType:'none',createdByParentId:first.uid,createdAt:Timestamp.now(),...extra});
  await task('simple');await task('photo',{requiresPhoto:true});await task('milestone',{isMilestone:true,milestoneSteps:2,starsPerStep:3,milestoneBonus:1});
  const reward=(await getDocs(collection(p1.db,'families',familyId,'rewards'))).docs[0].id;
  await assert.rejects(kid.call('requestChildRedemption',{...context,rewardId:reward,operationId:'too-poor'}));
  const claim=(await kid.call('claimChildQuest',{...context,taskId:'simple',operationId:'simple-claim'})).claimId;
  await assert.rejects(kid.call('updateChildQuest',{...context,childId:leo,claimId:claim,status:'submitted'}));
  await kid.call('updateChildQuest',{...context,claimId:claim,status:'submitted'});
  await p2.call('reviewChildQuests',{familyId,claimIds:[claim],decision:'rejected',reason:'Please tidy the shelf'});
  await kid.call('updateChildQuest',{...context,claimId:claim,status:'submitted'});await p1.call('reviewChildQuests',{familyId,claimIds:[claim],decision:'approved'});
  const childRef=id=>doc(p1.db,'families',familyId,'childProfiles',id);await waitFor(async()=>(await getDoc(childRef(mia))).data(),x=>x.starBalance===5);
  await p1.call('reviewChildQuests',{familyId,claimIds:[claim],decision:'approved'});assert.equal((await getDoc(childRef(mia))).data().starBalance,5);
  const redemption=(await kid.call('requestChildRedemption',{...context,rewardId:reward,operationId:'redemption'})).redemptionId;
  await p2.call('reviewChildRedemption',{familyId,redemptionId:redemption,status:'approved'});await p2.call('reviewChildRedemption',{familyId,redemptionId:redemption,status:'approved'});assert.equal((await getDoc(childRef(mia))).data().starBalance,0);
  await assert.rejects(kid.call('claimChildQuest',{...context,taskId:'simple',operationId:'repeat-one-off'}));
  const request=(await kid.call('createFamilyRequest',{...context,title:'Read with me',category:'Learning',suggestedStars:3,operationId:'request'})).requestId;
  await p2.call('updateFamilyRequest',{familyId,requestId:request,status:'accepted',agreedStars:3});await assert.rejects(p1.call('updateFamilyRequest',{familyId,requestId:request,status:'completed'}));await p2.call('updateFamilyRequest',{familyId,requestId:request,status:'completed'});await kid.call('updateFamilyRequest',{...context,requestId:request,status:'confirmed'});await kid.call('updateFamilyRequest',{...context,requestId:request,status:'confirmed'});
  await waitFor(async()=>(await getDoc(doc(p1.db,'families',familyId,'parentUsers',second.uid))).data(),x=>x.starBalance===3);assert.equal((await getDoc(doc(p1.db,'families',familyId,'parentUsers',first.uid))).data().starBalance,0);
  for(const [id,status]of[['decline','declined'],['snooze','snoozed']]){await kid.call('createFamilyRequest',{...context,title:`QA ${id}`,category:'Household',suggestedStars:0,operationId:id});await p1.call('updateFamilyRequest',{familyId,requestId:id,status,...(status==='declined'?{reason:'Try another day'}:{snoozeDays:1})});}
  await assert.rejects(kid.call('createFamilyRequest',{...context,title:'Over limit',category:'Household',suggestedStars:0,operationId:'over-limit'}));
  context=await login(leo,'2345');const milestone=(await kid.call('claimChildQuest',{...context,taskId:'milestone',operationId:'milestone-claim'})).claimId;
  for(const target of [3,7]){await kid.call('updateChildQuest',{...context,claimId:milestone,status:'submitted'});await p1.call('reviewChildQuests',{familyId,claimIds:[milestone],decision:'approved'});await waitFor(async()=>(await getDoc(childRef(leo))).data(),x=>x.starBalance===target);}
  context=await login(ava,'3456');const photo=(await kid.call('claimChildQuest',{...context,taskId:'photo',operationId:'photo-claim'})).claimId;
  await assert.rejects(kid.call('updateChildQuest',{...context,claimId:photo,status:'submitted'}));
  const proof=ref(kid.storage,`families/${familyId}/taskProofs/${photo}/proof.jpg`);await uploadBytes(proof,Buffer.from([255,216,255,217]),{contentType:'image/jpeg'});const photoProofUrl=await getDownloadURL(proof);await kid.call('updateChildQuest',{...context,claimId:photo,status:'submitted',photoProofUrl});await p2.call('reviewChildQuests',{familyId,claimIds:[photo],decision:'approved'});await waitFor(async()=>(await getDoc(childRef(ava))).data(),x=>x.starBalance===5);
  const exported=await http(p2,'exportFamilyData',{familyId});assert.equal(exported.status,200);assert.equal(exported.data.data.childProfiles.length,3);assert.equal(exported.data.data.parentUsers.length,2);assert.equal(JSON.stringify(exported.data).includes('pinHash'),false);assert.equal(exported.data.data.childCredentials,undefined);
  const denial=await http(p2,'deleteFamilyAccount',{familyId,confirmText:'DELETE'});assert.equal(denial.status,403);
  await setDoc(doc(p1.db,'families',familyId,'parentRewards','coffee'),{familyAccountId:familyId,name:'Coffee treat',starCost:3,rewardType:'Special',isActive:true,approvedByParent:true,addedBy:'parent',createdAt:Timestamp.now()});
  await assert.rejects(kid.call('reviewChildRedemption',{familyId,rewardId:'coffee',kind:'parent',operationId:'attack'}));
  await p2.call('reviewChildRedemption',{familyId,rewardId:'coffee',kind:'parent',operationId:'parent-redeem'});await p2.call('reviewChildRedemption',{familyId,rewardId:'coffee',kind:'parent',operationId:'parent-redeem'});assert.equal((await getDoc(doc(p1.db,'families',familyId,'parentUsers',second.uid))).data().starBalance,0);
  const beforeReset=context;await p1.call('resetChildPin',{familyId,childId:ava,pin:'4567'});await assert.rejects(kid.call('getChildRequestCount',beforeReset));const renewed=await http(kid,'verifyChildPin',{familyId,childProfileId:ava,pin:'4567'});assert.equal(renewed.status,200);assert.equal(renewed.data.success,true);await signInWithCustomToken(kid.auth,renewed.data.customToken);assert.equal(kid.auth.currentUser.email,null);await assert.rejects(kid.call('createChildProfile',{familyId,nickname:'Intruder',ageGroup:'3-5',avatarId:'avatar-01',pin:'1234'}));const crossFamily=await http(kid,'verifyChildPin',{familyId:'other-family',childProfileId:ava,pin:'4567'});assert.equal(crossFamily.status,403);
  assert.equal((await getDocs(collection(p1.db,'families',familyId,'parentStarTransactions'))).size,2);
  const deleted=await http(p1,'deleteFamilyAccount',{familyId,confirmText:'DELETE'});assert.equal(deleted.status,200);await assert.rejects(getDoc(doc(p1.db,'families',familyId)));await assert.rejects(p2.call('createChildProfile',{familyId,nickname:'Late child',ageGroup:'3-5',avatarId:'avatar-01',pin:'1234'}));const disabled=await http(kid,'verifyChildPin',{familyId,childProfileId:ava,pin:'4567'});assert.equal(disabled.status,403);
  console.log('Verified five-member workflow including PIN-only preschool access, all quest modes, rewards, request limits, independent parent earnings and privacy.');
 }finally{for(const app of apps)await deleteApp(app);await server.delete();}
});
