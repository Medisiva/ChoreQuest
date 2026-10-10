import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AgeGroup, Category } from '../types';

export interface OnboardingFormData {
  // OB-01
  familyName: string;
  // OB-02
  childNickname: string;
  childAvatarId: string;
  childAgeGroup: AgeGroup;
  childPin: string;
  childPinConfirm: string;
  // OB-03
  weeklyTarget: number;
  monthlyTarget: number;
  // OB-04
  taskTitle: string;
  taskCategory: Category;
  taskStarValue: number;
  // OB-05
  childRewards: Array<{ name: string; starCost: number }>;
  // OB-06
  parentRewards: Array<{ name: string; starCost: number }>;
  // OB-07
  weeklyRequestLimit: number;
}

export const DEFAULT_VALUES: OnboardingFormData = {
  familyName: '',
  childNickname: '',
  childAvatarId: '',
  childAgeGroup: '6-8',
  childPin: '',
  childPinConfirm: '',
  weeklyTarget: 15,
  monthlyTarget: 60,
  taskTitle: 'Clean your bedroom',
  taskCategory: 'Household',
  taskStarValue: 15,
  childRewards: [
    { name: '30 min screen time', starCost: 20 },
    { name: 'Movie night', starCost: 50 },
  ],
  parentRewards: [
    { name: 'Coffee shop treat', starCost: 30 },
    { name: 'Movie of my choice', starCost: 60 },
  ],
  weeklyRequestLimit: 3,
};

const fields = ['familyName', 'childNickname', 'childAvatarId', 'childAgeGroup', 'weeklyTarget', 'monthlyTarget', 'taskTitle', 'taskCategory', 'taskStarValue', 'childRewards', 'parentRewards', 'weeklyRequestLimit'] as const;
const keyFor = (uid: string) => `chorequest:onboarding:v1:${uid}`;
const queues = new Map<string, Promise<void>>();
function enqueue(key: string, operation: () => Promise<void>): Promise<void> {
  const next = (queues.get(key) ?? Promise.resolve()).catch(() => {}).then(operation);
  queues.set(key, next);
  void next.finally(() => { if (queues.get(key) === next) queues.delete(key); }).catch(() => {});
  return next;
}

export function encodeDraft(values: OnboardingFormData, step: number, skippedSteps: number[]): string {
  // Explicit allowlist: never persist PINs, confirmation PINs or auth credentials.
  const safe = Object.fromEntries(fields.map(field => [field, values[field]]));
  return JSON.stringify({ version: 1, values: safe, step, skippedSteps });
}

export function decodeDraft(raw: string | null): { values: OnboardingFormData; step: number; skippedSteps: number[] } | null {
  if (!raw) return null;
  try {
    const draft = JSON.parse(raw);
    if (draft.version !== 1 || !draft.values || typeof draft.values !== 'object') return null;
    const values = { ...DEFAULT_VALUES, childRewards: DEFAULT_VALUES.childRewards.map(r => ({ ...r })), parentRewards: DEFAULT_VALUES.parentRewards.map(r => ({ ...r })) };
    for (const field of fields) {
      const value = draft.values[field];
      if (field === 'childRewards' || field === 'parentRewards') {
        if (Array.isArray(value)) values[field] = value.slice(0, 20).filter(r => typeof r?.name === 'string' && Number.isSafeInteger(r.starCost) && r.starCost > 0 && r.starCost <= 10000).map(r => ({ name: r.name.slice(0, 80), starCost: r.starCost }));
      } else if (typeof value === typeof DEFAULT_VALUES[field] && (typeof value !== 'number' || (Number.isSafeInteger(value) && value >= 0 && value <= 10000))) {
        Object.assign(values, { [field]: typeof value === 'string' ? value.slice(0, 120) : value });
      }
    }
    if (!['3-5','6-8','9-11','12-14','15-17'].includes(values.childAgeGroup)) values.childAgeGroup = '6-8';
    if (!['Household','Learning','LifeSkills','Hobbies'].includes(values.taskCategory)) values.taskCategory = 'Household';
    values.childPin = ''; values.childPinConfirm = '';
    const skippedSteps: number[] = Array.isArray(draft.skippedSteps) ? draft.skippedSteps.filter((n: unknown) => Number.isInteger(n) && Number(n) >= 1 && Number(n) <= 5) : [];
    let step = Number.isInteger(draft.step) && draft.step >= 0 && draft.step <= 7 ? draft.step : 0;
    if (step > 1 && !skippedSteps.includes(1)) step = 1; // Re-enter unsaved PIN before proceeding.
    return { values, step, skippedSteps };
  } catch { return null; }
}

export async function loadOnboardingDraft(uid: string) {
  const key = keyFor(uid);
  await queues.get(key)?.catch(() => {});
  return decodeDraft(await AsyncStorage.getItem(key));
}
export function saveOnboardingDraft(uid: string, values: OnboardingFormData, step: number, skippedSteps: number[]) {
  const key = keyFor(uid), encoded = encodeDraft(values, step, skippedSteps);
  return enqueue(key, () => AsyncStorage.setItem(key, encoded));
}
export function clearOnboardingDraft(uid: string) {
  const key = keyFor(uid);
  return enqueue(key, () => AsyncStorage.removeItem(key));
}
