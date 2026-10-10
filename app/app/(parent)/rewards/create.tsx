import { useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFamilyStore } from '@/stores/familyStore';
import { useAuthStore } from '@/stores/authStore';
import { createReward } from '@/services/rewards';
import { colors } from '@/constants/tokens';
export default function CreateReward() {
 const router=useRouter(); const {family}=useFamilyStore();const {user}=useAuthStore();
 const [name,setName]=useState('');const [cost,setCost]=useState('10');const [saving,setSaving]=useState(false);const [error,setError]=useState('');
 async function save(){ if(!family||!user){setError('Please wait for your family to load.');return;}setSaving(true);setError('');try{await createReward(family.id,user.uid,{name,starCost:Number(cost),rewardType:'Special'});router.back();}catch(e){setError(e instanceof Error?e.message:'Could not save reward.');}finally{setSaving(false);} }
 return <SafeAreaView style={{flex:1,backgroundColor:colors.cloud}}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
 <TouchableOpacity onPress={()=>router.back()}><Text style={styles.link}>← Back</Text></TouchableOpacity><Text style={styles.title}>A little something to earn</Text>
 <Text style={styles.label}>Reward name</Text><TextInput accessibilityLabel="Reward name" style={styles.input} placeholder="e.g. Choose family movie night" value={name} onChangeText={setName} maxLength={80} editable={!saving}/>
 <Text style={styles.label}>Star cost</Text><TextInput accessibilityLabel="Reward star cost" style={styles.input} value={cost} onChangeText={setCost} keyboardType="number-pad" editable={!saving}/>
 {error?<Text accessibilityRole="alert" style={{color:colors.danger}}>{error}</Text>:null}
 <TouchableOpacity accessibilityRole="button" disabled={saving} onPress={save} style={styles.button}>{saving?<ActivityIndicator color={colors.white}/>:<Text style={{color:colors.white,fontWeight:'700'}}>Save Reward</Text>}</TouchableOpacity>
 </ScrollView></SafeAreaView>;
}
const styles=StyleSheet.create({content:{padding:24,gap:18},link:{color:colors.navy900,fontSize:16},title:{fontFamily:'Nunito_800ExtraBold',fontSize:28,color:colors.ink950},label:{fontSize:16,color:colors.ink950},input:{padding:16,borderWidth:1,borderColor:colors.ink400,borderRadius:16,backgroundColor:colors.white,fontSize:16},button:{minHeight:52,backgroundColor:colors.navy900,borderRadius:16,justifyContent:'center',alignItems:'center'}});
