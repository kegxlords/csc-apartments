-- Keep privileged SECURITY DEFINER RPCs behind the server-side service role.
-- The API authenticates callers before invoking these RPCs with the service key.
BEGIN;

REVOKE ALL ON FUNCTION public.do_checkin(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.do_checkin(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.grant_welcome_bonus(uuid, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_welcome_bonus(uuid, numeric, text) TO service_role;

REVOKE ALL ON FUNCTION public.lease_unit(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lease_unit(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.request_withdrawal(uuid, numeric, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_withdrawal(uuid, numeric, uuid) TO service_role;

-- This function is invoked only by the auth.users trigger; it is not an RPC.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated, service_role;

-- RLS policies call this for authenticated users; anon does not need it.
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

COMMIT;
