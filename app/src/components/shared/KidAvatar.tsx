import { Image, View } from 'react-native';

/** Stable avatar IDs retain existing profile choices; art stays bundled and private. */
export default function KidAvatar({ avatarId = 'avatar-01', size = 64 }: { avatarId?: string; size?: number }) {
  const parsed = Number(avatarId.replace('avatar-', ''));
  const index = Number.isInteger(parsed) && parsed >= 1 && parsed <= 20 ? parsed - 1 : 0;
  return <View accessible={false} style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: '#B4E5FF' }}>
    <Image source={require('../../../assets/illustrations/kid-portraits.png')} resizeMode="stretch"
      style={{ position: 'absolute', width: size * 5, height: size * 5, left: -(index % 5) * size, top: -Math.floor(index / 5) * size * 1.25 }} />
  </View>;
}
