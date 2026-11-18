-- audit_log.id is BIGSERIAL, so admin_impersonate must return bigint (not uuid).
-- The API ignores this return value; the corrected type prevents the audit insert from failing.
BEGIN;

DROP FUNCTION IF EXISTS public.admin_impersonate(uuid, uuid);

CREATE FUNCTION public.admin_impersonate(p_admin uuid, p_user uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_id bigint;
BEGIN
  INSERT INTO public.audit_log (actor, action, target, meta)
  VALUES (p_admin, 'impersonate', p_user, jsonb_build_object('at', now()))
  RETURNING id INTO v_id;
  RETURN v_id;
END
$function$;

REVOKE ALL ON FUNCTION public.admin_impersonate(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_impersonate(uuid, uuid) TO service_role;

COMMIT;
