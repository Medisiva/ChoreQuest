import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
export function useNetworkStatus() {
  const [isOnline,setOnline]=useState(true);
  useEffect(()=>NetInfo.addEventListener(state=>setOnline(state.isConnected!==false && (Platform.OS==='web' || state.isInternetReachable!==false))),[]);
  return {isOnline};
}
