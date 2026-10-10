import { Platform } from 'react-native';
import { useDeviceAlerts } from '@/stores/deviceAlerts';
import { scheduleBadgeNotification } from '@/services/notifications';
import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { earnedInPeriod } from '@/utils/leaderboard';
import type { StarTransaction, Achievement } from '@/types';
export function useChildProgress(familyId?: string, childId?: string, timezone = 'UTC') {
 const [state,setState]=useState<{weekly:number;badges:Achievement[];loading:boolean;error:string|null}>({weekly:0,badges:[],loading:true,error:null});
 useEffect(()=>{setState({weekly:0,badges:[],loading:true,error:null});if(!familyId||!childId)return;let active=true; let seenBadges: Set<string> | null = null;
 const ledger=onSnapshot(query(collection(db,'families',familyId,'starTransactions'),where('childProfileId','==',childId)),snapshot=>{if(!active)return;const records=snapshot.docs.map(doc=>doc.data() as StarTransaction).filter(record=>record.transactionType!=='streakBonus'&&record.createdAt);setState(previous=>({...previous,weekly:earnedInPeriod(records,timezone,'weekly',new Date()),loading:false,error:null}));},()=>{if(active)setState(previous=>({...previous,loading:false,error:'Could not load your progress. Please reconnect.'}));});
 const achievements=onSnapshot(query(collection(db,'families',familyId,'achievements'),where('childProfileId','==',childId)),snapshot=>{if(!active)return;const badges=snapshot.docs.map(doc=>({...doc.data(),id:doc.id}) as Achievement);if(seenBadges && Platform.OS !== 'web' && useDeviceAlerts.getState().enabled[familyId]) for(const badge of badges) if(!seenBadges.has(badge.id)) void scheduleBadgeNotification(badge.badgeName ?? badge.badgeId,'You').catch(()=>console.warn('[Notifications] Badge alert could not be scheduled'));seenBadges=new Set(badges.map(badge=>badge.id));setState(previous=>({...previous,badges}));});
 return()=>{active=false;ledger();achievements();};},[familyId,childId,timezone]);return state;
}
