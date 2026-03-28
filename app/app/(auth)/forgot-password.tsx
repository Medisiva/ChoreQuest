import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { router } from 'expo-router';
import { resetPassword } from '@/services/auth';

// Brand colors
const navy900 = '#1A3E6E';
const blue500 = '#4A90D9';
const ink950 = '#1A1A2E';
const ink600 = '#555555';
const ink400 = '#9CA3AF';
const ink50 = '#F8FAFC';
const white = '#FFFFFF';
const danger = '#9B1C1C';
const dangerLight = '#FEE2E2';

type ForgotPasswordFormData = {
  email: string;
};

export default function ForgotPasswordScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    mode: 'onBlur',
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setIsLoading(true);
    setError(null);
    try {
      await resetPassword(data.email);
      setIsSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Email not found. Please check and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Back Arrow */}
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backArrow}>{'\u2190'}</Text>
          </TouchableOpacity>

          {isSuccess ? (
            /* Success State */
            <View style={styles.successContainer}>
              <View style={styles.successIcon}>
                <Text style={styles.successIconText}>{'\u2709'}</Text>
              </View>
              <Text style={styles.successHeading}>Check your inbox</Text>
              <Text style={styles.successMessage}>
                We've sent a password reset link to your email address. Follow the
                instructions in the email to reset your password.
              </Text>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => router.push('/(auth)/login')}
              >
                <Text style={styles.primaryButtonText}>Back to Sign In</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* Form State */
            <>
              <View style={styles.header}>
                <Text style={styles.heading}>Reset your password</Text>
                <Text style={styles.instruction}>
                  Enter your email and we'll send a reset link
                </Text>
              </View>

              <View style={styles.form}>
                <Controller
                  control={control}
                  name="email"
                  rules={{
                    required: 'Email is required',
                    pattern: {
                      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                      message: 'Enter a valid email address',
                    },
                  }}
                  render={({ field: { onChange, onBlur, value } }) => (
                    <View style={styles.fieldWrapper}>
                      <Text style={styles.label}>Email</Text>
                      <TextInput
                        style={[styles.input, errors.email && styles.inputError]}
                        placeholder="you@example.com"
                        placeholderTextColor={ink400}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoComplete="email"
                        autoFocus
                        onBlur={onBlur}
                        onChangeText={onChange}
                        value={value}
                        editable={!isLoading}
                      />
                      {errors.email && (
                        <Text style={styles.fieldError}>{errors.email.message}</Text>
                      )}
                    </View>
                  )}
                />

                {/* Inline Error */}
                {error && (
                  <View style={styles.errorBanner}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                {/* Send Reset Link Button */}
                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    isLoading && styles.primaryButtonDisabled,
                  ]}
                  onPress={handleSubmit(onSubmit)}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color={white} />
                  ) : (
                    <Text style={styles.primaryButtonText}>Send Reset Link</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Footer */}
              <View style={styles.footer}>
                <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
                  <Text style={styles.footerText}>
                    Remember your password?{' '}
                    <Text style={styles.link}>Sign in</Text>
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: white,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  backButton: {
    marginTop: 8,
    padding: 8,
    alignSelf: 'flex-start',
  },
  backArrow: {
    fontSize: 28,
    color: ink950,
  },
  header: {
    marginTop: 24,
    marginBottom: 32,
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: ink950,
    marginBottom: 8,
  },
  instruction: {
    fontSize: 16,
    color: ink600,
    lineHeight: 22,
  },
  form: {
    gap: 16,
    marginBottom: 24,
  },
  fieldWrapper: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: ink950,
  },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: ink400,
    paddingHorizontal: 16,
    fontSize: 16,
    color: ink950,
    backgroundColor: ink50,
  },
  inputError: {
    borderColor: danger,
    backgroundColor: dangerLight,
  },
  fieldError: {
    fontSize: 13,
    color: danger,
  },
  errorBanner: {
    backgroundColor: dangerLight,
    borderRadius: 8,
    padding: 12,
  },
  errorText: {
    fontSize: 14,
    color: danger,
  },
  primaryButton: {
    height: 52,
    borderRadius: 12,
    backgroundColor: navy900,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: white,
  },
  footer: {
    alignItems: 'center',
    gap: 16,
  },
  footerText: {
    fontSize: 15,
    color: ink600,
  },
  link: {
    fontSize: 15,
    fontWeight: '600',
    color: blue500,
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginTop: 48,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EBF5FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successIconText: {
    fontSize: 36,
  },
  successHeading: {
    fontSize: 24,
    fontWeight: '700',
    color: ink950,
    marginBottom: 12,
    textAlign: 'center',
  },
  successMessage: {
    fontSize: 16,
    color: ink600,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
});
