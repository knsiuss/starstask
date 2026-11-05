#!/usr/bin/env node
// Backfill attendance_records (new model) from legacy discussion_session_checkins.
// Idempotent: check existing before insert. Dry-run default, --apply to write.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..');
const ENV_PATH = path.join(REPO_ROOT, 'apps', 'web', '.env.local');
const SUPABASE_MODULE = path.join(REPO_ROOT, 'apps', 'web', 'node_modules', '@supabase', 'supabase-js', 'dist', 'index.mjs');
function parseEnv(p) {
  const v = {};
  for (const l of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const t = l.trim();
    if (!t || t.startsWith('#')) continue;
    const e = t.indexOf('=');
    if (e < 1) continue;
    let val = t.slice(e + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    v[t.slice(0, e).trim()] = val;
  }
  return v;
}
const env = parseEnv(ENV_PATH);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRole) throw new Error('Missing Supabase env');
const apply = process.argv.includes('--apply');
const allowRemote = process.argv.includes('--allow-remote-write');
const isLocal = url.includes('127.0.0.1') || url.includes('localhost');
if (apply && !isLocal && !allowRemote) throw new Error('REFUSED: production needs --allow-remote-write');
const { createClient } = await import('file://' + SUPABASE_MODULE);
const client = createClient(url, serviceRole, { auth: { persistSession: false } });

// attendance_records.meeting_id -> legacy discussion_sessions.id mapping?
// Check schema: meeting_id references attendance_meetings or discussion_sessions?
const { data: sessions } = await client.from('discussion_sessions').select('id, class_id, subject_id, starts_at').limit(100);
console.log('legacy sessions', sessions?.length);
const { data: checkins } = await client.from('discussion_session_checkins').select('session_id, user_id, status, recorded_at, note').limit(1000);
console.log('legacy checkins', checkins?.length);
const { data: meetings } = await client.from('attendance_meetings').select('id, class_id, subject_id, starts_at').limit(100).then(r => r.data ? r : {data: []});
console.log('new meetings (attendance_meetings)', meetings?.length);
// New academic UI uses attendance_meetings + attendance_records, NOT discussion_sessions.
// So legacy checkins need meeting_id = discussion_sessions.id if schema allows, or create attendance_meetings mirror.
console.log('DRY: legacy checkins keyed by discussion_sessions.id, new UI keyed by attendance_meetings.id — need mirror step');
