import PlaygroundHero from '@/components/shared/PlaygroundHero';
// S1-10: Onboarding Wizard — 8-step flow shown on first launch after account creation
// Collects form data and sends one authenticated server-owned setup request.
// Steps OB-04 through OB-07 are skippable.

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import Alert from '@/services/dialogs';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { setupFamily } from '@/services/families';
import { DEFAULT_VALUES, loadOnboardingDraft, saveOnboardingDraft, clearOnboardingDraft } from '@/services/onboardingDraft';
import type { OnboardingFormData } from '@/services/onboardingDraft';
import { useAuthStore } from '@/stores/authStore';
import AvatarPicker from '@/components/shared/AvatarPicker';
import { colors, spacing, radius, typography, shadows, categoryColors } from '@/constants/tokens';
import type { AgeGroup, Category } from '@/types';

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

// ── Main Component ───────────────────────────────────────────────────────────

export default function OnboardingWizard() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [draftOwner, setDraftOwner] = useState<string | null>(null);
  const [draftNotice, setDraftNotice] = useState<string | null>(null);
  const completed = useRef(false);
  const [skippedSteps, setSkippedSteps] = useState<Set<number>>(new Set());

  const { control, watch, setValue, getValues, reset } = useForm<OnboardingFormData>({
    defaultValues: DEFAULT_VALUES,
    shouldUnregister: false,
    mode: 'onChange',
  });

  const watchedValues = watch();

  useEffect(() => {
    let active = true;
    completed.current = false;
    setDraftReady(false);
    setDraftOwner(null);
    reset(DEFAULT_VALUES);
    setStep(0);
    setSkippedSteps(new Set());
    setDraftNotice(null);
    if (!user?.uid) return;
    loadOnboardingDraft(user.uid).then(draft => {
      if (!active) return;
      if (draft) {
        reset(draft.values);
        setStep(draft.step);
        setSkippedSteps(new Set(draft.skippedSteps));
        setDraftNotice('Your unfinished setup was restored. Re-enter the child PIN to continue; PINs are never saved in drafts.');
      }
    }).catch(() => {
      if (active) setDraftNotice('Saved setup could not be loaded. Please keep the app open until setup finishes.');
    }).finally(() => { if (active) { setDraftOwner(user.uid); setDraftReady(true); } });
    return () => { active = false; };
  }, [user?.uid, reset]);

  useEffect(() => {
    if (!draftReady || !user?.uid || draftOwner !== user.uid || completed.current) return;
    saveOnboardingDraft(user.uid, watchedValues, step, [...skippedSteps]).catch(() => {
      setDraftNotice('Progress could not be saved on this device. Please keep the app open until setup finishes.');
    });
  }, [draftReady, draftOwner, user?.uid, watchedValues, step, skippedSteps]);

  // ── Navigation ───────────────────────────────────────────────────────────

  const goNext = useCallback(async () => {
    // Validate current step before advancing
    const valid = await validateCurrentStep();
    if (!valid) return;
    if (step === 1) setDraftNotice(current => current?.startsWith('Your unfinished setup') ? null : current);
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
      await setupFamily({
        familyName: data.familyName.trim(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        weeklyRequestLimit: data.weeklyRequestLimit,
        ...(!skippedSteps.has(1) && data.childNickname.trim() ? { child: {
          nickname: data.childNickname.trim(), avatarId: data.childAvatarId || 'avatar-01',
          ageGroup: data.childAgeGroup, pin: data.childPin,
          weeklyTargetStars: data.weeklyTarget, monthlyTargetStars: data.monthlyTarget,
        } } : {}),
        ...(!skippedSteps.has(3) && data.taskTitle.trim() ? { task: {
          title: data.taskTitle.trim(), category: data.taskCategory, starValue: data.taskStarValue,
        } } : {}),
        childRewards: skippedSteps.has(4) ? [] : data.childRewards.filter((reward) => reward.name.trim()),
        parentRewards: skippedSteps.has(5) ? [] : data.parentRewards.filter((reward) => reward.name.trim()),
      });

      completed.current = true;
      await clearOnboardingDraft(user.uid).catch(() => {});
      // Navigate to profiles
      router.replace('/profiles');
    } catch (error) {
      console.error('[Onboarding] Setup failed:', error);
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

        {rewards.map((_reward, index) => (
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

  if (!draftReady) return <SafeAreaView style={styles.safeArea}><ActivityIndicator color={colors.navy900} /></SafeAreaView>;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}><PlaygroundHero compact title={step === 0 ? "Let’s build your team!" : step === 1 ? "Meet your little hero" : "Little steps, big wins"} subtitle={`Family setup · ${step + 1} of 8`} avatarId={watch("childAvatarId") || "avatar-06"} /></View>
        {renderProgressDots()}
        {draftNotice && <Text style={{ paddingHorizontal: spacing[4], paddingVertical: spacing[2], color: colors.ink600 }}>{draftNotice}</Text>}

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
          {/* Remount each step so Controllers never change their registered name. */}
          <View key={step}>{renderCurrentStep()}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.cloud,
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
    paddingTop: spacing[2],
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
