# 28 — Entity-Relationship Diagrams (Target, 16 Diagrams)

> **Status:** DRAFT / PROPOSED. Mermaid `erDiagram` matching `26-target-database-schema.md`. Dashed = proposed/candidate.

## 1. Platform & tenant root

```mermaid
erDiagram
  UNIVERSITIES ||--o{ ACADEMIC_UNITS : "owns"
  UNIVERSITIES ||--o{ ACADEMIC_PERIODS : "has"
  UNIVERSITIES ||--o{ CLASSES : "has"
  UNIVERSITIES ||--o{ STUDENT_IDENTITIES : "has"
  PLATFORM_ADMINS }o--|| PROFILES : "flags"
```

## 2. Academic organization

```mermaid
erDiagram
  ACADEMIC_UNITS ||--o{ ACADEMIC_UNITS : "parent"
  ACADEMIC_UNITS ||--o{ CLASSES : "hosts"
  ACADEMIC_UNITS ||--o{ STUDENT_IDENTITIES : "programs"
```

## 3. Identity

```mermaid
erDiagram
  PROFILES ||--o{ STUDENT_IDENTITIES : "owns"
  PROFILES ||--o{ CLASS_MEMBERSHIPS : "via-identity"
  STUDENT_IDENTITIES ||--o{ CLASS_MEMBERSHIPS : "joins"
```

## 4. Class & membership

```mermaid
erDiagram
  CLASSES ||--o{ CLASS_MEMBERSHIPS : "has"
  STUDENT_IDENTITIES ||--o{ CLASS_MEMBERSHIPS : "holds"
  CLASSES ||--o{ CLASS_ADMIN_ASSIGNMENTS : "administered-by"
```

## 5. Course catalog → offering → enrollment

```mermaid
erDiagram
  COURSES ||--o{ COURSE_OFFERINGS : "catalogued-in"
  CLASSES ||--o{ COURSE_OFFERINGS : "hosts"
  ACADEMIC_PERIODS ||--o{ COURSE_OFFERINGS : "runs-in"
  COURSE_OFFERINGS ||--o{ ENROLLMENTS : "has"
  STUDENT_IDENTITIES ||--o{ ENROLLMENTS : "holds"
```

## 6. Course invitation

```mermaid
erDiagram
  COURSE_OFFERINGS ||--o{ COURSE_INVITE_TOKENS : "inviteable-via"
  COURSE_INVITE_TOKENS ||--o{ COURSE_INVITE_ACCEPTANCES : "redeemed-as"
  ENROLLMENTS ||--o| COURSE_INVITE_ACCEPTANCES : "created-by"
```

## 7. Class Admin RBAC

```mermaid
erDiagram
  CLASS_ADMIN_ASSIGNMENTS ||--o{ CLASS_ADMIN_PERMISSIONS : "grants"
  CLASSES ||--o{ CLASS_ADMIN_ASSIGNMENTS : "scoped-to"
```

## 8. Assignments & materials

```mermaid
erDiagram
  COURSES ||--o{ ASSIGNMENTS : "catalogue-briefs"
  COURSE_OFFERINGS ||--o{ ASSIGNMENTS : "course-assignments"
  ASSIGNMENTS ||--o{ ASSIGNMENT_ATTACHMENTS : "attaches"
  COURSE_OFFERINGS ||--o{ COURSE_MATERIALS : "supplies"
  ASSIGNMENTS ||--o{ SAVED_ASSIGNMENTS : "saved-as"
```

## 9. Attendance

```mermaid
erDiagram
  COURSE_OFFERINGS ||--o{ ATTENDANCE_MEETINGS : "meets"
  ATTENDANCE_MEETINGS ||--o{ ATTENDANCE_RECORDS : "records"
  ATTENDANCE_RECORDS ||--o{ ATTENDANCE_CORRECTIONS : "corrected-by"
  ATTENDANCE_MEETINGS ||--o{ ATTENDANCE_VERIFICATION_ATTEMPTS : "verified-audited"
```

## 10. Grading

```mermaid
erDiagram
  COURSE_OFFERINGS ||--o{ GRADE_BATCHES : "graded-in"
  GRADE_BATCHES ||--o{ GRADE_ENTRIES : "contains"
  GRADE_ENTRIES ||--o{ GRADE_HISTORY : "changed-as"
```

## 11. Schedule

```mermaid
erDiagram
  COURSE_OFFERINGS ||--o{ SCHEDULE_RULES : "defines"
  SCHEDULE_RULES ||--o{ SCHEDULE_INSTANCES : "generates"
  SCHEDULE_INSTANCES ||--o{ SCHEDULE_EXCEPTIONS : "overridden-by"
```

## 12. Leave (existing, kept)

```mermaid
erDiagram
  PROFILES ||--o{ LEAVE_REQUESTS : "requests"
  CLASSES ||--o{ LEAVE_REQUESTS : "context"
  LEAVE_REQUESTS ||--o{ LEAVE_REQUEST_EVIDENCE : "evidenced-by"
  LEAVE_REQUESTS ||--o{ LEAVE_REQUEST_HISTORY : "tracked-in"
  LEAVE_REQUESTS ||--o{ LEAVE_LECTURER_OUTCOMES : "decided-in"
```

## 13. Sessions & calendar (existing)

```mermaid
erDiagram
  CLASSES ||--o{ DISCUSSION_SESSIONS : "hosts"
  DISCUSSION_SESSIONS ||--o{ DISCUSSION_SESSION_RSVPS : "rsvpd"
  DISCUSSION_SESSIONS ||--o{ DISCUSSION_SESSION_REMINDERS : "reminds"
  CLASSES ||--o{ CLASS_CALENDAR_EVENTS : "schedules"
  PROFILES ||--o{ PERSONAL_CALENDAR_EVENTS : "owns"
```

## 14. Announcements & discussions

```mermaid
erDiagram
  CLASSES ||--o{ ANNOUNCEMENTS : "announced-in"
  COURSE_OFFERINGS ||--o{ ANNOUNCEMENTS : "offering-scoped"
  CLASSES ||--o{ DISCUSSION_SESSIONS : "discussed-in"
```

## 15. Notifications

```mermaid
erDiagram
  NOTIFICATION_EVENTS ||--o{ NOTIFICATION_DELIVERIES : "delivered-as"
  PROFILES ||--o{ NOTIFICATION_PREFERENCES : "prefers"
  PROFILES ||--o{ PUSH_SUBSCRIPTIONS : "receives"
```

## 16. Audit & monitoring

```mermaid
erDiagram
  AUDIT_LOGS }o--|| ACTORS : "records"
  AUDIT_LOGS }o--|| TARGETS : "targets"
  DEVELOPER_INCIDENTS ||--o{ DEVELOPER_INCIDENT_NOTES : "noted-in"
  GOOGLE_CALENDAR_CONNECTIONS ||--o{ GOOGLE_CALENDAR_EVENT_MAPPINGS : "maps"
```

```mermaid
flowchart TB
  subgraph Catalog[Catalog]
    COURSES[courses]
  end
  subgraph ClassRoot[Class workspace]
    CLASSES[classes]
    MEMBERS[class_memberships]
    OFFERINGS[course_offerings]
    ENROLL[enrollments]
  end
  subgraph Ops[Operations]
    MEET[attendance_meetings]
    GRADES[grade_batches]
    SCHED[schedule_rules]
    ANNOUN[announcements]
  end
  COURSES --> OFFERINGS --> ENROLL
  CLASSES --> OFFERINGS
  OFFERINGS --> MEET
  OFFERINGS --> GRADES
  OFFERINGS --> SCHED
  OFFERINGS --> ANNOUN
```
