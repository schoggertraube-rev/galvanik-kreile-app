import fs from 'node:fs';
import path from 'node:path';
import { findRoot, readJson, writeJson, ensureDir } from './lib.mjs';
const root=findRoot();
const target=path.join(root,'.claude','settings.json');
const fragment=readJson(path.join(root,'.claude','settings.company.json'),{});
const current=readJson(target,{});
current.hooks=current.hooks||{};
for(const [event,entries] of Object.entries(fragment.hooks||{})){
  current.hooks[event]=current.hooks[event]||[];
  for(const entry of entries){
    const sig=JSON.stringify(entry);
    if(!current.hooks[event].some(e=>JSON.stringify(e)===sig)) current.hooks[event].push(entry);
  }
}
ensureDir(path.dirname(target)); writeJson(target,current);
console.log(`settings merged: ${target}`);
