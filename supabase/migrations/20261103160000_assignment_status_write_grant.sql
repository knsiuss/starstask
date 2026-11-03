-- `POST /api/assignments` failed with 42501 for every public submission:
-- 20261029000300_rls.sql granted INSERT column-by-column and left `status` out,
-- so the flow's `status = 'pending'` was rejected by the privilege check before
-- RLS was even consulted. The grant list is what made self-publishing
-- impossible, so the same rule is restored below as a policy and a transition
-- guard instead of a missing privilege.
GRANT insert (status) ON public.assignments TO authenticated;


GRANT
UPDATE (status, rejection_reason, reviewed_by, reviewed_at) ON public.assignments TO authenticated;


-- A member's own insert is a request. Only a platform admin may create a row
-- that is already visible; the class queue keeps writing through the
-- `SECURITY DEFINER` `submit_class_assignment`, which runs as the table owner
-- and is not governed by these policies.
DROP POLICY IF EXISTS assignments_owner_insert ON public.assignments;


CREATE POLICY assignments_owner_insert ON public.assignments FOR insert TO authenticated
WITH
  CHECK (
    (
      SELECT
        auth.uid ()
    ) = user_id
    AND (
      class_id IS NULL
      OR public.is_class_member (class_id)
      OR public.is_class_admin (class_id)
      OR public.is_platform_admin ()
    )
    AND (
      status = 'pending'
      OR public.is_platform_admin ()
    )
  );


-- `WITH CHECK` cannot read the previous row, and every ordinary edit to an
-- approved assignment keeps `status = 'published'` in the new row, so a policy
-- cannot tell "unchanged" from "approved myself". Only a trigger can compare.
CREATE OR REPLACE FUNCTION public.prevent_assignment_status_escalation () returns trigger language plpgsql
SET
  search_path = '' AS $$
DECLARE
  v_touches_review boolean;
  v_is_resubmit boolean;
BEGIN
  -- Direct client writes only. `review_public_assignment` and the class review
  -- RPCs are `SECURITY DEFINER` and run as their `postgres` owner, and the
  -- delivery worker runs as `service_role`; both keep full control of the
  -- decision columns.
  IF current_user = 'authenticated' THEN
    v_touches_review := new.status IS DISTINCT FROM old.status
    OR new.rejection_reason IS DISTINCT FROM old.rejection_reason
    OR new.reviewed_by IS DISTINCT FROM old.reviewed_by
    OR new.reviewed_at IS DISTINCT FROM old.reviewed_at;

    -- The single self-service review write is the resubmit of a rejected
    -- public request: the stale decision is cleared on the way back to pending.
    v_is_resubmit := new.class_id IS NULL
    AND new.status = 'pending'
    AND new.rejection_reason IS NULL
    AND new.reviewed_by IS NULL
    AND new.reviewed_at IS NULL
    AND old.status IN ('pending', 'rejected');

    IF v_touches_review
    AND NOT v_is_resubmit THEN
      RAISE EXCEPTION 'only a platform admin can change an assignment decision'
      USING errcode = '42501';
    END IF;
  END IF;

  RETURN new;
END;

$$;


DROP TRIGGER IF EXISTS assignments_status_guard ON public.assignments;


CREATE TRIGGER assignments_status_guard
BEFORE UPDATE OF status,
rejection_reason,
reviewed_by,
reviewed_at ON public.assignments FOR EACH ROW
EXECUTE FUNCTION public.prevent_assignment_status_escalation ();
