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
import { signIn, signInWithGoogle, signInWithApple } from '@/services/auth';

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

type LoginFormData = {
  email: string;
  password: string;
};

export default function LoginScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSocialLoading, setIsSocialLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    mode: 'onBlur',
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setError(null);
    try {
      await signIn(data.email, data.password);
    } catch (err: any) {
      setError(err.message || 'Failed to sign in. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsSocialLoading('google');
    setError(null);
    try {
      await signInWithGoogle();
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
            <Text style={styles.logo}>ChoreQuest</Text>
            <Text style={styles.heading}>Welcome back</Text>
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
            <Text style={styles.dividerText}>or sign in with email</Text>
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
                      placeholder="Enter your password"
                      placeholderTextColor={ink400}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoComplete="password"
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
                  {errors.password && (
                    <Text style={styles.fieldError}>{errors.password.message}</Text>
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

            {/* Sign In Button */}
            <TouchableOpacity
              style={[styles.primaryButton, isLoading && styles.primaryButtonDisabled]}
              onPress={handleSubmit(onSubmit)}
              disabled={isLoading || isSocialLoading !== null}
            >
              {isLoading ? (
                <ActivityIndicator color={white} />
              ) : (
                <Text style={styles.primaryButtonText}>Sign In</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Footer Links */}
          <View style={styles.footer}>
            <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')}>
              <Text style={styles.link}>Forgot password?</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
              <Text style={styles.footerText}>
                New here? <Text style={styles.link}>Create an account</Text>
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
  logo: {
    fontSize: 32,
    fontWeight: '800',
    color: navy900,
    marginBottom: 8,
  },
  heading: {
    fontSize: 20,
    fontWeight: '600',
    color: ink950,
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
