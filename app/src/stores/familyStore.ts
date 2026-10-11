import { useChildSessionStore } from './childSessionStore';
import { create } from 'zustand';
import { doc, collection, query, where, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { db } from '../services/firebase';
import type { FamilyAccount, ChildProfile, ParentUser } from '../types';
interface FamilyState {
 family: FamilyAccount | null; children: ChildProfile[]; archivedChildren: ChildProfile[]; parentProfile: ParentUser | null; loading: boolean; error: string | null;
 subscribeToFamily: (familyId: string, parentUid: string, childMode?: boolean) => Unsubscribe;
 clearFamily: () => void;
}
export const useFamilyStore = create<FamilyState>(set => ({
 family: null, children: [], archivedChildren: [], parentProfile: null, loading: true, error: null,
 subscribeToFamily: (familyId, parentUid, childMode = false) => {
  set({ family: null, children: [], archivedChildren: [], parentProfile: null, loading: true, error: null });
  let active = true; const ready = new Set<string>(); const errors = new Map<string, string>();
  const update = (key: string, patch: Partial<FamilyState>) => { if (!active) return; ready.add(key); errors.delete(key); set({ ...patch, loading: ready.size < 3, error: [...errors.values()][0] ?? null }); };
  const failure = (key: string, error?: {code?:string}) => { if (!active) return; if(childMode && ['permission-denied','unauthenticated'].includes(error?.code || '')) useChildSessionStore.getState().endSession(); ready.add(key); errors.set(key, 'Could not load your family. Reconnect and reopen the app.'); set({ loading: false, error: [...errors.values()][0] }); };
  const timer = setTimeout(() => { if (active && ready.size < 3) set({ loading: false, error: 'Could not confirm your family data. Check your connection and reopen the app.' }); }, 10000);
  const family = onSnapshot(doc(db, 'families', familyId), { includeMetadataChanges: true }, snapshot => {
   if (!snapshot.exists()) { if (!snapshot.metadata.fromCache) { update('family', { family: null }); failure('family'); } return; }
   update('family', { family: { ...snapshot.data(), id: snapshot.id } as FamilyAccount });
  }, error => failure('family',error));
  const childrenRef = collection(db, 'families', familyId, 'childProfiles');
  const children = onSnapshot(childMode ? query(childrenRef, where('credentialsPrivate', '==', true)) : childrenRef, { includeMetadataChanges: true }, snapshot => {
   if (snapshot.empty && snapshot.metadata.fromCache) return;
   update('children', { archivedChildren: snapshot.docs.filter(snapshot=>snapshot.data().isArchived).map(snapshot=>({...snapshot.data(),id:snapshot.id}) as ChildProfile), children: snapshot.docs.filter(snapshot => !snapshot.data().isArchived).map(snapshot => ({ ...snapshot.data(), id: snapshot.id }) as ChildProfile) });
  }, error => failure('children',error));
  if (childMode) update('parent', {parentProfile:null});
  const parent = childMode ? () => {} : onSnapshot(doc(db, 'families', familyId, 'parentUsers', parentUid), { includeMetadataChanges: true }, snapshot => {
   if (!snapshot.exists() && snapshot.metadata.fromCache) return;
   update('parent', { parentProfile: snapshot.exists() ? { ...snapshot.data(), id: snapshot.id } as ParentUser : null });
  }, error => failure('parent',error));
  return () => { active = false; clearTimeout(timer); family(); children(); parent(); };
 },
 clearFamily: () => set({ family: null, children: [], archivedChildren: [], parentProfile: null, loading: true, error: null }),
}));
