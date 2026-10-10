import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, Timestamp } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { earnedInPeriod } from '@/utils/leaderboard';
import type { StarTransaction } from '@/types';
export function useFamilyEarnings(familyId?: string, timezone = 'UTC') {
 const [state, setState] = useState<{records:StarTransaction[]; loading:boolean; error:string|null}>({records:[],loading:true,error:null});
 useEffect(() => {
  setState({records:[],loading:true,error:null}); if (!familyId) return; let active=true;
  const unsubscribe=onSnapshot(query(collection(db,'families',familyId,'starTransactions'),where('createdAt','>=',Timestamp.fromMillis(Date.now()-33*86400000))),snapshot=>{
   if(active)setState({records:snapshot.docs.map(doc=>({...doc.data(),id:doc.id}) as StarTransaction).filter(record=>record.createdAt),loading:false,error:null});
  },()=>{if(active)setState(previous=>({...previous,loading:false,error:'Could not load earned stars. Please reconnect.'}));});
  return()=>{active=false;unsubscribe();};
 },[familyId]);
 const records=state.records.filter(record=>record.transactionType!=='streakBonus');
 const weeklyByChild:Record<string,number>={};
 for(const childId of new Set(records.map(record=>record.childProfileId))) weeklyByChild[childId]=earnedInPeriod(records.filter(record=>record.childProfileId===childId),timezone,'weekly',new Date());
 return {...state,weeklyByChild,weekly:earnedInPeriod(records,timezone,'weekly',new Date())};
}
