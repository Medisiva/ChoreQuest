import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useRequestStore } from '@/stores/requestStore';
import { useDeviceAlerts } from '@/stores/deviceAlerts';
import { scheduleRequestNotification } from '@/services/notifications';
export function useDeviceRequestAlerts(familyId: string | null, role: string | null) {
 useEffect(() => {
  if (!familyId || role !== 'parent' || Platform.OS === 'web') return;
  const seen = new Set(useRequestStore.getState().requests.map(request => request.id)); const startedAt = Date.now();
  return useRequestStore.subscribe(state => {
   for (const request of state.requests) {
    if (seen.has(request.id) || !request.createdAt) continue;
    seen.add(request.id);
    if (request.familyAccountId === familyId && request.status === 'pending' && request.createdAt.toMillis() >= startedAt && useDeviceAlerts.getState().enabled[familyId]) void scheduleRequestNotification(request.title).catch(() => console.warn('[Notifications] Device alert could not be scheduled'));
   }
  });
 }, [familyId, role]);
}
