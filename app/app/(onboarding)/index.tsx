// S1-10: Onboarding Wizard — 8-step flow shown on first launch after account creation
// Collects ALL data in React Hook Form state, writes ONCE at OB-08 via WriteBatch.
// Steps OB-04 through OB-07 are skippable.

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import {
  doc,
  collection,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../src/services/firebase';
import { useAuthStore } from '../../src/stores/authStore';
import AvatarPicker from '../../src/components/shared/AvatarPicker';
import { colors, spacing, radius, typography, shadows, categoryColors } from '../../src/constants/tokens';
import type { AgeGroup, Category } from '../../src/types';

// ── Constants ────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 8;

const AGE_GROUPS: AgeGroup[] = ['3-5', '6-8', '9-11', '12-14', '15-17'];

const AGE_TARGET_MAP: Record<AgeGroup, number> = {
  '3-5': 10,
  '6-8': 15,
  '9-11': 20,
  '12-14': 25,
  '15-17': 30,
};

const CATEGORIES: { key: Category; label: string; icon: string }[] = [
  { key: 'Household', label: 'Household', icon: categoryColors.Household.icon },
  { key: 'Learning', label: 'Learning', icon: categoryColors.Learning.icon },
  { key: 'LifeSkills', label: 'Life Skills', icon: categoryColors.LifeSkills.icon },
  { key: 'Hobbies', label: 'Hobbies', icon: categoryColors.Hobbies.icon },
];

// ── Form Data Shape ──────────────────────────────────────────────────────────

interface OnboardingFormData {
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

const DEFAULT_VALUES: OnboardingFormData = {
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

// ── Hash utility (simple hash for PIN — in production, use Cloud Function) ───

function simpleHash(pin: string): string {
  // Simple hash for demo/dev — real app should hash server-side
  let hash = 0;
  for (let i = 0; i < pin.length; i++) {
    const char = pin.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function OnboardingWizard() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [skippedSteps, setSkippedSteps] = useState<Set<number>>(new Set());

  const { control, watch, setValue, getValues, handleSubmit, trigger } = useForm<OnboardingFormData>({
    defaultValues: DEFAULT_VALUES,
    mode: 'onChange',
  });

  const watchedValues = watch();

  // ── Navigation ───────────────────────────────────────────────────────────

  const goNext = useCallback(async () => {
    // Validate current step before advancing
    const valid = await validateCurrentStep();
    if (!valid) return;
    if (step < TOTAL_STEPS - 1) setStep((s) => s + 1);
  }, [step]);

  const goBack = useCallback(() => {
    if (step > 0) setStep((s) => s - 1);
  }, [step]);

  const skipStep = useCallback(() => {
    setSkippedSteps((prev) => new Set(prev).add(step));
    if (step < TOTAL_STEPS - 1) setStep((s) => s + 1);
  }, [step]);

  // ── Validation per step ──────────────────────────────────────────────────

  const validateCurrentStep = useCallback(async (): Promise<boolean> => {
    const values = getValues();

    switch (step) {
      case 0: // Family Name
        if (!values.familyName.trim()) {
          Alert.alert('Required', 'Please enter your family name.');
          return false;
        }
        return true;

      case 1: // First Child
        if (!values.childNickname.trim()) {
          Alert.alert('Required', 'Please enter a nickname.');
          return false;
        }
        if (!values.childAvatarId) {
          Alert.alert('Required', 'Please select an avatar.');
          return false;
        }
        if (values.childPin.length !== 4 || !/^\d{4}$/.test(values.childPin)) {
          Alert.alert('Invalid PIN', 'PIN must be exactly 4 digits.');
          return false;
        }
        if (values.childPin !== values.childPinConfirm) {
          Alert.alert('PIN Mismatch', 'PINs do not match. Please try again.');
          return false;
        }
        return true;

      case 2: // Weekly Target
        if (values.weeklyTarget < 1) {
          Alert.alert('Invalid', 'Weekly target must be at least 1.');
          return false;
        }
        return true;

      default:
        return true;
    }
  }, [step, getValues]);

  // ── Age group change handler ─────────────────────────────────────────────

  const handleAgeGroupChange = useCallback(
    (ageGroup: AgeGroup) => {
      setValue('childAgeGroup', ageGroup);
      const suggested = AGE_TARGET_MAP[ageGroup];
      setValue('weeklyTarget', suggested);
      setValue('monthlyTarget', suggested * 4);
    },
    [setValue]
  );

  // ── Firestore write at OB-08 ────────────────────────────────────────────

  const finishOnboarding = useCallback(async () => {
    if (!user) {
      Alert.alert('Error', 'No authenticated user found.');
      return;
    }

    setSaving(true);

    try {
      const data = getValues();
      const batch = writeBatch(db);
      const now = Timestamp.now();
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      // 1. Create family document
      const familyRef = doc(collection(db, 'families'));
      const familyId = familyRef.id;

      batch.set(familyRef, {
        familyName: data.familyName.trim(),
        memberIds: [user.uid],
        createdAt: now,
        timezone,
        isDeleted: false,
      });

      // 2. Create parent user document
      const parentRef = doc(db, 'families', familyId, 'parentUsers', user.uid);
      batch.set(parentRef, {
        familyAccountId: familyId,
        firebaseUid: user.uid,
        displayName: user.displayName ?? 'Parent',
        avatarId: 'default-parent',
        starBalance: 0,
        totalStarsEarned: 0,
        totalStarsRedeemed: 0,
        createdAt: now,
      });

      // 3. Create parentProfiles mapping for quick lookup
      const profileMappingRef = doc(db, 'parentProfiles', user.uid);
      batch.set(profileMappingRef, {
        familyAccountId: familyId,
        displayName: user.displayName ?? 'Parent',
        avatarId: 'default-parent',
        starBalance: 0,
        totalStarsEarned: 0,
        totalStarsRedeemed: 0,
        createdAt: now,
      });

      // 4. Create child profile (if not skipped)
      let childId: string | null = null;
      if (!skippedSteps.has(1) && data.childNickname.trim()) {
        const childRef = doc(collection(db, 'families', familyId, 'childProfiles'));
        childId = childRef.id;

        batch.set(childRef, {
          familyAccountId: familyId,
          nickname: data.childNickname.trim(),
          avatarId: data.childAvatarId || 'avatar-01',
          ageGroup: data.childAgeGroup,
          pinHash: simpleHash(data.childPin),
          starBalance: 0,
          totalStarsEarned: 0,
          totalStarsRedeemed: 0,
          weeklyTargetStars: data.weeklyTarget,
          monthlyTargetStars: data.monthlyTarget,
          progressDisplayStyle: 'ProgressBar',
          currentStreakWeeks: 0,
          consecutiveMissWeeks: 0,
          monthlyConsecutiveMisses: 0,
          streakThreshold: 4,
          streakBonusStars: 10,
          failedPinAttempts: 0,
          createdAt: now,
        });

        // 5. Create family settings with request limit
        const settingsRef = doc(db, 'families', familyId, 'settings', 'main');
        batch.set(settingsRef, {
          leaderboardEnabled: true,
          weeklyRequestLimitPerChild: {
            [childRef.id]: data.weeklyRequestLimit,
          },
        });
      }

      // 6. Create first task (if not skipped)
      if (!skippedSteps.has(3) && data.taskTitle.trim()) {
        const taskRef = doc(collection(db, 'families', familyId, 'tasks'));
        batch.set(taskRef, {
          familyAccountId: familyId,
          title: data.taskTitle.trim(),
          category: data.taskCategory,
          starValue: data.taskStarValue,
          difficulty: 'Easy',
          ageGroupSuggestion: data.childAgeGroup,
          isActive: true,
          requiresPhoto: false,
          isMilestone: false,
          recurrenceType: 'none',
          createdByParentId: user.uid,
          createdAt: now,
        });
      }

      // 7. Create child rewards (if not skipped)
      if (!skippedSteps.has(4) && data.childRewards.length > 0) {
        for (const reward of data.childRewards) {
          if (reward.name.trim()) {
            const rewardRef = doc(collection(db, 'families', familyId, 'rewards'));
            batch.set(rewardRef, {
              familyAccountId: familyId,
              name: reward.name.trim(),
              starCost: reward.starCost,
              rewardType: 'Special',
              isActive: true,
              createdByParentId: user.uid,
              createdAt: now,
            });
          }
        }
      }

      // 8. Create parent rewards (if not skipped)
      if (!skippedSteps.has(5) && data.parentRewards.length > 0) {
        for (const reward of data.parentRewards) {
          if (reward.name.trim()) {
            const rewardRef = doc(collection(db, 'families', familyId, 'parentRewards'));
            batch.set(rewardRef, {
              familyAccountId: familyId,
              name: reward.name.trim(),
              starCost: reward.starCost,
              rewardType: 'Special',
              addedBy: 'parent',
              approvedByParent: true,
              isActive: true,
              createdAt: now,
            });
          }
        }
      }

      // 9. Create leaderboard summary
      const leaderboardRef = doc(db, 'families', familyId, 'leaderboard', 'summary');
      batch.set(leaderboardRef, {
        weekly: {},
        monthly: {},
        allTime: {},
        updatedAt: now,
      });

      // Commit everything atomically
      await batch.commit();

      // Navigate to profiles
      router.replace('/profiles');
    } catch (error) {
      console.error('[Onboarding] WriteBatch failed:', error);
      Alert.alert('Error', 'Failed to save your setup. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [user, getValues, skippedSteps, router]);

  // ── Progress Dots ────────────────────────────────────────────────────────

  const renderProgressDots = () => (
    <View style={styles.dotsContainer}>
      {Array.from({ length: TOTAL_STEPS }, (_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i <= step ? styles.dotActive : styles.dotInactive,
          ]}
        />
      ))}
    </View>
  );

  // ── Step Renderers ───────────────────────────────────────────────────────

  const renderStep0_FamilyName = () => (
    <View style={styles.stepContent}>
      <Text style={styles.heading}>Set up your family account</Text>
      <Text style={styles.subheading}>
        What do you call your family? (e.g. The Smiths)
      </Text>
      <Controller
        control={control}
        name="familyName"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            style={styles.textInput}
            placeholder="The Smiths"
            placeholderTextColor={colors.ink400}
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            autoFocus
            returnKeyType="next"
          />
        )}
      />
      <TouchableOpacity style={styles.primaryButton} onPress={goNext}>
        <Text style={styles.primaryButtonText}>Next</Text>
      </TouchableOpacity>
    </View>
  );

  const renderStep1_FirstChild = () => (
    <View style={styles.stepContent}>
      <Text style={styles.heading}>Add your first child</Text>

      <Text style={styles.fieldLabel}>Nickname</Text>
      <Controller
        control={control}
        name="childNickname"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            style={styles.textInput}
            placeholder="e.g. Alex"
            placeholderTextColor={colors.ink400}
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
          />
        )}
      />

      <Text style={styles.fieldLabel}>Choose an avatar</Text>
      <AvatarPicker
        selectedId={watchedValues.childAvatarId}
        onSelect={(id) => setValue('childAvatarId', id)}
        accentColor={colors.navy500}
      />

      <Text style={styles.fieldLabel}>Age group</Text>
      <View style={styles.ageGroupRow}>
        {AGE_GROUPS.map((ag) => (
          <TouchableOpacity
            key={ag}
            style={[
              styles.ageGroupChip,
              watchedValues.childAgeGroup === ag && styles.ageGroupChipActive,
            ]}
            onPress={() => handleAgeGroupChange(ag)}
          >
            <Text
              style={[
                styles.ageGroupText,
                watchedValues.childAgeGroup === ag && styles.ageGroupTextActive,
              ]}
            >
              {ag}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.fieldLabel}>Set a 4-digit PIN</Text>
      <Controller
        control={control}
        name="childPin"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            style={styles.textInput}
            placeholder="Enter PIN"
            placeholderTextColor={colors.ink400}
            value={value}
            onChangeText={(text) => onChange(text.replace(/[^0-9]/g, '').slice(0, 4))}
            onBlur={onBlur}
            keyboardType="number-pad"
            maxLength={4}
            secureTextEntry
          />
        )}
      />

      <Text style={styles.fieldLabel}>Confirm PIN</Text>
      <Controller
        control={control}
        name="childPinConfirm"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            style={styles.textInput}
            placeholder="Confirm PIN"
            placeholderTextColor={colors.ink400}
            value={value}
            onChangeText={(text) => onChange(text.replace(/[^0-9]/g, '').slice(0, 4))}
            onBlur={onBlur}
            keyboardType="number-pad"
            maxLength={4}
            secureTextEntry
          />
        )}
      />

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.secondaryButton} onPress={skipStep}>
          <Text style={styles.secondaryButtonText}>Skip</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primaryButton} onPress={goNext}>
          <Text style={styles.primaryButtonText}>Next</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderStep2_WeeklyTarget = () => {
    const nickname = watchedValues.childNickname || 'your child';
    return (
      <View style={styles.stepContent}>
        <Text style={styles.heading}>Set a weekly target for {nickname}</Text>
        <Text style={styles.subheading}>
          Based on age group {watchedValues.childAgeGroup}, we suggest{' '}
          {AGE_TARGET_MAP[watchedValues.childAgeGroup]} stars per week.
        </Text>

        <Text style={styles.fieldLabel}>Weekly star target</Text>
        <Controller
          control={control}
          name="weeklyTarget"
          render={({ field: { onChange, value } }) => (
            <View style={styles.numberInputRow}>
              <TouchableOpacity
                style={styles.numberButton}
                onPress={() => {
                  const next = Math.max(1, value - 5);
                  onChange(next);
                  setValue('monthlyTarget', next * 4);
                }}
              >
                <Text style={styles.numberButtonText}>-</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.numberInput}
                value={String(value)}
                onChangeText={(text) => {
                  const num = parseInt(text, 10) || 0;
                  onChange(num);
                  setValue('monthlyTarget', num * 4);
                }}
                keyboardType="number-pad"
              />
              <TouchableOpacity
                style={styles.numberButton}
                onPress={() => {
                  const next = value + 5;
                  onChange(next);
                  setValue('monthlyTarget', next * 4);
                }}
              >
                <Text style={styles.numberButtonText}>+</Text>
              </TouchableOpacity>
            </View>
          )}
        />

        <Text style={styles.fieldLabel}>Monthly star target</Text>
        <Controller
          control={control}
          name="monthlyTarget"
          render={({ field: { onChange, value } }) => (
            <View style={styles.numberInputRow}>
              <TouchableOpacity
                style={styles.numberButton}
                onPress={() => onChange(Math.max(1, value - 20))}
              >
                <Text style={styles.numberButtonText}>-</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.numberInput}
                value={String(value)}
                onChangeText={(text) => onChange(parseInt(text, 10) || 0)}
                keyboardType="number-pad"
              />
              <TouchableOpacity
                style={styles.numberButton}
                onPress={() => onChange(value + 20)}
              >
                <Text style={styles.numberButtonText}>+</Text>
              </TouchableOpacity>
            </View>
          )}
        />

        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.secondaryButton} onPress={skipStep}>
            <Text style={styles.secondaryButtonText}>Skip</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryButton} onPress={goNext}>
            <Text style={styles.primaryButtonText}>Next</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderStep3_FirstTask = () => (
    <View style={styles.stepContent}>
      <Text style={styles.heading}>Create your first Quest</Text>
      <Text style={styles.subheading}>
        Pre-filled example: Clean your bedroom — 15 stars
      </Text>

      <Text style={styles.fieldLabel}>Task title</Text>
      <Controller
        control={control}
        name="taskTitle"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            style={styles.textInput}
            placeholder="e.g. Clean your bedroom"
            placeholderTextColor={colors.ink400}
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
          />
        )}
      />

      <Text style={styles.fieldLabel}>Category</Text>
      <View style={styles.categoryGrid}>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.key}
            style={[
              styles.categoryTile,
              watchedValues.taskCategory === cat.key && styles.categoryTileActive,
              {
                backgroundColor:
                  watchedValues.taskCategory === cat.key
                    ? categoryColors[cat.key].light
                    : colors.ink50,
              },
            ]}
            onPress={() => setValue('taskCategory', cat.key)}
          >
            <Text style={styles.categoryIcon}>{cat.icon}</Text>
            <Text
              style={[
                styles.categoryLabel,
                watchedValues.taskCategory === cat.key && {
                  color: categoryColors[cat.key].deep,
                },
              ]}
            >
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.fieldLabel}>Star value</Text>
      <Controller
        control={control}
        name="taskStarValue"
        render={({ field: { onChange, value } }) => (
          <View style={styles.numberInputRow}>
            <TouchableOpacity
              style={styles.numberButton}
              onPress={() => onChange(Math.max(1, value - 5))}
            >
              <Text style={styles.numberButtonText}>-</Text>
            </TouchableOpacity>
            <View style={styles.starValueDisplay}>
              <Text style={styles.starEmoji}>&#11088;</Text>
              <Text style={styles.starValueText}>{value}</Text>
            </View>
            <TouchableOpacity
              style={styles.numberButton}
              onPress={() => onChange(value + 5)}
            >
              <Text style={styles.numberButtonText}>+</Text>
            </TouchableOpacity>
          </View>
        )}
      />

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.secondaryButton} onPress={skipStep}>
          <Text style={styles.secondaryButtonText}>Skip</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primaryButton} onPress={goNext}>
          <Text style={styles.primaryButtonText}>Post this Quest</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderRewardStep = (
    fieldName: 'childRewards' | 'parentRewards',
    heading: string,
  ) => {
    const rewards = watchedValues[fieldName];

    return (
      <View style={styles.stepContent}>
        <Text style={styles.heading}>{heading}</Text>

        {rewards.map((reward, index) => (
          <View key={index} style={styles.rewardCard}>
            <Controller
              control={control}
              name={`${fieldName}.${index}.name`}
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={styles.textInput}
                  placeholder="Reward name"
                  placeholderTextColor={colors.ink400}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                />
              )}
            />
            <Controller
              control={control}
              name={`${fieldName}.${index}.starCost`}
              render={({ field: { onChange, value } }) => (
                <View style={styles.numberInputRow}>
                  <TouchableOpacity
                    style={styles.numberButton}
                    onPress={() => onChange(Math.max(1, value - 5))}
                  >
                    <Text style={styles.numberButtonText}>-</Text>
                  </TouchableOpacity>
                  <View style={styles.starValueDisplay}>
                    <Text style={styles.starEmoji}>&#11088;</Text>
                    <Text style={styles.starValueText}>{value}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.numberButton}
                    onPress={() => onChange(value + 5)}
                  >
                    <Text style={styles.numberButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              )}
            />
          </View>
        ))}

        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            const current = getValues(fieldName);
            setValue(fieldName, [...current, { name: '', starCost: 20 }]);
          }}
        >
          <Text style={styles.addButtonText}>+ Add reward</Text>
        </TouchableOpacity>

        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.secondaryButton} onPress={skipStep}>
            <Text style={styles.secondaryButtonText}>Skip</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryButton} onPress={goNext}>
            <Text style={styles.primaryButtonText}>Next</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderStep4_ChildRewards = () => {
    const nickname = watchedValues.childNickname || 'your child';
    return renderRewardStep('childRewards', `What can ${nickname} earn?`);
  };

  const renderStep5_ParentRewards = () =>
    renderRewardStep('parentRewards', 'What can YOU earn?');

  const renderStep6_RequestLimit = () => {
    const nickname = watchedValues.childNickname || 'your child';
    return (
      <View style={styles.stepContent}>
        <Text style={styles.heading}>
          How many Requests can {nickname} make each week?
        </Text>

        <Controller
          control={control}
          name="weeklyRequestLimit"
          render={({ field: { onChange, value } }) => (
            <View style={styles.numberInputRowLarge}>
              <TouchableOpacity
                style={styles.numberButtonLarge}
                onPress={() => onChange(Math.max(1, value - 1))}
              >
                <Text style={styles.numberButtonTextLarge}>-</Text>
              </TouchableOpacity>
              <Text style={styles.numberDisplayLarge}>{value}</Text>
              <TouchableOpacity
                style={styles.numberButtonLarge}
                onPress={() => onChange(Math.min(10, value + 1))}
              >
                <Text style={styles.numberButtonTextLarge}>+</Text>
              </TouchableOpacity>
            </View>
          )}
        />

        <TouchableOpacity style={styles.primaryButton} onPress={goNext}>
          <Text style={styles.primaryButtonText}>Next</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderStep7_Complete = () => {
    const data = getValues();
    const firstReward =
      data.childRewards.length > 0 ? data.childRewards[0].name : 'None yet';

    return (
      <View style={styles.stepContent}>
        <Text style={styles.headingCentered}>You're all set! 🎉</Text>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Your Family Setup</Text>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Family</Text>
            <Text style={styles.summaryValue}>{data.familyName || '—'}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Child</Text>
            <Text style={styles.summaryValue}>
              {data.childNickname || 'Skipped'}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>First Quest</Text>
            <Text style={styles.summaryValue}>
              {skippedSteps.has(3)
                ? 'Skipped'
                : `${data.taskTitle} — ${data.taskStarValue} stars`}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>First Reward</Text>
            <Text style={styles.summaryValue}>
              {skippedSteps.has(4) ? 'Skipped' : firstReward}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, styles.ctaButton]}
          onPress={finishOnboarding}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.primaryButtonText}>Go to Dashboard</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  // ── Step Router ──────────────────────────────────────────────────────────

  const renderCurrentStep = () => {
    switch (step) {
      case 0:
        return renderStep0_FamilyName();
      case 1:
        return renderStep1_FirstChild();
      case 2:
        return renderStep2_WeeklyTarget();
      case 3:
        return renderStep3_FirstTask();
      case 4:
        return renderStep4_ChildRewards();
      case 5:
        return renderStep5_ParentRewards();
      case 6:
        return renderStep6_RequestLimit();
      case 7:
        return renderStep7_Complete();
      default:
        return null;
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {renderProgressDots()}

        {step > 0 && (
          <TouchableOpacity style={styles.backButton} onPress={goBack}>
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        )}

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {renderCurrentStep()}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.white,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[10],
  },

  // Progress dots
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing[4],
    gap: spacing[2],
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: radius.full,
  },
  dotActive: {
    backgroundColor: colors.navy500,
  },
  dotInactive: {
    backgroundColor: colors.ink400,
    opacity: 0.3,
  },

  // Back button
  backButton: {
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[2],
  },
  backButtonText: {
    ...typography.button,
    color: colors.navy500,
  },

  // Step content
  stepContent: {
    flex: 1,
    paddingTop: spacing[6],
  },

  // Typography
  heading: {
    ...typography.heading1,
    color: colors.ink950,
    marginBottom: spacing[3],
  },
  headingCentered: {
    ...typography.heading1,
    color: colors.ink950,
    textAlign: 'center',
    marginBottom: spacing[6],
  },
  subheading: {
    ...typography.body1,
    color: colors.ink600,
    marginBottom: spacing[6],
  },
  fieldLabel: {
    ...typography.label,
    color: colors.ink950,
    marginBottom: spacing[2],
    marginTop: spacing[4],
  },

  // Text input
  textInput: {
    ...typography.body1,
    borderWidth: 1,
    borderColor: colors.ink400,
    borderRadius: radius.md,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    color: colors.ink950,
    backgroundColor: colors.ink50,
  },

  // Number input
  numberInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  numberInput: {
    ...typography.heading2,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: colors.ink400,
    borderRadius: radius.md,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    minWidth: 80,
    color: colors.ink950,
    backgroundColor: colors.ink50,
  },
  numberButton: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.navy50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  numberButtonText: {
    ...typography.heading2,
    color: colors.navy900,
  },

  // Large number picker (request limit)
  numberInputRowLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[8],
    marginTop: spacing[10],
    marginBottom: spacing[10],
  },
  numberButtonLarge: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.navy50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  numberButtonTextLarge: {
    ...typography.heading1,
    color: colors.navy900,
  },
  numberDisplayLarge: {
    ...typography.display1,
    color: colors.ink950,
    minWidth: 60,
    textAlign: 'center',
  },

  // Star value display
  starValueDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderWidth: 1,
    borderColor: colors.starGold,
    borderRadius: radius.md,
    backgroundColor: colors.cream,
    minWidth: 80,
    justifyContent: 'center',
  },
  starEmoji: {
    fontSize: 18,
  },
  starValueText: {
    ...typography.heading3,
    color: colors.ink950,
  },

  // Age group selector
  ageGroupRow: {
    flexDirection: 'row',
    gap: spacing[2],
    flexWrap: 'wrap',
  },
  ageGroupChip: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.ink400,
    backgroundColor: colors.ink50,
  },
  ageGroupChipActive: {
    borderColor: colors.navy500,
    backgroundColor: colors.navy50,
  },
  ageGroupText: {
    ...typography.label,
    color: colors.ink600,
  },
  ageGroupTextActive: {
    color: colors.navy900,
  },

  // Category tiles
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
  },
  categoryTile: {
    width: '47%',
    paddingVertical: spacing[4],
    borderRadius: radius.lg,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  categoryTileActive: {
    borderColor: colors.navy500,
  },
  categoryIcon: {
    fontSize: 28,
    marginBottom: spacing[1],
  },
  categoryLabel: {
    ...typography.label,
    color: colors.ink600,
  },

  // Reward card
  rewardCard: {
    padding: spacing[4],
    backgroundColor: colors.ink50,
    borderRadius: radius.lg,
    marginBottom: spacing[3],
    gap: spacing[3],
    ...shadows.elevation1,
  },

  // Add button
  addButton: {
    paddingVertical: spacing[3],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.navy500,
    borderRadius: radius.md,
    borderStyle: 'dashed',
    marginBottom: spacing[6],
  },
  addButtonText: {
    ...typography.button,
    color: colors.navy500,
  },

  // Summary card
  summaryCard: {
    backgroundColor: colors.ink50,
    borderRadius: radius.xl,
    padding: spacing[6],
    marginBottom: spacing[8],
    ...shadows.elevation2,
  },
  summaryTitle: {
    ...typography.heading3,
    color: colors.navy900,
    marginBottom: spacing[4],
    textAlign: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.ink400 + '30',
  },
  summaryLabel: {
    ...typography.label,
    color: colors.ink600,
  },
  summaryValue: {
    ...typography.body1,
    color: colors.ink950,
    fontFamily: 'Inter_600SemiBold',
    flexShrink: 1,
    textAlign: 'right',
  },

  // Buttons
  primaryButton: {
    backgroundColor: colors.navy500,
    paddingVertical: spacing[4],
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing[6],
  },
  primaryButtonText: {
    ...typography.button,
    color: colors.white,
  },
  secondaryButton: {
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[6],
    borderRadius: radius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.ink400,
  },
  secondaryButtonText: {
    ...typography.button,
    color: colors.ink600,
  },
  ctaButton: {
    backgroundColor: colors.success,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing[3],
    marginTop: spacing[6],
    justifyContent: 'flex-end',
  },
});
