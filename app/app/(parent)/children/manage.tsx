import {useEffect,useState,useRef} from 'react';
import {Text,TextInput,TouchableOpacity,ScrollView,View,KeyboardAvoidingView,Platform} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useRouter} from 'expo-router';
import {doc,getDoc,setDoc} from 'firebase/firestore';
import {db} from '@/services/firebase';
import {useFamilyStore} from '@/stores/familyStore';
import {manageFamily} from '@/services/families';
import {awardBonusStars,deductStars} from '@/services/stars';
import {errorMessage} from '@/services/errorMessage';
import Alert from '@/services/dialogs';
import AvatarPicker from '@/components/shared/AvatarPicker';
import KidAvatar from '@/components/shared/KidAvatar';
import type {AgeGroup,ConsequenceLevel} from '@/types';

export default function ManageChildren() {
 const router=useRouter(),{family,children,archivedChildren}=useFamilyStore();const [id,setId]=useState(children[0]?.id || '');
 const [nickname,setNickname]=useState(''),[avatar,setAvatar]=useState('avatar-01'),[age,setAge]=useState<AgeGroup>('6-8');
 const [weekly,setWeekly]=useState('20'),[monthly,setMonthly]=useState('80');
 const [amount,setAmount]=useState('5'),[reason,setReason]=useState('');
 const [level,setLevel]=useState<ConsequenceLevel>('Yellow'),[consequence,setConsequence]=useState(''),[description,setDescription]=useState('');
 const [message,setMessage]=useState(''),[busy,setBusy]=useState(false);const pending=useRef(false);
 useEffect(()=>{const child=children.find(c=>c.id===id);if(child){setNickname(child.nickname);setAvatar(child.avatarId);setAge(child.ageGroup);setWeekly(String(child.weeklyTargetStars));setMonthly(String(child.monthlyTargetStars));}},[id,children]);
 useEffect(()=>{let active=true;setConsequence('');setDescription('');if(family&&id)void getDoc(doc(db,'families',family.id,'consequenceDefinitions',`${id}-${level}`)).then(s=>{if(active&&s.exists()){setConsequence(s.data().name);setDescription(s.data().description || '');}}).catch(e=>{if(active)setMessage(errorMessage(e));});return()=>{active=false;};},[family?.id,id,level]);
 async function run(action:'editChild'|'archiveChild'|'restoreChild'|'bonus'|'deduction'|'consequence') {
  if(!family||!id||pending.current)return;pending.current=true;setBusy(true);setMessage('');
  try{
   if(action==='bonus'||action==='deduction')await (action==='bonus'?awardBonusStars:deductStars)(family.id,id,Number(amount),reason.trim());
   else if(action==='consequence'){if(!consequence.trim())throw new Error('Give this consequence a name.');await setDoc(doc(db,'families',family.id,'consequenceDefinitions',`${id}-${level}`),{familyAccountId:family.id,childProfileId:id,level,name:consequence.trim(),description:description.trim()});}
   else await manageFamily({action,familyId:family.id,childId:id,nickname,avatarId:avatar,ageGroup:age,weeklyTargetStars:Number(weekly),monthlyTargetStars:Number(monthly)});
   setMessage(action==='archiveChild'?'Child profile removed from the picker. Existing history is retained.':'Saved.');
   if(action==='archiveChild')setId('');
  }catch(e){setMessage(errorMessage(e));}finally{pending.current=false;setBusy(false);}
 }
 const button=(label:string,action:()=>void)=><TouchableOpacity accessibilityRole="button" disabled={busy} onPress={action} style={btn}><Text style={{color:'white',fontWeight:'600'}}>{label}</Text></TouchableOpacity>;
 const field=(label:string,value:string,set:(s:string)=>void,max=80,numeric=false)=><View><Text>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={set} maxLength={max} keyboardType={numeric?'number-pad':'default'} style={input}/></View>;
 return <SafeAreaView style={{flex:1,backgroundColor:'#F5F8FF'}}><KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':'height'}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:24,gap:16}}>
 {button('← Settings',()=>router.replace('/(parent)/settings'))}<Text style={{fontSize:28,fontWeight:'700',color:'#16244D'}}>Manage your children</Text>
 <View style={{flexDirection:'row',flexWrap:'wrap',gap:12}}>{children.map(c=><TouchableOpacity accessibilityRole="button" key={c.id} onPress={()=>{setId(c.id);setMessage('');}} style={{padding:8,backgroundColor:c.id===id?'#FFF5B0':'white',borderRadius:16}}><KidAvatar avatarId={c.avatarId} size={56}/><Text>{c.nickname}</Text></TouchableOpacity>)}</View>
 {id?<>
 {field('Nickname',nickname,setNickname,20)}<AvatarPicker selectedId={avatar} onSelect={setAvatar}/>
 <View style={{flexDirection:'row',flexWrap:'wrap',gap:12}}>{(['3-5','6-8','9-11','12-14','15-17'] as AgeGroup[]).map(a=><TouchableOpacity key={a} accessibilityRole="button" onPress={()=>setAge(a)}><Text style={{padding:12,backgroundColor:a===age?'#FFF5B0':'white'}}>Age {a}</Text></TouchableOpacity>)}</View>
 {field('Weekly target',weekly,setWeekly,5,true)}{field('Monthly target',monthly,setMonthly,5,true)}{button('Save child profile',()=>void run('editChild'))}
 <Text style={{fontSize:22,fontWeight:'700'}}>Bonus or deduction</Text>{field('Star adjustment amount',amount,setAmount,5,true)}{field('Adjustment reason',reason,setReason,500)}
 {button('Give bonus stars',()=>void run('bonus'))}{button('Deduct stars',()=>Alert.alert('Deduct stars?', 'This records the reason and never reduces the balance below zero.',[{text:'Cancel',style:'cancel'},{text:'Deduct',onPress:()=>void run('deduction')}]))}
 <Text style={{fontSize:22,fontWeight:'700'}}>Consequences for missed targets</Text><Text>Yellow: first missed period. Orange: second. Red: third or later. Choose a calm, age-appropriate consequence together.</Text>
 <View style={{flexDirection:'row',gap:12}}>{(['Yellow','Orange','Red'] as ConsequenceLevel[]).map(l=><TouchableOpacity accessibilityRole="button" key={l} onPress={()=>setLevel(l)}><Text style={{padding:12,backgroundColor:l===level?'#FFF5B0':'white'}}>{l}</Text></TouchableOpacity>)}</View>
 {field('Consequence name',consequence,setConsequence,80)}{field('Consequence description',description,setDescription,500)}{button('Save consequence',()=>void run('consequence'))}
 {button('Remove child profile',()=>Alert.alert('Remove child profile?', 'The profile will be hidden and child sessions ended. Quest, reward and accountability history stays available to parents.',[{text:'Cancel',style:'cancel'},{text:'Remove profile',style:'destructive',onPress:()=>void run('archiveChild')}]))}
 </>:<Text>Select a child above.</Text>}
 {archivedChildren.length>0 && <View><Text>Removed profiles (history retained)</Text>{archivedChildren.map(c=><TouchableOpacity accessibilityRole="button" disabled={busy} key={c.id} onPress={()=>void manageFamily({action:'restoreChild',familyId:family?.id,childId:c.id}).then(()=>setMessage('Profile restored.')).catch(e=>setMessage(errorMessage(e)))}><Text style={{padding:16}}>Restore {c.nickname}</Text></TouchableOpacity>)}</View>}
 {message?<Text accessibilityRole="alert">{message}</Text>:null}
 </ScrollView></KeyboardAvoidingView></SafeAreaView>;
}
const input={backgroundColor:'white',padding:14,borderRadius:12,borderWidth:1,borderColor:'#6C7893',marginTop:8};
const btn={backgroundColor:'#1555E8',padding:16,borderRadius:12,alignItems:'center' as const};
