import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import * as admin from 'firebase-admin';
import { createHash, randomBytes } from 'crypto';
import { documentId, requireParent } from '../utils/authorization';
import { validTimezone, nameKey } from '../utils/validation';

const text = (value: unknown, max: number, field: string): string => {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new HttpsError('invalid-argument', `Check ${field}`);
  return value.trim();
};

/** Parent administration uses canonical membership; invitations are single-use and email-bound. */
export const manageFamily = onCall(async request => {
  if (!request.auth || request.auth.token.role === 'child' || request.auth.uid.startsWith('child-')) throw new HttpsError('permission-denied','Parent sign-in required');
  const uid = request.auth.uid, input = request.data, db = admin.firestore();
  if (input.action === 'join') {
    if (request.auth.token.email_verified !== true) throw new HttpsError('failed-precondition','Verify your parent email before joining a family.');
    const code = text(input.code,100,'invitation code');
    const invite = db.doc(`familyInvitations/${createHash('sha256').update(code).digest('hex')}`);
    await db.runTransaction(async tx => {
      const entry = await tx.get(invite), mapping = await tx.get(db.doc(`parentProfiles/${uid}`));
      const invitation = entry.data();
      if (!entry.exists || invitation?.usedBy || invitation?.expiresAt.toMillis() <= Date.now() || invitation?.email !== request.auth!.token.email?.toLowerCase()) throw new HttpsError('permission-denied','Invitation is invalid, expired or belongs to another email.');
      const family = db.doc(`families/${documentId(invitation!.familyId)}`), snapshot = await tx.get(family);
      if (!snapshot.exists || snapshot.data()?.isDeleted) throw new HttpsError('failed-precondition','This family is unavailable.');
      if (mapping.exists && !mapping.data()?.familyDeleted) throw new HttpsError('failed-precondition','You already belong to a family.');
      const members = snapshot.data()?.memberIds || [];
      if (members.length >= 2) throw new HttpsError('failed-precondition','This family already has two parents.');
      const parent = {familyAccountId:family.id,firebaseUid:uid,displayName:text(input.displayName,80,'your name'),avatarId:'default-parent',starBalance:0,totalStarsEarned:0,totalStarsRedeemed:0,createdAt:FieldValue.serverTimestamp()};
      tx.set(db.doc(`parentProfiles/${uid}`),parent);tx.create(family.collection('parentUsers').doc(uid),parent);
      tx.update(family,{memberIds:[...members,uid]});tx.update(invite,{usedBy:uid,usedAt:FieldValue.serverTimestamp()});
    });
    return {success:true};
  }
  const familyId = documentId(input.familyId), family = db.doc(`families/${familyId}`);
  if (input.action === 'restore') {
    await db.runTransaction(async tx => {
      const snapshot=await tx.get(family), job=await tx.get(db.doc(`familyDeletionQueue/${familyId}`)), mapping=await tx.get(db.doc(`parentProfiles/${uid}`));
      const parents=await tx.get(family.collection('parentUsers'));
      if(!snapshot.exists || snapshot.data()?.ownerUid!==uid || !job.exists || job.data()?.purgeAfter.toMillis()<=Date.now())throw new HttpsError('permission-denied','Only the owner can restore this family during its retention period.');
      if(mapping.exists && mapping.data()?.familyAccountId!==familyId && !mapping.data()?.familyDeleted)throw new HttpsError('failed-precondition','This account already has an active family. Keep using it, or schedule its deletion before restoring this family.');
      const profiles=await Promise.all(parents.docs.map(parent=>tx.get(db.doc(`parentProfiles/${parent.id}`))));
      const retained=parents.docs.filter((_,index)=>!profiles[index].exists || profiles[index].data()?.familyAccountId===familyId || profiles[index].data()?.familyDeleted);
      tx.update(family,{isDeleted:false,deletedAt:FieldValue.delete(),memberIds:retained.map(parent=>parent.id)});tx.delete(job.ref);
      parents.docs.forEach((parent,index)=>{if(retained.some(member=>member.id===parent.id))tx.set(profiles[index].ref,{...parent.data(),familyDeleted:false});else tx.delete(parent.ref);});
    });
    return {success:true};
  }
  const result = await db.runTransaction(async tx => {
    await requireParent(tx,familyId,uid);
    const snapshot = await tx.get(family);
    if(input.action==='settings') {
      if(!validTimezone(input.timezone))throw new HttpsError('invalid-argument','Choose a valid timezone.');
      const familyName=text(input.familyName,80,'family name');tx.update(family,{familyName,timezone:input.timezone});return {};
    }
    if(input.action==='invite') {
      if(snapshot.data()?.ownerUid!==uid)throw new HttpsError('permission-denied','Only the owner can invite another parent.');
      if((snapshot.data()?.memberIds || []).length>=2)throw new HttpsError('failed-precondition','This family already has two parents.');
      const email=text(input.email,254,'parent email').toLowerCase();
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new HttpsError('invalid-argument','Enter a valid email.');
      const code=randomBytes(24).toString('base64url');const expiresAt=Timestamp.fromMillis(Date.now()+7*86400000);
      tx.create(db.doc(`familyInvitations/${createHash('sha256').update(code).digest('hex')}`),{familyId,email,createdBy:uid,expiresAt});return {code,expiresAt:expiresAt.toDate().toISOString()};
    }
    const childId=documentId(input.childId),child=family.collection('childProfiles').doc(childId), profile=await tx.get(child);
    if(!profile.exists || (profile.data()?.isArchived && input.action!=='restoreChild'))throw new HttpsError('not-found','Child profile is unavailable.');
    const oldNameRef=family.collection('childNames').doc(createHash('sha256').update(nameKey(profile.data()?.nickname)).digest('hex'));
    const oldName=await tx.get(oldNameRef);
    if(input.action==='archiveChild') {
      if(profile.data()?.activeQuestId)throw new HttpsError('failed-precondition','Finish or release this child’s active quest before removing the profile.');
      if(oldName.exists)tx.delete(oldNameRef);
      tx.update(child,{isArchived:true,sessionsRevokedAt:Timestamp.now()});return {};
    }
    if(input.action==='editChild' || input.action==='restoreChild') {
      const nickname=text(input.action==='restoreChild'?profile.data()?.nickname:input.nickname,20,'nickname');
      const newNameRef=family.collection('childNames').doc(createHash('sha256').update(nameKey(nickname)).digest('hex'));
      const reserved=await tx.get(newNameRef);
      if(reserved.exists && reserved.data()?.childId!==childId)throw new HttpsError('already-exists','Choose a different nickname; this family already has that name.');
      const children=await tx.get(family.collection('childProfiles'));
      if(children.docs.some(c=>c.id!==childId && !c.data().isArchived && nameKey(c.data().nickname)===nameKey(nickname)))throw new HttpsError('already-exists','Choose a different nickname; this family already has that name.');
      if(input.action==='restoreChild'){tx.set(newNameRef,{childId});tx.update(child,{isArchived:false});return {};}
      if(!['3-5','6-8','9-11','12-14','15-17'].includes(input.ageGroup))throw new HttpsError('invalid-argument','Choose an age group.');
      if(!Number.isSafeInteger(input.weeklyTargetStars)||input.weeklyTargetStars<1||input.weeklyTargetStars>10000||!Number.isSafeInteger(input.monthlyTargetStars)||input.monthlyTargetStars<input.weeklyTargetStars||input.monthlyTargetStars>10000)throw new HttpsError('invalid-argument','Weekly target must be 1–10,000; monthly target must be at least weekly and at most 10,000.');
      if(oldName.exists && oldNameRef.path!==newNameRef.path)tx.delete(oldNameRef);
      tx.set(newNameRef,{childId});
      tx.update(child,{nickname,nicknameKey:nameKey(nickname),ageGroup:input.ageGroup,avatarId:text(input.avatarId,40,'avatar'),weeklyTargetStars:input.weeklyTargetStars,monthlyTargetStars:input.monthlyTargetStars});return {};
    }
    throw new HttpsError('invalid-argument','Unknown family action');
  });
  return {success:true,...result};
});
