// Root layout - auth-gated navigation router
// S1-08: If auth loading: show splash. If not authenticated: redirect to /(auth)/login.
// If authenticated: redirect to /profiles. Never flashes wrong screen.
export { default } from 'expo-router/build/qualified-entry';
