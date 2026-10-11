import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
/** Reject saves before Firebase can queue a write that appears unfinished. */
export async function requireOnline(): Promise<void> {
  const state = await NetInfo.fetch();
  if (state.isConnected === false || (Platform.OS !== 'web' && state.isInternetReachable === false)) {
    throw new Error('You’re offline. Reconnect before sending or saving.');
  }
}
