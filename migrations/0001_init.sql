-- Migration number: 0001 	 initial empty schema
-- Feature tables arrive in later migrations. Migrations are forward-only (ADR-0003):
-- undo a change with a new migration, never by editing an applied one.
SELECT 1;
