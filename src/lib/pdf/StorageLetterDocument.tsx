import 'server-only';
import {Document,Page,Text,View,StyleSheet,type DocumentProps} from '@react-pdf/renderer';
import type {ReactElement} from 'react';
import type {CompanyLetterSettings} from '@/modules/fundament/public';
import {COLLECTION_REMINDER_COPY as copy} from '@/ui/situationCatalog';

export type StorageLetterSnapshot={date:string;deadline?:{date:string;due:string|null};company:CompanyLetterSettings;recipient:{name:string;street:string;zip:string;city:string;country:string};orderNumbers:string[];body:string};
const styles=StyleSheet.create({page:{padding:48,fontFamily:'Helvetica',fontSize:11,color:'#182033',lineHeight:1.5},sender:{fontSize:9,marginBottom:32},address:{marginBottom:28},title:{fontSize:18,fontFamily:'Helvetica-Bold',marginBottom:8},date:{fontSize:10,marginBottom:20},draft:{fontSize:10,color:'#675E51',marginBottom:16},body:{marginBottom:24},footer:{position:'absolute',bottom:36,left:48,right:48,fontSize:9,color:'#675E51',borderTopWidth:1,borderTopColor:'#D5D0C7',paddingTop:8}});
/** Read-only preview. The actual postal dispatch must have its own explicit receipt. */
export function createStorageLetterPdfDocument(snapshot:StorageLetterSnapshot,draft=true):ReactElement<DocumentProps>{
 const {company,recipient}=snapshot;
 return <Document title={copy.letterTitle} author={company.companyName}>
  <Page size="A4" style={styles.page}>
   <View style={styles.sender}><Text>{company.companyName}</Text><Text>{company.street} · {company.zip} {company.city} · {company.country}</Text></View>
   <View style={styles.address}><Text>{recipient.name}</Text><Text>{recipient.street}</Text><Text>{recipient.zip} {recipient.city}</Text><Text>{recipient.country}</Text></View>
   <Text style={styles.title}>{copy.letterTitle}</Text>{draft?<Text style={styles.draft}>{copy.letterDraft}</Text>:null}
   <Text style={styles.date}>{snapshot.date.split('-').reverse().join('.')}</Text>
   <Text style={styles.body}>{snapshot.body}</Text>
   <Text>{snapshot.orderNumbers.join(' · ')}</Text>
   <View style={styles.footer}><Text>{company.companyName} · {company.street} · {company.zip} {company.city}</Text></View>
  </Page>
 </Document>;
}
