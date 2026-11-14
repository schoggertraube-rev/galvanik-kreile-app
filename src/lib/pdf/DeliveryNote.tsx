import React,{type ReactElement} from 'react';
import {Document,Page,StyleSheet,Text,View,type DocumentProps} from '@react-pdf/renderer';
import {DELIVERY_NOTE_COPY as copy} from '@/ui/situationCatalog';
import {formatEuro} from '@/lib/domain/formatEuro';

/** Frozen, already authorized facts only. No repository or current clock in
 * the renderer; the private original remains byte-identical on retry. */
export type PaidDeliveryNoteSnapshot={
 schemaVersion:1;createdAt:string;
 company:{companyName:string;street:string;zip:string;city:string;country:string};
 customer:{id:string;name:string;street:string;zip:string;city:string;country:string};
 orders:Array<{id:string;number:string;version:number;title:string;parts:Array<{itemId:string;name:string;quantity:number}>;
  payments:Array<{invoiceId:string;invoiceNumber:string;invoiceEventId:string;invoiceSha256:string;paymentEventId:string;paymentReceiptId:string;paymentVersion:number;amountCents:number;paidAt:string}>}>;
};
const styles=StyleSheet.create({page:{padding:40,fontFamily:'Helvetica',fontSize:10,color:'#161616'},header:{flexDirection:'row',justifyContent:'space-between',marginBottom:32},company:{fontSize:9,textAlign:'right',lineHeight:1.5},title:{fontSize:24,marginBottom:20},recipient:{lineHeight:1.5,marginBottom:25},row:{flexDirection:'row',paddingVertical:7,borderBottomWidth:1,borderBottomColor:'#DDDDDD'},order:{width:'25%'},description:{width:'50%'},quantity:{width:'25%',textAlign:'right'},tableHead:{backgroundColor:'#F8F8F8',fontSize:9},section:{marginTop:22,marginBottom:6,fontSize:12},payment:{lineHeight:1.6,fontSize:9},footer:{position:'absolute',bottom:26,left:40,right:40,fontSize:8,color:'#666666'}});
const date=(value:string)=>new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(value));

export const DeliveryNoteDocument=({snapshot:s}:{snapshot:PaidDeliveryNoteSnapshot})=>(
 <Document title={copy.title} author={s.company.companyName} creationDate={new Date(s.createdAt)} modificationDate={new Date(s.createdAt)}>
  <Page size="A4" style={styles.page}>
   <View style={styles.header}><View><Text style={styles.title}>{copy.title}</Text><Text>{copy.date} {date(s.createdAt)}</Text></View><View style={styles.company}><Text>{s.company.companyName}</Text><Text>{s.company.street}</Text><Text>{s.company.zip} {s.company.city}</Text><Text>{s.company.country}</Text></View></View>
   <View style={styles.recipient}><Text>{s.customer.name}</Text><Text>{s.customer.street}</Text><Text>{s.customer.zip} {s.customer.city}</Text><Text>{s.customer.country}</Text></View>
   <View style={[styles.row,styles.tableHead]}><Text style={styles.order}>{copy.order}</Text><Text style={styles.description}>{copy.description}</Text><Text style={styles.quantity}>{copy.quantity}</Text></View>
   {s.orders.flatMap(order=>order.parts.map(part=><View key={order.id+':'+part.itemId} style={styles.row} wrap={false}><Text style={styles.order}>{order.number}</Text><Text style={styles.description}>{part.name}</Text><Text style={styles.quantity}>{part.quantity.toLocaleString('de-DE')}</Text></View>))}
   <View style={styles.section}/>
   {s.orders.flatMap(order=>order.payments.map(payment=><Text key={payment.invoiceId} style={styles.payment}>{order.number} · {payment.invoiceNumber} · {copy.payment(date(payment.paidAt),formatEuro(payment.amountCents))}</Text>))}
   <Text style={styles.footer} fixed>{s.company.companyName} · {s.company.street} · {s.company.zip} {s.company.city}</Text>
  </Page>
 </Document>
);
export function createDeliveryNotePdfDocument(snapshot:PaidDeliveryNoteSnapshot):ReactElement<DocumentProps>{return <DeliveryNoteDocument snapshot={snapshot}/>;}
