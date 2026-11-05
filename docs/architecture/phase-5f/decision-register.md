# Phase 5F — Decision Register

- D-01 announcements: NEW formal table (class-scoped, optional offering, author, published/archived, pinned) + announcement_reads (read tracking justified for formal announcements).
- D-02 discussions: ISOLATED proposal table discussion_threads (scope class|offering CHECK) — no RLS write, no app/RPC wiring; decision-gated on scope confirmation.
- D-03 social feed: decision-gated, NO table (ADR-016).
- D-04 notifications: reuse outbox; add nullable university_id to events/deliveries only.
