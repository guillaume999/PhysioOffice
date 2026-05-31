-- Create table for sharing resources with other users
CREATE TABLE public.resource_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL,
  shared_with_user_id uuid NOT NULL,
  resource_type text NOT NULL CHECK (resource_type IN ('patient', 'planning')),
  resource_id uuid, -- NULL for planning (shares all planning), UUID for specific patient
  permission text NOT NULL DEFAULT 'read' CHECK (permission IN ('read', 'write')),
  expires_at timestamp with time zone, -- NULL means no expiration
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  
  -- Ensure unique share per resource/user combination
  UNIQUE(owner_user_id, shared_with_user_id, resource_type, resource_id)
);

-- Enable RLS
ALTER TABLE public.resource_shares ENABLE ROW LEVEL SECURITY;

-- Owner can manage their shares
CREATE POLICY "Owners can view own shares"
ON public.resource_shares
FOR SELECT
USING (auth.uid() = owner_user_id);

CREATE POLICY "Owners can create shares"
ON public.resource_shares
FOR INSERT
WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Owners can update own shares"
ON public.resource_shares
FOR UPDATE
USING (auth.uid() = owner_user_id);

CREATE POLICY "Owners can delete own shares"
ON public.resource_shares
FOR DELETE
USING (auth.uid() = owner_user_id);

-- Shared users can view shares they have access to
CREATE POLICY "Shared users can view their shares"
ON public.resource_shares
FOR SELECT
USING (auth.uid() = shared_with_user_id AND (expires_at IS NULL OR expires_at > now()));

-- Function to check if a user has access to a shared resource
CREATE OR REPLACE FUNCTION public.has_shared_access(
  _user_id uuid,
  _owner_id uuid,
  _resource_type text,
  _resource_id uuid DEFAULT NULL,
  _required_permission text DEFAULT 'read'
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.resource_shares
    WHERE shared_with_user_id = _user_id
      AND owner_user_id = _owner_id
      AND resource_type = _resource_type
      AND (resource_id IS NULL OR resource_id = _resource_id OR _resource_id IS NULL)
      AND (expires_at IS NULL OR expires_at > now())
      AND (
        _required_permission = 'read' 
        OR permission = 'write'
      )
  )
$$;

-- Add RLS policies for patients table to allow shared access
CREATE POLICY "Users can view shared patients"
ON public.patients
FOR SELECT
USING (
  public.has_shared_access(auth.uid(), user_id, 'patient', id, 'read')
);

CREATE POLICY "Users can update shared patients with write permission"
ON public.patients
FOR UPDATE
USING (
  public.has_shared_access(auth.uid(), user_id, 'patient', id, 'write')
);

-- Add RLS policies for appointments table to allow shared access
CREATE POLICY "Users can view shared planning"
ON public.appointments
FOR SELECT
USING (
  public.has_shared_access(auth.uid(), user_id, 'planning', NULL, 'read')
);

CREATE POLICY "Users can insert to shared planning with write permission"
ON public.appointments
FOR INSERT
WITH CHECK (
  public.has_shared_access(auth.uid(), user_id, 'planning', NULL, 'write')
);

CREATE POLICY "Users can update shared planning with write permission"
ON public.appointments
FOR UPDATE
USING (
  public.has_shared_access(auth.uid(), user_id, 'planning', NULL, 'write')
);

CREATE POLICY "Users can delete from shared planning with write permission"
ON public.appointments
FOR DELETE
USING (
  public.has_shared_access(auth.uid(), user_id, 'planning', NULL, 'write')
);

-- Add trigger for updated_at
CREATE TRIGGER update_resource_shares_updated_at
BEFORE UPDATE ON public.resource_shares
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();