#!/usr/bin/env node
// Backfill attendance_meetings + attendance_records from legacy
// discussion_sessions + discussion_session_checkins.
// dry-run default, --apply writes. Idempotent via check.
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

const UNI = '875da92c-bf36-4291-b1bd-6ced4f549600';
const { data: offerings } = await client.from('course_offerings').select('id, class_id, course_id').eq('university_id', UNI);
const { data: subjects } = await client.from('class_subjects').select('id, class_id, course_id, name');
const { data: courses } = await client.from('courses').select('id, name');
// offering by class+course, fallback class only
const offeringByClassCourse = new Map();
for (const o of offerings ?? []) offeringByClassCourse.set(`${o.class_id}|${o.course_id}`, o.id);
const offeringByClass = new Map();
for (const o of offerings ?? []) if (!offeringByClass.has(o.class_id)) offeringByClass.set(o.class_id, o.id);

function offeringFor(session) {
  const subj = (subjects ?? []).find((s) => s.id === session.subject_id);
  if (subj?.course_id && offeringByClassCourse.has(`${session.class_id}|${subj.course_id}`)) {
    return offeringByClassCourse.get(`${session.class_id}|${subj.course_id}`);
  }
  return offeringByClass.get(session.class_id) ?? null;
}

const { data: sessions } = await client.from('discussion_sessions').select('id, class_id, subject_id, starts_at, title, status').order('starts_at');
console.log('legacy sessions', sessions?.length);
const { data: checkins, error: checkinErr } = await client.from('discussion_session_checkins').select('session_id, user_id, status, checked_in_at, note');
if (checkinErr) console.log('checkin err', checkinErr.message);
console.log('legacy checkins', checkins?.length);

const { data: memberships } = await client.from('university_memberships').select('id, user_id').eq('university_id', UNI);
const { data: identities } = await client.from('student_identities').select('id, university_membership_id').eq('university_id', UNI);
const identityByUser = new Map();
const memberById = new Map((memberships ?? []).map((m) => [m.id, m.user_id]));
for (const i of identities ?? []) {
  const uid = memberById.get(i.university_membership_id);
  if (uid) identityByUser.set(uid, i.id);
}
console.log('identities mapped', identityByUser.size);

let meetingsCreated = 0, recordsCreated = 0, skipped = 0;
const meetingByLegacy = new Map();
for (const s of sessions ?? []) {
  const offeringId = offeringFor(s);
  if (!offeringId) { console.log('no offering for session', s.id, s.title); skipped++; continue; }
  if (!apply) { console.log('[dry] meeting', s.title, s.starts_at, 'offering', offeringId); continue; }
  const { data: existing } = await client.from('attendance_meetings').select('id').eq('offering_id', offeringId).eq('scheduled_at', s.starts_at).maybeSingle();
  if (existing) { meetingByLegacy.set(s.id, existing.id); continue; }
  const { data: created, error } = await client.from('attendance_meetings').insert({
    university_id: UNI,
    offering_id: offeringId,
    scheduled_at: s.starts_at,
    status: s.status === 'cancelled' ? 'cancelled' : 'scheduled',
    created_by: 'da31e43e-bf39-408a-8eae-f49276728402',
  }).select('id').single();
  if (error) { console.log('meeting err', error.message); skipped++; continue; }
  meetingByLegacy.set(s.id, created.id);
  meetingsCreated++;
}
console.log('meetings created', meetingsCreated, 'skipped', skipped);

if (apply) {
  for (const c of checkins ?? []) {
    const meetingId = meetingByLegacy.get(c.session_id);
    if (!meetingId) continue;
    const identityId = identityByUser.get(c.user_id);
    if (!identityId) continue;
    const statusMap = { present: 'present', late: 'late', excused: 'excused', sick: 'sick', absent: 'absent' };
    const status = statusMap[c.status] ?? 'present';
    const { data: ex } = await client.from('attendance_records').select('id').eq('meeting_id', meetingId).eq('student_identity_id', identityId).maybeSingle();
    if (ex) continue;
    const { error } = await client.from('attendance_records').insert({
      university_id: UNI,
      meeting_id: meetingId,
      student_identity_id: identityId,
      status,
      recorded_by: c.user_id,
      recorded_at: c.checked_in_at ?? new Date().toISOString(),
      note: c.note ?? null,
    });
    if (!error) recordsCreated++;
  }
  console.log('records created', recordsCreated);
} else {
  console.log('[dry] would create records per checkin with identity');
}
console.log(apply ? 'APPLIED' : 'DRY COMPLETE');
