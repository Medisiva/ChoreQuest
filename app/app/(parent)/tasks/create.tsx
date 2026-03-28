import React, { useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { useRouter } from 'expo-router';

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
}

// ── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: { key: Category; emoji: string; deep: string; light: string }[] = [
  { key: 'Household', emoji: '🏠', deep: '#1B6CA8', light: '#DBEAFE' },
  { key: 'Learning', emoji: '📚', deep: '#7B2D8B', light: '#EDE9FE' },
  { key: 'LifeSkills', emoji: '🌱', deep: '#0D7377', light: '#CCFBF1' },
  { key: 'Hobbies', emoji: '🎨', deep: '#B85C00', light: '#FFEDD5' },
];

const AGE_GROUPS: AgeGroup[] = ['3-5', '6-8', '9-11', '12-14', '15-17'];

const DIFFICULTIES: { key: Difficulty; label: string; color: string }[] = [
  { key: 'Easy', label: 'Easy', color: '#1B7A34' },
  { key: 'Medium', label: 'Medium', color: '#B45309' },
  { key: 'Hard', label: 'Hard', color: '#9B1C1C' },
  { key: 'AdultSupervised', label: 'Adult Supervised', color: '#A78BFA' },
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
  const [currentStep, setCurrentStep] = useState(1);

  const { control, handleSubmit, watch, setValue, formState: { errors } } = useForm<TaskFormData>({
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
    },
  });

  const watchAll = watch();

  // ── Navigation ───────────────────────────────────────────────────────────

  const canGoNext = (): boolean => {
    if (currentStep === 1) {
      return watchAll.title.trim().length > 0;
    }
    return true;
  };

  const goNext = () => {
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

  const onSubmit = (data: TaskFormData) => {
    // TODO: call createTask from services/tasks
    console.log('Task created:', data);
    router.back();
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
              placeholderTextColor="#9CA3AF"
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
              placeholderTextColor="#9CA3AF"
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
              <Text style={[styles.categoryLabel, { color: selected ? '#FFFFFF' : cat.deep }]}>
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
                  { color: selected ? '#FFFFFF' : d.color },
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
              trackColor={{ false: '#9CA3AF', true: '#4A90D9' }}
              thumbColor={value ? '#1A3E6E' : '#FFFFFF'}
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
                  <TextInput
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
                  <TextInput
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
              <TextInput
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
              trackColor={{ false: '#9CA3AF', true: '#4A90D9' }}
              thumbColor={value ? '#1A3E6E' : '#FFFFFF'}
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
              trackColor={{ false: '#9CA3AF', true: '#4A90D9' }}
              thumbColor={value ? '#1A3E6E' : '#FFFFFF'}
            />
          )}
        />
      </View>

      {watchAll.hasDeadline && (
        <View style={styles.deadlinePlaceholder}>
          <Text style={styles.deadlinePlaceholderText}>
            Date picker will be added here
          </Text>
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
          <View style={[styles.categoryBadge, { backgroundColor: catInfo?.deep ?? '#1B6CA8' }]}>
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
              <Text style={styles.reviewDeadlineText}>Deadline: To be set</Text>
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
              disabled={!canGoNext()}
              activeOpacity={0.7}
            >
              <Text style={styles.nextButtonText}>Next</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.postButton}
              onPress={handleSubmit(onSubmit)}
              activeOpacity={0.7}
            >
              <Text style={styles.postButtonText}>Post Quest</Text>
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
    backgroundColor: '#F8FAFC',
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
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    minWidth: 60,
  },
  backButtonText: {
    fontSize: 16,
    color: '#4A90D9',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A2E',
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
    backgroundColor: '#1A3E6E',
  },
  dotInactive: {
    backgroundColor: '#9CA3AF',
  },

  // Step Content
  stepContent: {
    paddingHorizontal: 20,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 20,
  },

  // Fields
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555555',
    marginBottom: 8,
    marginTop: 16,
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1A1A2E',
  },
  textInputError: {
    borderColor: '#9B1C1C',
  },
  textArea: {
    minHeight: 80,
  },
  charCounter: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'right',
    marginTop: 4,
  },
  errorText: {
    fontSize: 12,
    color: '#9B1C1C',
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
  categoryEmoji: {
    fontSize: 32,
    marginBottom: 6,
  },
  categoryLabel: {
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
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  ageGroupSelected: {
    borderColor: '#1A3E6E',
    backgroundColor: '#DBEAFE',
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#9CA3AF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  radioOuterSelected: {
    borderColor: '#1A3E6E',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#1A3E6E',
  },
  ageGroupLabel: {
    fontSize: 14,
    color: '#555555',
    fontWeight: '500',
  },
  ageGroupLabelSelected: {
    color: '#1A3E6E',
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
    backgroundColor: '#1A3E6E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  starButtonText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  starDisplay: {
    alignItems: 'center',
  },
  starValueText: {
    fontSize: 48,
    fontWeight: '800',
    color: '#1A3E6E',
  },
  starEmoji: {
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
  difficultyLabel: {
    fontSize: 13,
    fontWeight: '700',
  },

  // Toggle Row
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
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
    color: '#1A1A2E',
  },
  toggleHint: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },

  // Milestone Fields
  milestoneFields: {
    backgroundColor: '#FFFFFF',
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
    backgroundColor: '#FFFFFF',
  },
  recurrenceButtonSelected: {
    borderColor: '#1A3E6E',
    backgroundColor: '#1A3E6E',
  },
  recurrenceLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555555',
  },
  recurrenceLabelSelected: {
    color: '#FFFFFF',
  },

  // Deadline Placeholder
  deadlinePlaceholder: {
    backgroundColor: '#FFFFFF',
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
    color: '#9CA3AF',
    fontStyle: 'italic',
  },

  // Review Card
  reviewCard: {
    backgroundColor: '#FFFFFF',
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
    color: '#1A1A2E',
    marginBottom: 4,
  },
  reviewDescription: {
    fontSize: 14,
    color: '#555555',
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
    color: '#FFFFFF',
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
    color: '#1A3E6E',
  },
  reviewStarLabel: {
    fontSize: 16,
    color: '#555555',
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
    color: '#9CA3AF',
    marginBottom: 2,
  },
  reviewGridValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A2E',
  },
  reviewMilestone: {
    backgroundColor: '#EDE9FE',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  reviewMilestoneTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#7B2D8B',
  },
  reviewMilestoneDetail: {
    fontSize: 13,
    color: '#7B2D8B',
    marginTop: 4,
  },
  reviewDeadlineNote: {
    backgroundColor: '#FFEDD5',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  reviewDeadlineText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#B85C00',
  },

  // Bottom Bar
  bottomBar: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  nextButton: {
    backgroundColor: '#4A90D9',
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
    color: '#FFFFFF',
  },
  postButton: {
    backgroundColor: '#1A3E6E',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  postButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
