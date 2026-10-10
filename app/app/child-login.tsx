import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import PinOverlay from '@/components/shared/PinOverlay';
import { useAuthStore } from '@/stores/authStore';
import { enterChildMode } from '@/services/auth';
import { colors } from '@/constants/tokens';
export default function ChildLogin() {
 const router = useRouter(); const { familyId, childProfileId, childNickname, childAvatarId } = useAuthStore();
 if (!familyId || !childProfileId) return <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}><Text>Ask a parent to sign in to your family.</Text><TouchableOpacity onPress={() => router.replace('/parent-unlock')}><Text style={{ color: colors.navy900, padding: 16 }}>Parent sign-in</Text></TouchableOpacity></View>;
 return <PinOverlay child={{ id: childProfileId, familyAccountId: familyId, nickname: childNickname ?? 'Your profile', avatarId: childAvatarId ?? 'avatar-01' }} onSuccess={async (sessionToken, customToken) => { await enterChildMode(childProfileId, sessionToken, customToken); router.replace('/(child)/home'); }} onCancel={() => router.replace('/parent-unlock')} />;
}
