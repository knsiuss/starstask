# Phase 5G — Decision Register

- D-01 audit extension: audit_logs +university_id/before_state/after_state (object CHECKs), actor+timestamp preserved.
- D-02 indexes: only justified (audit university/entity, enrollments offering-status, meetings offering-time, announcements class-time, memberships class-active) — each tied to a read path; no speculative GIN/trgm.
- D-03 no legacy SECURITY DEFINER rewrite (would be behavior-changing); new code hardened, legacy flagged for separate review.
