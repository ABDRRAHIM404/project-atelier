-- Service operations, custom design requests, customer profiles, history and activity log
select pg_advisory_xact_lock(hashtextextended('project-atelier:service-operations-v1', 0));

alter table iam.customers
  add column if not exists full_name text,
  add column if not exists phone_number text,
  add column if not exists city text,
  add column if not exists address text;

alter table iam.customers
  drop constraint if exists customers_full_name_check,
  add constraint customers_full_name_check check (full_name is null or length(trim(full_name)) between 2 and 120),
  drop constraint if exists customers_phone_number_check,
  add constraint customers_phone_number_check check (phone_number is null or length(trim(phone_number)) between 6 and 40),
  drop constraint if exists customers_city_check,
  add constraint customers_city_check check (city is null or length(trim(city)) between 2 and 120),
  drop constraint if exists customers_address_check,
  add constraint customers_address_check check (address is null or length(address) <= 500);

alter table projects.submitted_requests
  alter column source_project_id drop not null,
  add column if not exists request_type text not null default 'CATALOG_PRODUCT',
  add column if not exists display_reference text,
  add column if not exists custom_design_details jsonb not null default '{}'::jsonb,
  add column if not exists custom_design_files jsonb not null default '[]'::jsonb,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by text,
  add column if not exists cancellation_reason text,
  add column if not exists archived_at timestamptz;

update projects.submitted_requests
set display_reference = 'REQ-' || to_char(submitted_at, 'YYYY') || '-' || upper(substr(replace(id::text, '-', ''), 1, 6))
where display_reference is null;

alter table projects.submitted_requests
  alter column display_reference set default ('REQ-' || to_char(clock_timestamp(), 'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))),
  alter column display_reference set not null,
  drop constraint if exists submitted_requests_display_reference_unique,
  add constraint submitted_requests_display_reference_unique unique (display_reference),
  drop constraint if exists submitted_requests_request_type_check,
  add constraint submitted_requests_request_type_check check (request_type in ('CATALOG_PRODUCT', 'CUSTOM_DESIGN')),
  drop constraint if exists submitted_requests_custom_design_details_check,
  add constraint submitted_requests_custom_design_details_check check (jsonb_typeof(custom_design_details) = 'object'),
  drop constraint if exists submitted_requests_custom_design_files_check,
  add constraint submitted_requests_custom_design_files_check check (jsonb_typeof(custom_design_files) = 'array'),
  drop constraint if exists submitted_requests_cancelled_by_check,
  add constraint submitted_requests_cancelled_by_check check (cancelled_by is null or cancelled_by in ('CUSTOMER', 'MANAGER')),
  drop constraint if exists submitted_requests_cancellation_reason_check,
  add constraint submitted_requests_cancellation_reason_check check (cancellation_reason is null or length(trim(cancellation_reason)) between 2 and 1000),
  drop constraint if exists submitted_requests_state_check,
  add constraint submitted_requests_state_check check (state in (
    'SUBMITTED', 'UNDER_REVIEW', 'WAITING_FOR_CUSTOMER_INFORMATION',
    'READY_FOR_QUOTATION', 'QUOTED', 'CANCELLED', 'REJECTED', 'COMPLETED'
  ));

alter table projects.submitted_request_items
  alter column source_project_item_id drop not null,
  alter column product_id drop not null;

create table if not exists projects.request_activity (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references projects.submitted_requests(id) on delete restrict,
  actor_principal_id uuid references iam.principals(id) on delete restrict,
  actor_kind text not null check (actor_kind in ('CUSTOMER', 'MANAGER', 'SYSTEM')),
  event_type text not null check (length(trim(event_type)) between 2 and 80),
  from_state text,
  to_state text,
  note_ar text not null default '' check (length(note_ar) <= 2000),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  occurred_at timestamptz not null default clock_timestamp()
);
create index if not exists request_activity_request_time_idx
  on projects.request_activity(request_id, occurred_at desc);

alter table projects.request_activity enable row level security;
alter table projects.request_activity force row level security;

create policy request_activity_customer_select on projects.request_activity
for select using (
  exists (
    select 1 from projects.submitted_requests r
    where r.id = request_id and r.customer_id = iam.current_customer_id()
  )
);
create policy request_activity_manager_all on projects.request_activity
for all
using (iam.current_actor_kind() = 'manager' and iam.current_auth_assurance() = 'manager_mfa')
with check (iam.current_actor_kind() = 'manager' and iam.current_auth_assurance() = 'manager_mfa');

grant select, insert on projects.request_activity to authenticated;
grant all on projects.request_activity to service_role;

alter table orders.orders
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by text,
  add column if not exists cancellation_reason text,
  add column if not exists archived_at timestamptz;

alter table orders.orders
  drop constraint if exists orders_cancelled_by_check,
  add constraint orders_cancelled_by_check check (cancelled_by is null or cancelled_by in ('CUSTOMER', 'MANAGER')),
  drop constraint if exists orders_cancellation_reason_check,
  add constraint orders_cancellation_reason_check check (cancellation_reason is null or length(trim(cancellation_reason)) between 2 and 1000);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'custom-designs',
  'custom-designs',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function orders.guard_order_transition()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.lifecycle_state = old.lifecycle_state then return new; end if;
  if not (
    (new.lifecycle_state = 'CANCELLED' and old.lifecycle_state not in ('COMPLETED', 'CANCELLED'))
    or (old.lifecycle_state = 'AWAITING_PAYMENT' and new.lifecycle_state = 'PAYMENT_UNDER_REVIEW')
    or (old.lifecycle_state = 'PAYMENT_UNDER_REVIEW' and new.lifecycle_state in ('AWAITING_PAYMENT', 'PAYMENT_VERIFIED'))
    or (old.lifecycle_state = 'PAYMENT_VERIFIED' and new.lifecycle_state = 'IN_PRODUCTION')
    or (old.lifecycle_state = 'IN_PRODUCTION' and new.lifecycle_state = 'READY_FOR_FULFILMENT')
    or (old.lifecycle_state = 'READY_FOR_FULFILMENT' and new.lifecycle_state = 'COMPLETED')
  ) then
    raise exception using errcode = '23514', message = 'forbidden Order transition';
  end if;
  new.updated_at := clock_timestamp();
  new.record_version := old.record_version + 1;
  return new;
end
$$;
