-- Adds the major fleet category for every vehicle.
-- Existing trucks default to OWNED_FLEET; new records can use OWNED_FLEET or ATTACHED_FLEET.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'FleetCategory') then
    create type "FleetCategory" as enum ('OWNED_FLEET', 'ATTACHED_FLEET');
  end if;
end $$;

alter table if exists "Truck"
  add column if not exists "fleetCategory" "FleetCategory" not null default 'OWNED_FLEET';

create index if not exists "Truck_fleetCategory_idx" on "Truck"("fleetCategory");
