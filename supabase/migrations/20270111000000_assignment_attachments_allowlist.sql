-- Storage bucket for assignment attachments currently only accepts the formats
-- in the original allowlist. Align the bucket with the ~20 extensions the web
-- already allows server-side (pdf, docx, pptx, xlsx, png, jpg, jpeg, csv,
-- ipynb, txt, md, json, py, js, ts, tsx, zip, mp4, mp3).
--
-- Bucket stays private; RLS policies and bucket flags are unchanged. The
-- native shell picks the mime type from an explicit extension mapping, so this
-- does not introduce arbitrary uploads.

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'application/pdf',
  'application/zip',
  'application/json',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
  'text/csv',
  'text/plain',
  'text/markdown',
  'text/x-python',
  'text/javascript',
  'text/typescript',
  'video/mp4',
  'audio/mpeg'
]
WHERE id = 'assignment-attachments';
