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
import { signUp, signInWithGoogle, signInWithApple } from '@/services/auth';

// Brand colors
const navy900 = '#1A3E6E';
const blue500 = '#4A90D9';
const coral = '#FF6B6B';
const ink950 = '#1A1A2E';
const ink600 = '#555555';
const ink400 = '#9CA3AF';
const ink50 = '#F8FAFC';
const white = '#FFFFFF';
const danger = '#9B1C1C';
const dangerLight = '#FEE2E2';

type RegisterFormData = {
  email: string;
  password: string;
  confirmPassword: string;
};

function getPasswordStrength(password: string): {
  label: string;
  color: string;
  width: string;
} {
  if (password.length === 0) return { label: '', color: ink400, width: '0%' };
  if (password.length < 8) return { label: 'Too short', color: danger, width: '20%' };

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 2) return { label: 'Weak', color: coral, width: '40%' };
  if (score <= 3) return { label: 'Fair', color: '#F59E0B', width: '60%' };
  if (score === 4) return { label: 'Good', color: blue500, width: '80%' };
  return { label: 'Strong', color: '#10B981', width: '100%' };
}

export default function RegisterScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSocialLoading, setIsSocialLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterFormData>({
    mode: 'onBlur',
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const watchedPassword = watch('password');
  const strength = getPasswordStrength(watchedPassword || '');

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true);
    setError(null);
    try {
      await signUp(data.email, data.password);
      // TODO: Navigate to onboarding
      console.log('Navigate to /(onboarding)/family');
    } catch (err: any) {
      setError(err.message || 'Failed to create account. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsSocialLoading('google');
    setError(null);
    try {
      await signInWithGoogle();
      console.log('Navigate to /(onboarding)/family');
    } catch (err: any) {
      setError(err.message || 'Google sign-in failed. Please try again.');
    } finally {
      setIsSocialLoading(null);
    }
  };

  const handleAppleSignIn = async () => {
    setIsSocialLoading('apple');
    setError(null);
    try {
      await signInWithApple();
      console.log('Navigate to /(onboarding)/family');
    } catch (err: any) {
      setError(err.message || 'Apple sign-in failed. Please try again.');
    } finally {
      setIsSocialLoading(null);
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
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.heading}>Create your family account</Text>
          </View>

          {/* Social Login */}
          <View style={styles.socialSection}>
            <TouchableOpacity
              style={styles.socialButton}
              onPress={handleGoogleSignIn}
              disabled={isLoading || isSocialLoading !== null}
            >
              {isSocialLoading === 'google' ? (
                <ActivityIndicator color={ink950} />
              ) : (
                <Text style={styles.socialButtonText}>Continue with Google</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.socialButton, styles.appleButton]}
              onPress={handleAppleSignIn}
              disabled={isLoading || isSocialLoading !== null}
            >
              {isSocialLoading === 'apple' ? (
                <ActivityIndicator color={white} />
              ) : (
                <Text style={[styles.socialButtonText, styles.appleButtonText]}>
                  Continue with Apple
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or sign up with email</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Form */}
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

            <Controller
              control={control}
              name="password"
              rules={{
                required: 'Password is required',
                minLength: {
                  value: 8,
                  message: 'Password must be at least 8 characters',
                },
              }}
              render={({ field: { onChange, onBlur, value } }) => (
                <View style={styles.fieldWrapper}>
                  <Text style={styles.label}>Password</Text>
                  <View style={styles.passwordContainer}>
                    <TextInput
                      style={[
                        styles.input,
                        styles.passwordInput,
                        errors.password && styles.inputError,
                      ]}
                      placeholder="Min. 8 characters"
                      placeholderTextColor={ink400}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoComplete="new-password"
                      onBlur={onBlur}
                      onChangeText={onChange}
                      value={value}
                      editable={!isLoading}
                    />
                    <TouchableOpacity
                      style={styles.showHideToggle}
                      onPress={() => setShowPassword(!showPassword)}
                    >
                      <Text style={styles.showHideText}>
                        {showPassword ? 'Hide' : 'Show'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {/* Strength Indicator */}
                  {value.length > 0 && (
                    <View style={styles.strengthContainer}>
                      <View style={styles.strengthBarBg}>
                        <View
                          style={[
                            styles.strengthBarFill,
                            {
                              backgroundColor: strength.color,
                              width: strength.width as any,
                            },
                          ]}
                        />
                      </View>
                      <Text style={[styles.strengthLabel, { color: strength.color }]}>
                        {strength.label}
                      </Text>
                    </View>
                  )}
                  {errors.password && (
                    <Text style={styles.fieldError}>{errors.password.message}</Text>
                  )}
                </View>
              )}
            />

            <Controller
              control={control}
              name="confirmPassword"
              rules={{
                required: 'Please confirm your password',
                validate: (value) =>
                  value === watchedPassword || 'Passwords do not match',
              }}
              render={({ field: { onChange, onBlur, value } }) => (
                <View style={styles.fieldWrapper}>
                  <Text style={styles.label}>Confirm Password</Text>
                  <View style={styles.passwordContainer}>
                    <TextInput
                      style={[
                        styles.input,
                        styles.passwordInput,
                        errors.confirmPassword && styles.inputError,
                      ]}
                      placeholder="Re-enter your password"
                      placeholderTextColor={ink400}
                      secureTextEntry={!showConfirmPassword}
                      autoCapitalize="none"
                      autoComplete="new-password"
                      onBlur={onBlur}
                      onChangeText={onChange}
                      value={value}
                      editable={!isLoading}
                    />
                    <TouchableOpacity
                      style={styles.showHideToggle}
                      onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      <Text style={styles.showHideText}>
                        {showConfirmPassword ? 'Hide' : 'Show'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {errors.confirmPassword && (
                    <Text style={styles.fieldError}>
                      {errors.confirmPassword.message}
                    </Text>
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

            {/* Create Account Button */}
            <TouchableOpacity
              style={[styles.primaryButton, isLoading && styles.primaryButtonDisabled]}
              onPress={handleSubmit(onSubmit)}
              disabled={isLoading || isSocialLoading !== null}
            >
              {isLoading ? (
                <ActivityIndicator color={white} />
              ) : (
                <Text style={styles.primaryButtonText}>Create Account</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
              <Text style={styles.footerText}>
                Already have an account? <Text style={styles.link}>Sign in</Text>
              </Text>
            </TouchableOpacity>
          </View>
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
  header: {
    alignItems: 'center',
    marginTop: 48,
    marginBottom: 32,
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: ink950,
    textAlign: 'center',
  },
  socialSection: {
    gap: 12,
    marginBottom: 24,
  },
  socialButton: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: ink400,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: white,
  },
  socialButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: ink950,
  },
  appleButton: {
    backgroundColor: ink950,
    borderColor: ink950,
  },
  appleButtonText: {
    color: white,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: ink400,
    opacity: 0.3,
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 14,
    color: ink400,
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
  passwordContainer: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 64,
  },
  showHideToggle: {
    position: 'absolute',
    right: 16,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  showHideText: {
    fontSize: 14,
    fontWeight: '600',
    color: blue500,
  },
  strengthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  strengthBarBg: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
  },
  strengthBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize: 12,
    fontWeight: '600',
    minWidth: 60,
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
});
