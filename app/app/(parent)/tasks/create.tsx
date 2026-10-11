import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  } from 'react-native';
import Alert from '@/services/dialogs';
import { saveErrorMessage } from '@/services/errorMessage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { db } from '@/services/firebase';
import type { TaskLibraryItem } from '@/types';
import { Timestamp, doc, getDoc } from 'firebase/firestore';
import { createTask } from '@/services/tasks';
import { useAuthStore } from '@/stores/authStore';
import { useFamilyStore } from '@/stores/familyStore';

// ── Types ────────────────────────────────────────────────────────────────────

type Category = 'Household' | 'Learning' | 'LifeSkills' | 'Hobbies';
type AgeGroup = '3-5' | '6-8' | '9-11' | '12-14' | '15-17';
type Difficulty = 'Easy' | 'Medium' | 'Hard' | 'AdultSupervised';
type Recurrence = 'none' | 'daily' | 'weekly' | 'monthly';

interface TaskFormData {
  title: string;
  description: string;
  category: Category;
  ageGroup: AgeGroup;
  starValue: number;
  difficulty: Difficulty;
  isMilestone: boolean;
  milestoneSteps: number;
  starsPerStep: number;
  milestoneBonus: number;
  recurrenceType: Recurrence;
  requiresPhoto: boolean;
  hasDeadline: boolean;
  deadlineDate: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: { key: Category; emoji: string; deep: string; light: string }[] = [
  { key: 'Household', emoji: '🏠', deep: '#65F3FF', light: '#17363A' },
  { key: 'Learning', emoji: '📚', deep: '#B7A1FF', light: '#302445' },
  { key: 'LifeSkills', emoji: '🌱', deep: '#CDFF65', light: '#26351D' },
  { key: 'Hobbies', emoji: '🎨', deep: '#FFBA82', light: '#392719' },
];

const AGE_GROUPS: AgeGroup[] = ['3-5', '6-8', '9-11', '12-14', '15-17'];

const DIFFICULTIES: { key: Difficulty; label: string; color: string }[] = [
  { key: 'Easy', label: 'Easy', color: '#CDFF65' },
  { key: 'Medium', label: 'Medium', color: '#FFE177' },
  { key: 'Hard', label: 'Hard', color: '#FF92A7' },
  { key: 'AdultSupervised', label: 'Adult Supervised', color: '#B7A1FF' },
];

const RECURRENCE_OPTIONS: { key: Recurrence; label: string }[] = [
  { key: 'none', label: 'One-off' },
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
];

const TOTAL_STEPS = 4;

// ── Component ────────────────────────────────────────────────────────────────

export default function CreateTaskScreen() {
  const router = useRouter();
  const { libraryId } = useLocalSearchParams<{libraryId?:string}>();
  const user = useAuthStore((state) => state.user);
  const family = useFamilyStore((state) => state.family);
  const [currentStep, setCurrentStep] = useState(1);

  const { control, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<TaskFormData>({
    defaultValues: {
      title: '',
      description: '',
      category: 'Household',
      ageGroup: '6-8',
      starValue: 10,
      difficulty: 'Easy',
      isMilestone: false,
      milestoneSteps: 3,
      starsPerStep: 5,
      milestoneBonus: 10,
      recurrenceType: 'none',
      requiresPhoto: false,
      hasDeadline: false,
      deadlineDate: '',
    },
  });

  useEffect(() => {
    if(!libraryId)return; let active=true;
    getDoc(doc(db,'taskLibrary',libraryId)).then(snapshot=>{if(!active||!snapshot.exists())return; const item=snapshot.data() as TaskLibraryItem;
      setValue('title',item.title);setValue('description',item.description);setValue('category',item.category);setValue('ageGroup',item.ageGroupSuggestion);setValue('starValue',item.suggestedStars);setValue('difficulty',item.difficulty);setValue('isMilestone',item.isMilestone);setValue('milestoneSteps',item.milestoneSteps??3);setValue('starsPerStep',item.starsPerStep??5);setValue('milestoneBonus',item.milestoneBonus??0);
    }).catch(()=>Alert.alert('Template not loaded','Please return to the library and try again.'));
    return()=>{active=false;};
  },[libraryId,setValue]);
  const watchAll = watch();

  // ── Navigation ───────────────────────────────────────────────────────────

  const canGoNext = (): boolean => {
    if (currentStep === 1) {
      return watchAll.title.trim().length > 0;
    }
    return true;
  };

  const goNext = () => {
    if(currentStep===1 && !watchAll.title.trim()){Alert.alert('Quest title required','Enter a title before continuing.');return;}
    if(currentStep===2 && watchAll.isMilestone && (!Number.isInteger(watchAll.milestoneSteps) || watchAll.milestoneSteps<1 || watchAll.milestoneSteps>31 || !Number.isInteger(watchAll.starsPerStep) || watchAll.starsPerStep<1 || watchAll.starsPerStep>1000 || !Number.isInteger(watchAll.milestoneBonus) || watchAll.milestoneBonus<0 || watchAll.milestoneBonus>1000)){Alert.alert('Check milestone details','Choose 1–31 steps, 1–1,000 stars per step and a 0–1,000 completion bonus.');return;}

    if (currentStep < TOTAL_STEPS && canGoNext()) {
      setCurrentStep((s) => s + 1);
    }
  };

  const goBack = () => {
    if (currentStep > 1) {
      setCurrentStep((s) => s - 1);
    } else {
      router.back();
    }
  };

  const onSubmit = async (data: TaskFormData) => {
    if (!family || !user) {
      Alert.alert('Unable to post quest', 'Please sign in and reload your family.');
      return;
    }
    let deadline: Timestamp | undefined;
    if (data.hasDeadline) {
      const date = new Date(`${data.deadlineDate}T23:59:59`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(data.deadlineDate) || !Number.isFinite(date.getTime()) || date < new Date()) {
        Alert.alert('Choose a valid deadline', 'Enter a future date as YYYY-MM-DD.');
        return;
      }
      deadline = Timestamp.fromDate(date);
    }
    if (data.isMilestone && (!Number.isInteger(data.milestoneSteps) || data.milestoneSteps < 1 || data.milestoneSteps > 31 || !Number.isInteger(data.starsPerStep) || data.starsPerStep < 1 || data.starsPerStep > 1000 || !Number.isInteger(data.milestoneBonus) || data.milestoneBonus < 0 || data.milestoneBonus > 1000)) {
      Alert.alert('Check milestone details', 'Choose 1–31 steps, 1–1,000 stars per step and a 0–1,000 completion bonus.');
      return;
    }
    try {
      await createTask(family.id, {
        title: data.title.trim(),
        description: data.description.trim(),
        category: data.category,
        ageGroupSuggestion: data.ageGroup,
        starValue: data.starValue,
        difficulty: data.difficulty,
        requiresPhoto: data.requiresPhoto,
        isMilestone: data.isMilestone,
        ...(data.isMilestone ? { milestoneSteps: data.milestoneSteps, starsPerStep: data.starsPerStep, milestoneBonus: data.milestoneBonus } : {}),
        recurrenceType: data.recurrenceType,
        ...(deadline ? { deadline } : {}),
        createdByParentId: user.uid,
      });
      router.back();
    } catch (error) {
      Alert.alert('Quest was not saved', saveErrorMessage(error));
    }
  };

  // ── Step Dots ────────────────────────────────────────────────────────────

  const renderStepDots = () => (
    <View style={styles.dotsContainer}>
      {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((step) => (
        <View
          key={step}
          style={[
            styles.dot,
            step <= currentStep ? styles.dotActive : styles.dotInactive,
          ]}
        />
      ))}
    </View>
  );

  // ── Step 1: Basics ──────────────────────────────────────────────────────

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Task Basics</Text>

      {/* Title */}
      <Text style={styles.fieldLabel}>Title *</Text>
      <Controller
        control={control}
        name="title"
        rules={{ required: 'Title is required', maxLength: { value: 60, message: 'Max 60 characters' } }}
        render={({ field: { onChange, onBlur, value } }) => (
          <View>
            <TextInput
              style={[styles.textInput, errors.title && styles.textInputError]}
              placeholder="e.g. Make your bed"
              placeholderTextColor="#A9A7BA"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              maxLength={60}
            />
            <Text style={styles.charCounter}>{value.length}/60</Text>
          </View>
        )}
      />
      {errors.title && <Text style={styles.errorText}>{errors.title.message}</Text>}

      {/* Description */}
      <Text style={styles.fieldLabel}>Description</Text>
      <Controller
        control={control}
        name="description"
        rules={{ maxLength: { value: 200, message: 'Max 200 characters' } }}
        render={({ field: { onChange, onBlur, value } }) => (
          <View>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              placeholder="Optional details about this task..."
              placeholderTextColor="#A9A7BA"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              maxLength={200}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <Text style={styles.charCounter}>{value.length}/200</Text>
          </View>
        )}
      />

      {/* Category */}
      <Text style={styles.fieldLabel}>Category</Text>
      <View style={styles.categoryGrid}>
        {CATEGORIES.map((cat) => {
          const selected = watchAll.category === cat.key;
          return (
            <TouchableOpacity
              key={cat.key}
              style={[
                styles.categoryTile,
                { backgroundColor: selected ? cat.deep : cat.light, borderColor: cat.deep },
                selected && styles.categoryTileSelected,
              ]}
              onPress={() => setValue('category', cat.key)}
              activeOpacity={0.7}
            >
              <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
              <Text style={[styles.categoryLabel, { color: selected ? '#17200C' : cat.deep }]}>
                {cat.key}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Age Group */}
      <Text style={styles.fieldLabel}>Age Group</Text>
      <View style={styles.ageGroupRow}>
        {AGE_GROUPS.map((ag) => {
          const selected = watchAll.ageGroup === ag;
          return (
            <TouchableOpacity
              key={ag}
              style={[styles.ageGroupOption, selected && styles.ageGroupSelected]}
              onPress={() => setValue('ageGroup', ag)}
              activeOpacity={0.7}
            >
              <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
                {selected && <View style={styles.radioInner} />}
              </View>
              <Text style={[styles.ageGroupLabel, selected && styles.ageGroupLabelSelected]}>
                {ag}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  // ── Step 2: Stars & Difficulty ───────────────────────────────────────────

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Stars & Difficulty</Text>

      {/* Star Value */}
      <Text style={styles.fieldLabel}>Star Value</Text>
      <View style={styles.starValueContainer}>
        <TouchableOpacity
          style={styles.starButton}
          onPress={() => setValue('starValue', Math.max(1, watchAll.starValue - 1))}
          activeOpacity={0.7}
        >
          <Text style={styles.starButtonText}>-</Text>
        </TouchableOpacity>
        <View style={styles.starDisplay}>
          <Text style={styles.starValueText}>{watchAll.starValue}</Text>
          <Text style={styles.starEmoji}>⭐</Text>
        </View>
        <TouchableOpacity
          style={styles.starButton}
          onPress={() => setValue('starValue', Math.min(100, watchAll.starValue + 1))}
          activeOpacity={0.7}
        >
          <Text style={styles.starButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Difficulty */}
      <Text style={styles.fieldLabel}>Difficulty</Text>
      <View style={styles.difficultyRow}>
        {DIFFICULTIES.map((d) => {
          const selected = watchAll.difficulty === d.key;
          return (
            <TouchableOpacity
              key={d.key}
              style={[
                styles.difficultyButton,
                { borderColor: d.color },
                selected && { backgroundColor: d.color },
              ]}
              onPress={() => setValue('difficulty', d.key)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.difficultyLabel,
                  { color: selected ? '#17200C' : d.color },
                ]}
                numberOfLines={1}
              >
                {d.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Milestone Toggle */}
      <View style={styles.toggleRow}>
        <View style={styles.toggleTextContainer}>
          <Text style={styles.toggleLabel}>Multi-step Learning Task</Text>
          <Text style={styles.toggleHint}>This is a milestone task with multiple steps</Text>
        </View>
        <Controller
          control={control}
          name="isMilestone"
          render={({ field: { onChange, value } }) => (
            <Switch
              value={value}
              onValueChange={onChange}
              trackColor={{ false: '#A9A7BA', true: '#65F3FF' }}
              thumbColor={value ? '#65F3FF' : '#FFFFFF'}
            />
          )}
        />
      </View>

      {/* Milestone Fields */}
      {watchAll.isMilestone && (
        <View style={styles.milestoneFields}>
          <View style={styles.milestoneRow}>
            <View style={styles.milestoneField}>
              <Text style={styles.fieldLabel}>Total Steps</Text>
              <Controller
                control={control}
                name="milestoneSteps"
                render={({ field: { onChange, value } }) => (
                  <TextInput placeholderTextColor="#A9A7BA"
                    style={styles.textInput}
                    value={String(value)}
                    onChangeText={(t) => onChange(Number(t.replace(/[^0-9]/g, '')) || 0)}
                    keyboardType="number-pad"
                  />
                )}
              />
            </View>
            <View style={styles.milestoneField}>
              <Text style={styles.fieldLabel}>Stars Per Step</Text>
              <Controller
                control={control}
                name="starsPerStep"
                render={({ field: { onChange, value } }) => (
                  <TextInput placeholderTextColor="#A9A7BA"
                    style={styles.textInput}
                    value={String(value)}
                    onChangeText={(t) => onChange(Number(t.replace(/[^0-9]/g, '')) || 0)}
                    keyboardType="number-pad"
                  />
                )}
              />
            </View>
          </View>
          <Text style={styles.fieldLabel}>Completion Bonus</Text>
          <Controller
            control={control}
            name="milestoneBonus"
            render={({ field: { onChange, value } }) => (
              <TextInput placeholderTextColor="#A9A7BA"
                style={styles.textInput}
                value={String(value)}
                onChangeText={(t) => onChange(Number(t.replace(/[^0-9]/g, '')) || 0)}
                keyboardType="number-pad"
              />
            )}
          />
        </View>
      )}
    </View>
  );

  // ── Step 3: Schedule & Proof ─────────────────────────────────────────────

  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Schedule & Proof</Text>

      {/* Recurrence */}
      <Text style={styles.fieldLabel}>Recurrence</Text>
      <View style={styles.recurrenceRow}>
        {RECURRENCE_OPTIONS.map((r) => {
          const selected = watchAll.recurrenceType === r.key;
          return (
            <TouchableOpacity
              key={r.key}
              style={[styles.recurrenceButton, selected && styles.recurrenceButtonSelected]}
              onPress={() => setValue('recurrenceType', r.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.recurrenceLabel, selected && styles.recurrenceLabelSelected]}>
                {r.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Photo Proof */}
      <View style={styles.toggleRow}>
        <View style={styles.toggleTextContainer}>
          <Text style={styles.toggleLabel}>Photo Proof Required</Text>
          <Text style={styles.toggleHint}>Child must submit a photo as evidence</Text>
        </View>
        <Controller
          control={control}
          name="requiresPhoto"
          render={({ field: { onChange, value } }) => (
            <Switch
              value={value}
              onValueChange={onChange}
              trackColor={{ false: '#A9A7BA', true: '#65F3FF' }}
              thumbColor={value ? '#65F3FF' : '#FFFFFF'}
            />
          )}
        />
      </View>

      {/* Deadline */}
      <View style={styles.toggleRow}>
        <View style={styles.toggleTextContainer}>
          <Text style={styles.toggleLabel}>Set a Deadline</Text>
          <Text style={styles.toggleHint}>Task must be completed by a certain date</Text>
        </View>
        <Controller
          control={control}
          name="hasDeadline"
          render={({ field: { onChange, value } }) => (
            <Switch
              value={value}
              onValueChange={onChange}
              trackColor={{ false: '#A9A7BA', true: '#65F3FF' }}
              thumbColor={value ? '#65F3FF' : '#FFFFFF'}
            />
          )}
        />
      </View>

      {watchAll.hasDeadline && (
        <View style={styles.deadlinePlaceholder}>
          <Controller control={control} name="deadlineDate" render={({ field: { value, onChange } }) => (
            <TextInput placeholderTextColor="#A9A7BA" accessibilityLabel="Quest deadline, YYYY-MM-DD" style={styles.textInput} value={value} onChangeText={onChange} placeholder="YYYY-MM-DD" maxLength={10} />
          )} />
        </View>
      )}
    </View>
  );

  // ── Step 4: Review ───────────────────────────────────────────────────────

  const renderStep4 = () => {
    const catInfo = CATEGORIES.find((c) => c.key === watchAll.category);
    const diffInfo = DIFFICULTIES.find((d) => d.key === watchAll.difficulty);
    const recInfo = RECURRENCE_OPTIONS.find((r) => r.key === watchAll.recurrenceType);

    return (
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>Review Your Quest</Text>

        <View style={styles.reviewCard}>
          {/* Title & Description */}
          <Text style={styles.reviewTaskTitle}>{watchAll.title || 'Untitled'}</Text>
          {watchAll.description ? (
            <Text style={styles.reviewDescription}>{watchAll.description}</Text>
          ) : null}

          {/* Category Badge */}
          <View style={[styles.categoryBadge, { backgroundColor: catInfo?.deep ?? '#65F3FF' }]}>
            <Text style={styles.categoryBadgeText}>
              {catInfo?.emoji} {watchAll.category}
            </Text>
          </View>

          {/* Star Value */}
          <View style={styles.reviewStarContainer}>
            <Text style={styles.reviewStarValue}>{watchAll.starValue}</Text>
            <Text style={styles.reviewStarLabel}>⭐ Stars</Text>
          </View>

          {/* Details Grid */}
          <View style={styles.reviewGrid}>
            <View style={styles.reviewGridItem}>
              <Text style={styles.reviewGridLabel}>Age Group</Text>
              <Text style={styles.reviewGridValue}>{watchAll.ageGroup}</Text>
            </View>
            <View style={styles.reviewGridItem}>
              <Text style={styles.reviewGridLabel}>Difficulty</Text>
              <Text style={[styles.reviewGridValue, { color: diffInfo?.color }]}>
                {diffInfo?.label}
              </Text>
            </View>
            <View style={styles.reviewGridItem}>
              <Text style={styles.reviewGridLabel}>Recurrence</Text>
              <Text style={styles.reviewGridValue}>{recInfo?.label}</Text>
            </View>
            <View style={styles.reviewGridItem}>
              <Text style={styles.reviewGridLabel}>Photo Proof</Text>
              <Text style={styles.reviewGridValue}>
                {watchAll.requiresPhoto ? 'Yes' : 'No'}
              </Text>
            </View>
          </View>

          {/* Milestone Info */}
          {watchAll.isMilestone && (
            <View style={styles.reviewMilestone}>
              <Text style={styles.reviewMilestoneTitle}>Milestone Task</Text>
              <Text style={styles.reviewMilestoneDetail}>
                {watchAll.milestoneSteps} steps  |  {watchAll.starsPerStep} stars/step  |  {watchAll.milestoneBonus} bonus
              </Text>
            </View>
          )}

          {watchAll.hasDeadline && (
            <View style={styles.reviewDeadlineNote}>
              <Text style={styles.reviewDeadlineText}>Deadline: {watchAll.deadlineDate}</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  // ── Render ───────────────────────────────────────────────────────────────

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      case 4:
        return renderStep4();
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={goBack} style={styles.backButton} activeOpacity={0.7}>
            <Text style={styles.backButtonText}>
              {currentStep === 1 ? 'Cancel' : '← Back'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Quest</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Step Dots */}
        {renderStepDots()}

        {/* Step Content */}
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {renderCurrentStep()}
        </ScrollView>

        {/* Bottom Navigation */}
        <View style={styles.bottomBar}>
          {currentStep < TOTAL_STEPS ? (
            <TouchableOpacity
              style={[styles.nextButton, !canGoNext() && styles.nextButtonDisabled]}
              onPress={goNext}
              activeOpacity={0.7}
            >
              <Text style={styles.nextButtonText}>Next</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.postButton}
              onPress={handleSubmit(onSubmit)}
              disabled={isSubmitting}
              accessibilityState={{ busy: isSubmitting }}
              activeOpacity={0.7}
            >
              <Text style={styles.postButtonText}>{isSubmitting ? 'Saving quest…' : 'Post Quest'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#23232F',
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#121219',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    minWidth: 60,
  },
  backButtonText: {
    fontSize: 16,
    color: '#65F3FF',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F7F5FF',
  },
  headerSpacer: {
    minWidth: 60,
  },

  // Dots
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotActive: {
    backgroundColor: '#65F3FF',
  },
  dotInactive: {
    backgroundColor: '#A9A7BA',
  },

  // Step Content
  stepContent: {
    paddingHorizontal: 20,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#F7F5FF',
    marginBottom: 20,
  },

  // Fields
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#C0BDCF',
    marginBottom: 8,
    marginTop: 16,
  },
  textInput: {
    backgroundColor: '#121219',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#F7F5FF',
  },
  textInputError: {color:'#F7F5FF',
    borderColor: '#FF92A7',
  },
  textArea: {color:'#F7F5FF',
    minHeight: 80,
  },
  charCounter: {
    fontSize: 12,
    color: '#A9A7BA',
    textAlign: 'right',
    marginTop: 4,
  },
  errorText: {
    fontSize: 12,
    color: '#FF92A7',
    marginTop: 4,
  },

  // Category Grid
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  categoryTile: {
    width: '47%',
    paddingVertical: 20,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  categoryTileSelected: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  categoryEmoji: {color:'#F7F5FF',
    fontSize: 32,
    marginBottom: 6,
  },
  categoryLabel: {color:'#F7F5FF',
    fontSize: 14,
    fontWeight: '700',
  },

  // Age Group
  ageGroupRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  ageGroupOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#121219',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  ageGroupSelected: {
    borderColor: '#65F3FF',
    backgroundColor: '#17363A',
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#A9A7BA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  radioOuterSelected: {
    borderColor: '#65F3FF',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#65F3FF',
  },
  ageGroupLabel: {
    fontSize: 14,
    color: '#C0BDCF',
    fontWeight: '500',
  },
  ageGroupLabelSelected: {
    color: '#65F3FF',
    fontWeight: '700',
  },

  // Star Value
  starValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginVertical: 8,
  },
  starButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#65F3FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  starButtonText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#17200C',
  },
  starDisplay: {
    alignItems: 'center',
  },
  starValueText: {
    fontSize: 48,
    fontWeight: '800',
    color: '#65F3FF',
  },
  starEmoji: {color:'#F7F5FF',
    fontSize: 20,
    marginTop: 2,
  },

  // Difficulty
  difficultyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  difficultyButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 2,
    minWidth: 70,
    alignItems: 'center',
  },
  difficultyLabel: {color:'#F7F5FF',
    fontSize: 13,
    fontWeight: '700',
  },

  // Toggle Row
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#121219',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  toggleTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F7F5FF',
  },
  toggleHint: {
    fontSize: 12,
    color: '#A9A7BA',
    marginTop: 2,
  },

  // Milestone Fields
  milestoneFields: {
    backgroundColor: '#121219',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  milestoneRow: {
    flexDirection: 'row',
    gap: 12,
  },
  milestoneField: {
    flex: 1,
  },

  // Recurrence
  recurrenceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  recurrenceButton: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#121219',
  },
  recurrenceButtonSelected: {
    borderColor: '#65F3FF',
    backgroundColor: '#65F3FF',
  },
  recurrenceLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#C0BDCF',
  },
  recurrenceLabelSelected: {
    color: '#17200C',
  },

  // Deadline Placeholder
  deadlinePlaceholder: {
    backgroundColor: '#121219',
    borderRadius: 12,
    padding: 20,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  deadlinePlaceholderText: {
    fontSize: 14,
    color: '#A9A7BA',
    fontStyle: 'italic',
  },

  // Review Card
  reviewCard: {
    backgroundColor: '#121219',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  reviewTaskTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#F7F5FF',
    marginBottom: 4,
  },
  reviewDescription: {
    fontSize: 14,
    color: '#C0BDCF',
    marginBottom: 12,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    marginBottom: 16,
  },
  categoryBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#17200C',
  },
  reviewStarContainer: {
    alignItems: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    marginBottom: 16,
  },
  reviewStarValue: {
    fontSize: 40,
    fontWeight: '800',
    color: '#65F3FF',
  },
  reviewStarLabel: {
    fontSize: 16,
    color: '#C0BDCF',
    marginTop: 2,
  },
  reviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  reviewGridItem: {
    width: '50%',
    paddingVertical: 8,
  },
  reviewGridLabel: {
    fontSize: 12,
    color: '#A9A7BA',
    marginBottom: 2,
  },
  reviewGridValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#F7F5FF',
  },
  reviewMilestone: {
    backgroundColor: '#302445',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  reviewMilestoneTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#B7A1FF',
  },
  reviewMilestoneDetail: {
    fontSize: 13,
    color: '#B7A1FF',
    marginTop: 4,
  },
  reviewDeadlineNote: {
    backgroundColor: '#392719',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  reviewDeadlineText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFBA82',
  },

  // Bottom Bar
  bottomBar: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#121219',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  nextButton: {
    backgroundColor: '#65F3FF',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  nextButtonDisabled: {
    opacity: 0.5,
  },
  nextButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#17200C',
  },
  postButton: {
    backgroundColor: '#65F3FF',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  postButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#17200C',
  },
});
