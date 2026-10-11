import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/constants/tokens';
import KidAvatar from './KidAvatar';
export default function PlaygroundHero({title,subtitle,avatarId='avatar-06',compact=false}:{title:string;subtitle:string;avatarId?:string;compact?:boolean}) {
 return <View style={[styles.hero,compact&&styles.compact]}>
 <View accessible={false} style={styles.orbit}/><Text accessible={false} style={styles.spark}>✧</Text>
 <View style={styles.copy}><Text style={styles.eyebrow}>CHOREQUEST · LITTLE HEROES</Text><Text style={[styles.title,compact&&{color:'#F7F5FF',fontSize:25,lineHeight:31}]}>{title.includes('\n')?<>{title.split('\n')[0]}{'\n'}<Text style={{color:colors.lime}}>{title.split('\n').slice(1).join('\n')}</Text></>:title}</Text><Text style={styles.subtitle}>{subtitle}</Text></View>
 <View style={styles.portrait}><KidAvatar avatarId={avatarId} size={compact?76:100}/><Text accessible={false} style={styles.star}>★</Text></View>
 </View>;
}
const styles=StyleSheet.create({hero:{backgroundColor:colors.hero,borderColor:'#72528F',borderWidth:1,borderRadius:28,padding:22,minHeight:200,flexDirection:'row',alignItems:'center',gap:12,marginBottom:22,overflow:'hidden'},compact:{padding:18,minHeight:140},copy:{flex:1,zIndex:1},eyebrow:{fontFamily:'Nunito_800ExtraBold',fontSize:10,color:colors.lime,letterSpacing:1,marginBottom:13},title:{fontFamily:'Nunito_800ExtraBold',fontSize:30,lineHeight:35,color:colors.white},subtitle:{fontFamily:'Nunito_600SemiBold',fontSize:14,lineHeight:21,color:'#E7DDF2',marginTop:10},portrait:{borderRadius:80,borderWidth:5,borderColor:colors.coral,transform:[{rotate:'7deg'}]},star:{position:'absolute',bottom:-12,left:0,fontSize:30,color:colors.starGold},orbit:{position:'absolute',width:220,height:220,borderRadius:110,backgroundColor:'#7655A533',right:-75,top:-80},spark:{position:'absolute',top:14,right:20,color:colors.starGold,fontSize:28}});
