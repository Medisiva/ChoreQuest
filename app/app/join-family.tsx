import {useState,useRef} from 'react';
import {Text,TextInput,TouchableOpacity,ScrollView,KeyboardAvoidingView,Platform} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useRouter} from 'expo-router';
import {sendEmailVerification} from 'firebase/auth';
import {auth} from '@/services/firebase';
import {manageFamily} from '@/services/families';
import {errorMessage} from '@/services/errorMessage';
export default function JoinFamily() {
 const router=useRouter();const [name,setName]=useState(auth.currentUser?.displayName || ''),[code,setCode]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);const pending=useRef(false);
 async function join(){if(pending.current)return;pending.current=true;setBusy(true);setMessage('');try{await auth.currentUser?.reload();await auth.currentUser?.getIdToken(true);await manageFamily({action:'join',displayName:name.trim(),code:code.trim()});router.replace('/profiles');}catch(e){setMessage(errorMessage(e));}finally{pending.current=false;setBusy(false);}}
 return <SafeAreaView style={{flex:1,backgroundColor:'#23232F'}}><KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':'height'}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:24,gap:16}}>
 <TouchableOpacity accessibilityRole="button" onPress={()=>router.back()}><Text style={{color:'#F7F5FF'}}>← Family setup</Text></TouchableOpacity><Text style={{color:'#F7F5FF',fontSize:28,fontWeight:'700'}}>Join your family</Text><Text style={{color:'#F7F5FF'}}>Sign in with the email your co-parent invited. Verify that email, then enter the invitation code they shared privately.</Text>
 <TextInput placeholderTextColor="#A9A7BA" accessibilityLabel="Your parent name" placeholder="Your name" value={name} onChangeText={setName} maxLength={80} style={input}/>
 <TextInput placeholderTextColor="#A9A7BA" accessibilityLabel="Family invitation code" placeholder="Invitation code" value={code} onChangeText={setCode} autoCapitalize="none" autoCorrect={false} maxLength={100} style={input}/>
 <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={()=>{const user=auth.currentUser;if(user)void sendEmailVerification(user).then(()=>setMessage('Verification email sent. Check your inbox, then return and join.')).catch(e=>setMessage(errorMessage(e)));}}><Text style={{color:'#F7F5FF'}}>Send email verification</Text></TouchableOpacity>
 <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={()=>void join()} style={{backgroundColor:'#65F3FF',padding:16,borderRadius:12}}><Text style={{color:'#17200C',textAlign:'center'}}>Join shared family</Text></TouchableOpacity>
 {message?<Text style={{color:'#F7F5FF'}} accessibilityRole="alert">{message}</Text>:null}
 </ScrollView></KeyboardAvoidingView></SafeAreaView>;
}
const input={color:'#F7F5FF',backgroundColor:'#121219',padding:14,borderRadius:12,borderWidth:1,borderColor:'#A9A7BA'};
