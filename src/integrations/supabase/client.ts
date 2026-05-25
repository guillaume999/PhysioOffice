// ============================================================================
// MIGRATION: Supabase → PocketBase
// ----------------------------------------------------------------------------
// This file used to instantiate the Supabase JS client. The project has been
// migrated to PocketBase (self-hosted). To avoid rewriting ~46 files at once,
// we re-export a compatibility shim that mimics the Supabase API but talks to
// PocketBase under the hood.
//
// Direct PocketBase access (recommended for new code):
//   import { pb } from "@/integrations/pocketbase/client";
// ============================================================================
export { supabase } from "@/integrations/pocketbase/compat";