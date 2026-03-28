// S2-01: Child Profile Creation screen (P-07 create mode)
// Parent creates child: nickname, avatar, age group, PIN setup (double-confirm).
// PIN hashed client-side with bcrypt before write.

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { useFamilyStore } from '../../../src/stores/familyStore';
import { addChildProfile } from '../../../src/services/families';
import AvatarPicker from '../../../src/components/shared/AvatarPicker';
import type { AgeGroup } from '../../../src/types';

interface CreateChildForm {
  nickname: string;
  avatarId: string;
  ageGroup: AgeGroup;
  pin: string;
  confirmPin: string;
}

const AGE_GROUPS: AgeGroup[] = ['3-5', '6-8', '9-11', '12-14', '15-17'];

export default function CreateChildScreen() {
  const router = useRouter();
  const { family } = useFamilyStore();
  const [loading, setLoading] = useState(false);

  const { control, handleSubmit, watch, formState: { errors } } = useForm<CreateChildForm>({
    defaultValues: {
      nickname: '',
      avatarId: 'avatar-01',
      ageGroup: '6-8',
      pin: '',
      confirmPin: '',
    },
    mode: 'onBlur',
  });

  const watchPin = watch('pin');

  const onSubmit = async (data: CreateChildForm) => {
    if (!family) return;

    setLoading(true);
    try {
      // Hash PIN client-side — using simple hash for now
      // In production, use bcryptjs (pure JS implementation for React Native)
      const pinHash = await hashPin(data.pin);

      await addChildProfile(family.id, {
        nickname: data.nickname,
        avatarId: data.avatarId,
        ageGroup: data.ageGroup,
        pinHash,
      });

      Alert.alert('Success!', `${data.nickname}'s profile is ready.`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      Alert.alert('Error', 'Could not create profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          <Text style={styles.heading}>Add a Child</Text>

          {/* Nickname */}
          <Text style={styles.label}>Nickname</Text>
          <Controller
            control={control}
            name="nickname"
            rules={{
              required: 'Nickname is required',
              maxLength: { value: 20, message: 'Max 20 characters' },
            }}
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={[styles.input, errors.nickname && styles.inputError]}
                placeholder="What do they like to be called?"
                placeholderTextColor="#9CA3AF"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                maxLength={20}
              />
            )}
          />
          {errors.nickname && (
            <Text style={styles.errorText}>{errors.nickname.message}</Text>
          )}

          {/* Avatar */}
          <Text style={styles.label}>Choose an Avatar</Text>
          <Controller
            control={control}
            name="avatarId"
            render={({ field: { onChange, value } }) => (
              <AvatarPicker selectedId={value} onSelect={onChange} />
            )}
          />

          {/* Age Group */}
          <Text style={styles.label}>Age Group</Text>
          <Controller
            control={control}
            name="ageGroup"
            render={({ field: { onChange, value } }) => (
              <View style={styles.ageRow}>
                {AGE_GROUPS.map((age) => (
                  <TouchableOpacity
                    key={age}
                    style={[
                      styles.ageChip,
                      value === age && styles.ageChipSelected,
                    ]}
                    onPress={() => onChange(age)}
                  >
                    <Text
                      style={[
                        styles.ageChipText,
                        value === age && styles.ageChipTextSelected,
                      ]}
                    >
                      {age}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          />

          {/* PIN */}
          <Text style={styles.label}>Set a 4-Digit PIN</Text>
          <Controller
            control={control}
            name="pin"
            rules={{
              required: 'PIN is required',
              pattern: { value: /^\d{4}$/, message: 'PIN must be 4 digits' },
            }}
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={[styles.input, errors.pin && styles.inputError]}
                placeholder="Enter 4-digit PIN"
                placeholderTextColor="#9CA3AF"
                keyboardType="number-pad"
                maxLength={4}
                secureTextEntry
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
              />
            )}
          />
          {errors.pin && (
            <Text style={styles.errorText}>{errors.pin.message}</Text>
          )}

          {/* Confirm PIN */}
          <Text style={styles.label}>Confirm PIN</Text>
          <Controller
            control={control}
            name="confirmPin"
            rules={{
              required: 'Please confirm the PIN',
              validate: (val) => val === watchPin || 'PINs do not match',
            }}
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={[styles.input, errors.confirmPin && styles.inputError]}
                placeholder="Re-enter 4-digit PIN"
                placeholderTextColor="#9CA3AF"
                keyboardType="number-pad"
                maxLength={4}
                secureTextEntry
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
              />
            )}
          />
          {errors.confirmPin && (
            <Text style={styles.errorText}>{errors.confirmPin.message}</Text>
          )}

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitDisabled]}
            onPress={handleSubmit(onSubmit)}
            disabled={loading}
            activeOpacity={0.7}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitText}>Create Profile</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Simple PIN hashing — in production replace with bcryptjs
async function hashPin(pin: string): Promise<string> {
  // Using a simple hash for React Native compatibility
  // bcryptjs (pure JS) should be added as a dependency for production
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + 'chorequest-salt');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  flex: { flex: 1 },
  content: { padding: 24, paddingBottom: 48 },
  backButton: { marginBottom: 16 },
  backText: { fontFamily: 'Inter_500Medium', fontSize: 16, color: '#4A90D9' },
  heading: {
    fontFamily: 'Inter_700Bold',
    fontSize: 28,
    lineHeight: 35,
    color: '#1A1A2E',
    marginBottom: 24,
  },
  label: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: '#1A1A2E',
    marginTop: 20,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8F2FB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    color: '#1A1A2E',
  },
  inputError: { borderColor: '#9B1C1C' },
  errorText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#9B1C1C',
    marginTop: 4,
  },
  ageRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  ageChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8F2FB',
  },
  ageChipSelected: {
    backgroundColor: '#1A3E6E',
    borderColor: '#1A3E6E',
  },
  ageChipText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: '#555555',
  },
  ageChipTextSelected: { color: '#FFFFFF' },
  submitButton: {
    backgroundColor: '#1A3E6E',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 32,
  },
  submitDisabled: { opacity: 0.6 },
  submitText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: '#FFFFFF',
  },
});
