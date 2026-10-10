import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ProgressDisplayStyle } from '@/types';
export const useDisplayPreferences = create<{styles:Record<string,ProgressDisplayStyle>;choose:(id:string,style:ProgressDisplayStyle)=>void}>()(persist(set=>({styles:{},choose:(id,style)=>set(state=>({styles:{...state.styles,[id]:style}}))}),{name:'chorequest:display-preferences:v1',storage:createJSONStorage(()=>AsyncStorage)}));
