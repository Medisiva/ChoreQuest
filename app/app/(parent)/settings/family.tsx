import {useState,useRef,useEffect} from 'react';
import {Text,TextInput,TouchableOpacity,ScrollView,KeyboardAvoidingView,Platform} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useRouter} from 'expo-router';
import {useFamilyStore} from '@/stores/familyStore';
import {manageFamily} from '@/services/families';
import {errorMessage} from '@/services/errorMessage';

export default function FamilySettings() {
 const router=useRouter(),{family}=useFamilyStore();
 const [name,setName]=useState(family?.familyName || ''),[timezone,setTimezone]=useState(family?.timezone || 'UTC');
 const [email,setEmail]=useState(''),[code,setCode]=useState(''),[message,setMessage]=useState('');
 useEffect(()=>{if(family){setName(family.familyName);setTimezone(family.timezone || 'UTC');}},[family?.id]);
 const pending=useRef(false);const [busy,setBusy]=useState(false);
 async function run(action:'settings'|'invite') {
  if(!family || pending.current)return;pending.current=true;setBusy(true);setMessage('');
  try {const result=await manageFamily<{code?:string}>({familyId:family.id,action,familyName:name.trim(),timezone:timezone.trim(),email:email.trim()});
   if(action==='invite'){setCode(result.code || '');setMessage('Share this code privately with the invited parent. They must register and verify this email, then choose Join a family. The code expires in seven days and can be used once.');}
   else setMessage('Family settings saved.');
  }catch(e){setMessage(errorMessage(e));}finally{pending.current=false;setBusy(false);}
 }
 return <SafeAreaView style={{flex:1,backgroundColor:'#F5F8FF'}}><KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':'height'}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:24,gap:16}}>
 <TouchableOpacity onPress={()=>router.replace('/(parent)/settings')} accessibilityRole="button"><Text>← Settings</Text></TouchableOpacity>
 <Text style={{fontSize:28,fontWeight:'700',color:'#16244D'}}>Your family</Text>
 <Text>Family name</Text><TextInput accessibilityLabel="Family name" value={name} onChangeText={setName} maxLength={80} style={input}/>
 <Text>Timezone</Text><TextInput accessibilityLabel="Family timezone" value={timezone} onChangeText={setTimezone} autoCapitalize="none" style={input}/><Text>Use a timezone such as America/New_York, Europe/London or Asia/Kolkata. This controls quest and target periods.</Text>
 <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={()=>void run('settings')} style={button}><Text style={{color:'white'}}>Save family settings</Text></TouchableOpacity>
 <Text style={{fontSize:22,fontWeight:'700'}}>Invite another parent</Text><Text>The family owner can invite a second parent to the same shared family.</Text>
 <TextInput accessibilityLabel="Invited parent email" placeholder="Parent email" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} style={input}/>
 <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={()=>void run('invite')} style={button}><Text style={{color:'white'}}>Create parent invitation</Text></TouchableOpacity>
 {code?<Text selectable accessibilityLabel="Parent invitation code">{code}</Text>:null}
 {message?<Text accessibilityRole="alert">{message}</Text>:null}
 </ScrollView></KeyboardAvoidingView></SafeAreaView>;
}
const input={backgroundColor:'white',padding:14,borderRadius:12,borderWidth:1,borderColor:'#6C7893'};
const button={backgroundColor:'#1555E8',padding:16,borderRadius:12,alignItems:'center' as const};
