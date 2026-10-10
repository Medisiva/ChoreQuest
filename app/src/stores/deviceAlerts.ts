import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
export const useDeviceAlerts = create<{ enabled: Record<string, boolean>; choose: (familyId: string, enabled: boolean) => void }>()(persist(set => ({ enabled: {}, choose: (familyId, enabled) => set(state => ({ enabled: { ...state.enabled, [familyId]: enabled } })) }), { name: 'chorequest:device-alerts:v1', storage: createJSONStorage(() => AsyncStorage) }));
