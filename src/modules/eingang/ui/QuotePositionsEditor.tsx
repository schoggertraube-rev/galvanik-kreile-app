"use client";
import {Plus,Trash2} from 'lucide-react';
import styles from '@/components/layout/TargetShell.module.css';
export type PositionDraft = {
  key: string;
  catalogServiceId: string;
  name: string;
  quantity: string;
  material: string;
  surfaceRequested: string;
  unit: string;
  unitPriceCents: number | null;
};
const FREE_TEXT_SERVICE='FREE_TEXT';
export function QuotePositionsEditor({positions,surfaceOptions,onName,onSurface,onPrice,onField,onRemove,onAdd}:{positions:PositionDraft[];surfaceOptions:readonly {key:string;label:string}[];onName:(key:string,value:string)=>void;onSurface:(key:string,value:string)=>void;onPrice:(key:string,value:string)=>void;onField:(key:string,field:'quantity'|'material',value:string)=>void;onRemove:(key:string)=>void;onAdd:()=>void}){
 return (<div className={styles.createPositions}>
                    <h3>Positionen</h3>
                    {positions.map((position, index) => (
                      <fieldset key={position.key} className={styles.createPosition}>
                        <legend>Position {index + 1}</legend>
                        <label className={styles.createFieldWide}>Teil / Leistung<input data-autofocus={index === 0 || undefined} required minLength={2} list="kr-service-catalog" placeholder="Katalog oder Freitext" value={position.name} onChange={(event) => onName(position.key, event.target.value)} /></label>
                        <label>Menge<input required inputMode="numeric" type="number" min="1" max="1000000" value={position.quantity} onChange={(event) => onField(position.key, "quantity", event.target.value)} /></label>
                        <label>Material<input value={position.material} onChange={(event) => onField(position.key, "material", event.target.value)} /></label>
                        <label>Oberfläche<select required value={position.surfaceRequested} onChange={(event) => onSurface(position.key, event.target.value)}><option value="">Bitte wählen</option>{surfaceOptions.map((surface) => <option key={surface.key} value={surface.key}>{surface.label}</option>)}</select></label>
                        <label>Einheit<input readOnly value={position.unit} /></label>
                        <label>Preis netto (€)<input required type="number" min="0" step="0.01" readOnly={position.catalogServiceId !== FREE_TEXT_SERVICE} value={position.unitPriceCents === null ? "" : String(position.unitPriceCents / 100)} onChange={(event) => onPrice(position.key, event.target.value)} /></label>
                        {positions.length > 1 ? <button type="button" className={styles.createRemove} onClick={() => onRemove(position.key)} aria-label={`Position ${index + 1} entfernen`}><Trash2 /></button> : null}
                      </fieldset>
                    ))}
                    {positions.length < 20 ? <button type="button" className={styles.createAddPosition} onClick={() => onAdd()}><Plus /> Position hinzufügen</button> : null}
                  </div>);
}
