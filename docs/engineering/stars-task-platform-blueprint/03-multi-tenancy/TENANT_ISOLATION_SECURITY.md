# Tenant Isolation Security

Design + security tests per risk:

| Risk | Protection | Test |
|---|---|---|
| Cross-tenant data leakage | tenant-aware RLS + `university_id` scoping on every query | integration test: user A queries tenant B resources → 0 rows |
| IDOR | object existence + membership check in one policy/RPC | test: crafted ID from another tenant → 404/deny |
| Tenant-context spoofing | server-resolved context, signed claims bound to session | test: forged param/cookie → ignore/deny |
| Unauthorized university switching | membership proof + redirect | test: switch without membership → denied |
| Cache leakage | tenant-keyed cache namespacing | test: tenant A URL with tenant B header → miss/deny |
| Storage path manipulation | tenant-namespaced keys + server-issued signed URLs | test: crafted path → 403 |
| Insecure background jobs | jobs re-verify tenant membership; jobs carry tenant id | test: job for tenant B cannot read A |
| Privilege escalation | per-class/per-university roles; no global role | test: class admin of class X edits class Y → denied |
| Incorrect global admin | platform admin scope requires university scope | test: global claim without university scope → denied |

Related: README.md · TENANT_DATA_MODEL.md
