import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

export const RED_LISTS = ['e2e/generated/_erwartet_rot.json', 'e2e/ablauf/_erwartet_rot.json'];

function readList(text, path) {
  let value;
  try { value = JSON.parse(text); } catch { throw Error('EXPECTED_RED_INVALID_JSON:' + path); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('EXPECTED_RED_INVALID_LIST:' + path);
  for (const [id, entry] of Object.entries(value)) {
    if (!id.trim() || !entry || typeof entry !== 'object' || Array.isArray(entry)
      || typeof entry.paket !== 'string' || !entry.paket.trim()
      || typeof entry.grund !== 'string' || !entry.grund.trim()
      || Object.keys(entry).some(key => !['paket', 'grund', 'erwarteterWert', 'tatsaechlicherWertEnthaelt'].includes(key))
      || ['erwarteterWert', 'tatsaechlicherWertEnthaelt'].some(key => Object.hasOwn(entry, key) && typeof entry[key] !== 'string')) {
      throw Error('EXPECTED_RED_INVALID_ENTRY:' + id);
    }
  }
  return value;
}

export function checkRedListShrink(baseText, candidateText, path) {
  const candidate = readList(candidateText, path);
  // PL16.11 S14a(c)V2: a list absent from merge-base main gets its initial
  // state once in S14a. Thereafter main contains it and this branch is unused.
  if (baseText === null) return;
  const base = readList(baseText, path);
  for (const [id, entry] of Object.entries(candidate)) {
    const before = base[id];
    if (!Object.hasOwn(base, id) || Object.keys(entry).length !== Object.keys(before).length
      || Object.entries(entry).some(([key, value]) => !Object.hasOwn(before, key) || before[key] !== value)) {
      throw Error('EXPECTED_RED_MAY_ONLY_SHRINK:' + id);
    }
  }
}

export function runRedListShrink() {
  const git = (...args) => execFileSync('git', args, {encoding: 'utf8'}).trim();
  const base = git('merge-base', 'origin/main', 'HEAD');
  for (const path of RED_LISTS) {
    // Failures reading the repository are never treated as an absent list.
    const exists = git('ls-tree', '--name-only', base, '--', path) === path;
    const baseText = exists ? execFileSync('git', ['show', base + ':' + path], {encoding: 'utf8'}) : null;
    checkRedListShrink(baseText, readFileSync(resolve(path), 'utf8'), path);
  }
  console.log('EXPECTED_RED_SHRINK_OK');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { runRedListShrink(); } catch (error) {
    console.error(error instanceof Error ? error.message : 'EXPECTED_RED_CHECK_FAILED');
    process.exitCode = 1;
  }
}
