-- Realtime is opt-in in NSDB and in the database fixture. Publishing this
-- single RLS-protected table keeps the integration test focused and explicit.
alter publication supabase_realtime add table public.component_records;
