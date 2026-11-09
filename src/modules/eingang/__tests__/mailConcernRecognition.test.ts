import {describe,expect,it} from 'vitest';
import {recognizeNoteConcerns} from '../captureContract';

describe('the existing recognizer in mail context',()=>{
 it('turns the explicit request into one quote concern, not a duplicate generic task',()=>{
  expect(recognizeNoteConcerns('Bitte erstellen Sie einen Kostenvoranschlag für vier Trompeten.','mail').map(value=>value.id)).toEqual(['kv_anfrage']);
  expect(recognizeNoteConcerns('KV-Anfrage','mail').map(value=>value.id)).toEqual(['kv_anfrage']);
 });
 it('does not treat an offer mention, negated request or quoted request as a new request',()=>{
  for(const text of ['Danke für Ihr Angebot.','Bitte senden Sie mir Ihr Angebot vom letzten Jahr erneut.','Bitte keinen Kostenvoranschlag erstellen.','Kein Angebot anfordern.','> Bitte erstellen Sie einen Kostenvoranschlag.'])expect(recognizeNoteConcerns(text,'mail').map(value=>value.id)).not.toContain('kv_anfrage');
 });
 it('preserves existing note behavior and independent tasks in a second sentence',()=>{
  expect(recognizeNoteConcerns('Bitte erstellen Sie einen Kostenvoranschlag.').map(value=>value.id)).toEqual(['aufgabe']);
  expect(recognizeNoteConcerns('Bitte erstellen Sie einen Kostenvoranschlag. Bitte Maschine reinigen.','mail').map(value=>value.id)).toEqual(['aufgabe','kv_anfrage']);
 });
});
