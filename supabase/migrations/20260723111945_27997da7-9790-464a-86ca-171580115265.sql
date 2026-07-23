-- Add per-branch permissions controlled by the principal agency
ALTER TABLE public.agency_branches
  ADD COLUMN IF NOT EXISTS can_create_trips  boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS can_sell_counter  boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS can_scan          boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS can_view_stats    boolean NOT NULL DEFAULT true;

-- Helper: read the permissions of the branch a manager is assigned to
CREATE OR REPLACE FUNCTION public.get_branch_permissions(_user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'can_create_trips', b.can_create_trips,
    'can_sell_counter', b.can_sell_counter,
    'can_scan',         b.can_scan,
    'can_view_stats',   b.can_view_stats,
    'branch_id',        b.id,
    'agency_id',        b.agency_id,
    'name',             b.name
  )
  FROM public.branch_managers m
  JOIN public.agency_branches b ON b.id = m.branch_id
  WHERE m.user_id = _user_id AND m.status = 'active'
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.get_branch_permissions(uuid) TO authenticated;