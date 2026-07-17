-- Project Atelier P1 trusted data foundation
-- Owners: Data Platform, Access and Identity, Business Configuration,
--         Audit and Operations
-- Risk class: D (authorization/RLS/immutability) with additive class A tables
-- Transaction-safe: yes; the migration runner applies this file atomically
-- Expected lock: new objects only; no populated relation is rewritten
-- Recovery: discard an uncommitted transaction; after commit, forward-fix only

select pg_advisory_xact_lock(hashtextextended('project-atelier:global-database-roles', 0));

create schema if not exists iam;
create schema if not exists config;
create schema if not exists audit;
create schema if not exists ops;

revoke all on schema iam, config, audit, ops from public;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'atelier_runtime') then
    create role atelier_runtime
      nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
  end if;

  if not exists (select 1 from pg_roles where rolname = 'atelier_job') then
    create role atelier_job
      nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
  end if;

  if not exists (select 1 from pg_roles where rolname = 'atelier_operations_readonly') then
    create role atelier_operations_readonly
      nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
  end if;

  if not exists (select 1 from pg_roles where rolname = 'atelier_identity_resolver') then
    create role atelier_identity_resolver
      nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
  end if;
end
$roles$;

create function iam.current_actor_kind()
returns text
language sql
stable
set search_path = pg_catalog
as $$
  select nullif(current_setting('atelier.actor_kind', true), '')
$$;

create function iam.current_principal_id()
returns uuid
language sql
stable
set search_path = pg_catalog
as $$
  select nullif(current_setting('atelier.principal_id', true), '')::uuid
$$;

create function iam.current_customer_id()
returns uuid
language sql
stable
set search_path = pg_catalog
as $$
  select nullif(current_setting('atelier.customer_id', true), '')::uuid
$$;

create function iam.current_auth_assurance()
returns text
language sql
stable
set search_path = pg_catalog
as $$
  select nullif(current_setting('atelier.auth_assurance', true), '')
$$;

revoke all on function iam.current_actor_kind() from public;
revoke all on function iam.current_principal_id() from public;
revoke all on function iam.current_customer_id() from public;
revoke all on function iam.current_auth_assurance() from public;

create table iam.principals (
  id uuid primary key default gen_random_uuid(),
  actor_type text not null check (actor_type in ('CUSTOMER', 'MANAGER')),
  access_status text not null default 'ACTIVE'
    check (access_status in ('ACTIVE', 'DISABLED')),
  disabled_at timestamptz,
  disabled_reason_code text,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  record_version integer not null default 1 check (record_version >= 1),
  constraint principals_disabled_state_check check (
    (access_status = 'ACTIVE' and disabled_at is null and disabled_reason_code is null)
    or
    (access_status = 'DISABLED' and disabled_at is not null and disabled_reason_code is not null)
  )
);

create table iam.external_identities (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider ~ '^[a-z][a-z0-9_]{1,31}$'),
  provider_subject text not null check (length(provider_subject) between 1 and 255),
  principal_id uuid not null references iam.principals(id) on delete restrict,
  link_status text not null default 'ACTIVE'
    check (link_status in ('ACTIVE', 'UNLINKED')),
  is_primary boolean not null default true,
  verified_email_snapshot text,
  linked_at timestamptz not null default clock_timestamp(),
  unlinked_at timestamptz,
  changed_by_principal_id uuid references iam.principals(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  record_version integer not null default 1 check (record_version >= 1),
  constraint external_identities_provider_subject_unique unique (provider, provider_subject),
  constraint external_identities_link_state_check check (
    (link_status = 'ACTIVE' and unlinked_at is null)
    or
    (link_status = 'UNLINKED' and unlinked_at is not null)
  )
);

create unique index external_identities_one_active_primary_per_principal
  on iam.external_identities(principal_id)
  where link_status = 'ACTIVE' and is_primary;

create index external_identities_principal_idx
  on iam.external_identities(principal_id);

create table iam.customers (
  id uuid primary key default gen_random_uuid(),
  principal_id uuid not null unique references iam.principals(id) on delete restrict,
  verified_email_snapshot text,
  contact_email text,
  preferred_locale text not null default 'ar' check (preferred_locale in ('ar', 'en')),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  record_version integer not null default 1 check (record_version >= 1)
);

create table iam.managers (
  id uuid primary key default gen_random_uuid(),
  principal_id uuid not null unique references iam.principals(id) on delete restrict,
  singleton_key boolean not null default true check (singleton_key),
  is_active boolean not null default true,
  activated_at timestamptz not null default clock_timestamp(),
  deactivated_at timestamptz,
  bootstrap_reason_code text not null,
  changed_by_principal_id uuid references iam.principals(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  record_version integer not null default 1 check (record_version >= 1),
  constraint managers_active_state_check check (
    (is_active and deactivated_at is null)
    or
    (not is_active and deactivated_at is not null)
  )
);

create unique index managers_one_active_version_one
  on iam.managers(singleton_key)
  where is_active;

create index managers_changed_by_principal_idx
  on iam.managers(changed_by_principal_id)
  where changed_by_principal_id is not null;

create function iam.assert_profile_actor_type()
returns trigger
language plpgsql
set search_path = pg_catalog, iam
as $$
declare
  expected_actor text;
  actual_actor text;
begin
  expected_actor := case tg_table_name when 'customers' then 'CUSTOMER' else 'MANAGER' end;
  select actor_type into actual_actor from iam.principals where id = new.principal_id;
  if actual_actor is distinct from expected_actor then
    raise exception using errcode = '23514', message = 'profile actor type does not match principal';
  end if;
  return new;
end
$$;

create trigger customers_actor_type_guard
before insert or update of principal_id on iam.customers
for each row execute function iam.assert_profile_actor_type();

create trigger managers_actor_type_guard
before insert or update of principal_id on iam.managers
for each row execute function iam.assert_profile_actor_type();

create table config.business_profile (
  singleton_key boolean primary key default true check (singleton_key),
  legal_name text,
  operating_country_code text not null default 'SA' check (operating_country_code ~ '^[A-Z]{2}$'),
  default_currency_code text not null default 'SAR' check (default_currency_code ~ '^[A-Z]{3}$'),
  default_locale text not null default 'ar' check (default_locale = 'ar'),
  time_zone text,
  created_by_principal_id uuid references iam.principals(id) on delete restrict,
  updated_by_principal_id uuid references iam.principals(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  record_version integer not null default 1 check (record_version >= 1)
);

create table config.fulfilment_locations (
  id uuid primary key default gen_random_uuid(),
  location_kind text not null
    check (location_kind in ('HOME_WORKSHOP', 'SHOWROOM', 'PICKUP_POINT')),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'ACTIVE', 'RETIRED')),
  localized_name_resource_id uuid,
  address_schema_version integer not null default 1 check (address_schema_version >= 1),
  address_line_one text,
  address_line_two text,
  locality text,
  region text,
  postal_code text,
  country_code text not null default 'SA' check (country_code ~ '^[A-Z]{2}$'),
  public_phone text,
  public_email text,
  created_by_principal_id uuid not null references iam.principals(id) on delete restrict,
  updated_by_principal_id uuid not null references iam.principals(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  record_version integer not null default 1 check (record_version >= 1)
);

create index fulfilment_locations_created_by_idx
  on config.fulfilment_locations(created_by_principal_id);

create table config.configuration_definitions (
  code text primary key check (code ~ '^CFG-00[1-8]$'),
  owner_module text not null,
  value_kind text not null check (value_kind in ('JSON_OBJECT')),
  value_schema_version integer not null check (value_schema_version >= 1),
  scope text not null check (scope in ('BUSINESS_SINGLETON')),
  sensitivity text not null check (sensitivity in ('INTERNAL', 'SECURITY_SENSITIVE')),
  approval_actor text not null check (approval_actor in ('MANAGER', 'OPERATOR')),
  created_at timestamptz not null default clock_timestamp()
);

create table config.configuration_revisions (
  id uuid primary key default gen_random_uuid(),
  definition_code text not null references config.configuration_definitions(code) on delete restrict,
  revision_number integer not null check (revision_number >= 1),
  value_json jsonb not null check (jsonb_typeof(value_json) = 'object'),
  value_schema_version integer not null check (value_schema_version >= 1),
  lifecycle text not null default 'DRAFT'
    check (lifecycle in ('DRAFT', 'ACTIVE', 'RETIRED')),
  effective_from timestamptz,
  effective_until timestamptz,
  authored_by_actor_kind text not null check (authored_by_actor_kind in ('manager', 'operator')),
  authored_by_principal_id uuid references iam.principals(id) on delete restrict,
  approved_by_actor_kind text check (approved_by_actor_kind in ('manager', 'operator')),
  approved_by_principal_id uuid references iam.principals(id) on delete restrict,
  activation_reason_code text,
  retired_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  record_version integer not null default 1 check (record_version >= 1),
  constraint configuration_revisions_sequence_unique unique (definition_code, revision_number),
  constraint configuration_revisions_lifecycle_consistency check (
    (lifecycle = 'DRAFT' and approved_by_actor_kind is null and approved_by_principal_id is null and effective_from is null and retired_at is null)
    or
    (lifecycle = 'ACTIVE' and approved_by_actor_kind is not null and effective_from is not null and retired_at is null)
    or
    (lifecycle = 'RETIRED' and approved_by_actor_kind is not null and effective_from is not null and retired_at is not null)
  ),
  constraint configuration_revisions_actor_attribution_check check (
    (authored_by_actor_kind = 'manager' and authored_by_principal_id is not null)
    or
    (authored_by_actor_kind = 'operator' and authored_by_principal_id is null)
  ),
  constraint configuration_revisions_approval_attribution_check check (
    (approved_by_actor_kind is null and approved_by_principal_id is null)
    or
    (approved_by_actor_kind = 'manager' and approved_by_principal_id is not null)
    or
    (approved_by_actor_kind = 'operator' and approved_by_principal_id is null)
  ),
  constraint configuration_revisions_effective_interval_check check (
    effective_until is null or effective_from is null or effective_until > effective_from
  )
);

create unique index configuration_revisions_one_active
  on config.configuration_revisions(definition_code)
  where lifecycle = 'ACTIVE';

create index configuration_revisions_authored_by_idx
  on config.configuration_revisions(authored_by_principal_id);

create index configuration_revisions_approved_by_idx
  on config.configuration_revisions(approved_by_principal_id)
  where approved_by_principal_id is not null;

create function config.protect_configuration_revision()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if old.lifecycle = 'RETIRED' then
    raise exception using errcode = '55000', message = 'retired configuration revisions are immutable';
  end if;

  if old.lifecycle = 'ACTIVE' and not (
    new.lifecycle = 'RETIRED'
    and new.definition_code = old.definition_code
    and new.revision_number = old.revision_number
    and new.value_json = old.value_json
    and new.value_schema_version = old.value_schema_version
    and new.authored_by_actor_kind = old.authored_by_actor_kind
    and new.authored_by_principal_id = old.authored_by_principal_id
    and new.approved_by_actor_kind = old.approved_by_actor_kind
    and new.approved_by_principal_id = old.approved_by_principal_id
    and new.effective_from = old.effective_from
    and new.created_at = old.created_at
  ) then
    raise exception using errcode = '55000', message = 'active configuration value is immutable';
  end if;

  return new;
end
$$;

create trigger configuration_revisions_immutability_guard
before update on config.configuration_revisions
for each row execute function config.protect_configuration_revision();

create function config.reject_configuration_revision_delete()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception using errcode = '55000', message = 'configuration revision history cannot be deleted';
end
$$;

create trigger configuration_revisions_delete_guard
before delete on config.configuration_revisions
for each row execute function config.reject_configuration_revision_delete();

insert into config.configuration_definitions
  (code, owner_module, value_kind, value_schema_version, scope, sensitivity, approval_actor)
values
  ('CFG-001', 'quotations-and-acceptance', 'JSON_OBJECT', 1, 'BUSINESS_SINGLETON', 'INTERNAL', 'MANAGER'),
  ('CFG-002', 'business-configuration', 'JSON_OBJECT', 1, 'BUSINESS_SINGLETON', 'INTERNAL', 'MANAGER'),
  ('CFG-003', 'files-and-media', 'JSON_OBJECT', 1, 'BUSINESS_SINGLETON', 'SECURITY_SENSITIVE', 'OPERATOR'),
  ('CFG-004', 'production', 'JSON_OBJECT', 1, 'BUSINESS_SINGLETON', 'INTERNAL', 'MANAGER'),
  ('CFG-005', 'fulfilment', 'JSON_OBJECT', 1, 'BUSINESS_SINGLETON', 'INTERNAL', 'MANAGER'),
  ('CFG-006', 'access-and-identity', 'JSON_OBJECT', 1, 'BUSINESS_SINGLETON', 'SECURITY_SENSITIVE', 'OPERATOR'),
  ('CFG-007', 'notifications', 'JSON_OBJECT', 1, 'BUSINESS_SINGLETON', 'INTERNAL', 'MANAGER'),
  ('CFG-008', 'cms-and-localization', 'JSON_OBJECT', 1, 'BUSINESS_SINGLETON', 'INTERNAL', 'MANAGER');

create function audit.metadata_is_safe(candidate jsonb)
returns boolean
language plpgsql
immutable
strict
set search_path = pg_catalog
as $$
declare
  item jsonb;
  item_key text;
  allowed_keys constant text[] := array[
    'attempt', 'changed_fields', 'config_code', 'provider', 'reason_code',
    'result_code', 'schema', 'state_from', 'state_to'
  ];
begin
  if jsonb_typeof(candidate) <> 'object' or octet_length(candidate::text) > 4096 then
    return false;
  end if;

  for item_key, item in select key, value from jsonb_each(candidate)
  loop
    if not (item_key = any(allowed_keys)) then
      return false;
    end if;
    if jsonb_typeof(item) in ('object', 'array') and octet_length(item::text) > 2048 then
      return false;
    end if;
  end loop;
  return true;
end
$$;

create table audit.events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type ~ '^[A-Z][A-Z0-9_]{2,95}$'),
  occurred_at timestamptz not null default clock_timestamp(),
  actor_kind text not null
    check (actor_kind in ('customer', 'manager', 'system_job', 'provider_webhook', 'operator')),
  actor_principal_id uuid references iam.principals(id) on delete restrict,
  target_type text not null check (target_type ~ '^[A-Za-z][A-Za-z0-9_]{1,63}$'),
  target_id uuid,
  operation text not null check (operation ~ '^[A-Z][A-Z0-9_]{2,95}$'),
  outcome text not null check (outcome in ('SUCCEEDED', 'DENIED', 'FAILED')),
  state_before text,
  state_after text,
  safe_reason_code text,
  request_id uuid,
  correlation_id uuid not null,
  metadata_json jsonb not null default '{}'::jsonb,
  metadata_schema_version integer not null default 1 check (metadata_schema_version >= 1),
  created_at timestamptz not null default clock_timestamp(),
  constraint audit_event_actor_check check (
    (actor_kind in ('customer', 'manager') and actor_principal_id is not null)
    or
    (actor_kind in ('system_job', 'provider_webhook', 'operator') and actor_principal_id is null)
  ),
  constraint audit_event_metadata_safe check (audit.metadata_is_safe(metadata_json))
);

create index audit_events_target_time_idx
  on audit.events(target_type, target_id, occurred_at desc);

create index audit_events_actor_time_idx
  on audit.events(actor_principal_id, occurred_at desc)
  where actor_principal_id is not null;

create index audit_events_correlation_idx
  on audit.events(correlation_id);

create function audit.reject_event_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception using errcode = '55000', message = 'audit events are append-only';
end
$$;

create trigger audit_events_update_guard
before update or delete on audit.events
for each row execute function audit.reject_event_mutation();

create function iam.resolve_external_identity(
  requested_provider text,
  requested_provider_subject text
)
returns table (
  principal_id uuid,
  actor_type text,
  access_status text,
  customer_id uuid,
  manager_id uuid,
  manager_active boolean
)
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select
    principal.id,
    principal.actor_type,
    principal.access_status,
    customer.id,
    manager.id,
    coalesce(manager.is_active, false)
  from iam.external_identities as external_identity
  join iam.principals as principal on principal.id = external_identity.principal_id
  left join iam.customers as customer on customer.principal_id = principal.id
  left join iam.managers as manager on manager.principal_id = principal.id
  where external_identity.provider = requested_provider
    and external_identity.provider_subject = requested_provider_subject
    and external_identity.link_status = 'ACTIVE'
    and external_identity.is_primary
  limit 1
$$;

create function iam.provision_customer_external_identity(
  requested_provider text,
  requested_provider_subject text,
  verified_email text,
  requested_correlation_id uuid
)
returns table (
  principal_id uuid,
  actor_type text,
  access_status text,
  customer_id uuid,
  manager_id uuid,
  manager_active boolean
)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  new_principal_id uuid;
  new_customer_id uuid;
begin
  if requested_provider !~ '^[a-z][a-z0-9_]{1,31}$'
    or length(requested_provider_subject) not between 1 and 255
    or verified_email is null
    or length(verified_email) not between 3 and 320
    or requested_correlation_id is null then
    raise exception using errcode = '22023', message = 'invalid verified identity provisioning input';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(requested_provider || ':' || requested_provider_subject, 0)
  );

  if exists (
    select 1
    from iam.external_identities
    where provider = requested_provider
      and provider_subject = requested_provider_subject
      and link_status = 'ACTIVE'
      and is_primary
  ) then
    return query
      select * from iam.resolve_external_identity(requested_provider, requested_provider_subject);
    return;
  end if;

  new_principal_id := gen_random_uuid();
  new_customer_id := gen_random_uuid();

  insert into iam.principals (id, actor_type)
  values (new_principal_id, 'CUSTOMER');

  insert into iam.customers
    (id, principal_id, verified_email_snapshot, contact_email, preferred_locale)
  values
    (new_customer_id, new_principal_id, verified_email, verified_email, 'ar');

  insert into iam.external_identities
    (provider, provider_subject, principal_id, verified_email_snapshot)
  values
    (requested_provider, requested_provider_subject, new_principal_id, verified_email);

  insert into audit.events
    (event_type, actor_kind, actor_principal_id, target_type, target_id, operation,
     outcome, correlation_id, metadata_json)
  values
    ('IDENTITY_PROVISIONED', 'customer', new_principal_id, 'Customer', new_customer_id,
     'PROVISION_CUSTOMER_IDENTITY', 'SUCCEEDED', requested_correlation_id,
     jsonb_build_object('provider', requested_provider));

  return query
    select * from iam.resolve_external_identity(requested_provider, requested_provider_subject);
end
$$;

create function iam.apply_customer_identity_provider_update(
  requested_provider text,
  requested_provider_subject text,
  requested_verified_email text,
  requested_action text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  mapped_principal_id uuid;
  mapped_actor_type text;
begin
  if iam.current_actor_kind() <> 'provider_webhook'
    or requested_action is null
    or requested_action not in ('SYNC_VERIFIED_EMAIL', 'DISABLE_RESTRICTED', 'DISABLE_DELETED')
    or (requested_action = 'SYNC_VERIFIED_EMAIL' and (
      requested_verified_email is null or length(requested_verified_email) not between 3 and 320
    )) then
    raise exception using errcode = '42501', message = 'provider identity update is not authorized';
  end if;

  select external_identity.principal_id, principal.actor_type
  into mapped_principal_id, mapped_actor_type
  from iam.external_identities as external_identity
  join iam.principals as principal on principal.id = external_identity.principal_id
  where external_identity.provider = requested_provider
    and external_identity.provider_subject = requested_provider_subject
    and external_identity.link_status = 'ACTIVE'
    and external_identity.is_primary
  for update of external_identity, principal;

  if mapped_principal_id is null then
    return false;
  end if;
  if mapped_actor_type <> 'CUSTOMER' then
    raise exception using errcode = '42501', message = 'provider updates cannot modify Manager identity';
  end if;

  if requested_verified_email is not null then
    update iam.external_identities
    set verified_email_snapshot = requested_verified_email,
        updated_at = clock_timestamp(),
        record_version = record_version + 1
    where provider = requested_provider
      and provider_subject = requested_provider_subject
      and principal_id = mapped_principal_id;

    update iam.customers
    set verified_email_snapshot = requested_verified_email,
        updated_at = clock_timestamp(),
        record_version = record_version + 1
    where principal_id = mapped_principal_id;
  end if;

  if requested_action in ('DISABLE_RESTRICTED', 'DISABLE_DELETED') then
    update iam.principals
    set access_status = 'DISABLED',
        disabled_at = coalesce(disabled_at, clock_timestamp()),
        disabled_reason_code = coalesce(
          disabled_reason_code,
          case requested_action
            when 'DISABLE_RESTRICTED' then 'PROVIDER_RESTRICTED'
            else 'PROVIDER_DELETED'
          end
        ),
        updated_at = clock_timestamp(),
        record_version = record_version + 1
    where id = mapped_principal_id;
  end if;

  if requested_action = 'DISABLE_DELETED' then
    update iam.external_identities
    set link_status = 'UNLINKED',
        unlinked_at = clock_timestamp(),
        is_primary = false,
        updated_at = clock_timestamp(),
        record_version = record_version + 1
    where provider = requested_provider
      and provider_subject = requested_provider_subject
      and principal_id = mapped_principal_id;
  end if;

  return true;
end
$$;

revoke all on function iam.resolve_external_identity(text, text) from public;
revoke all on function iam.provision_customer_external_identity(text, text, text, uuid) from public;
revoke all on function iam.apply_customer_identity_provider_update(text, text, text, text)
  from public;

create table ops.idempotency_records (
  id uuid primary key default gen_random_uuid(),
  scope_actor_kind text not null
    check (scope_actor_kind in ('customer', 'manager', 'system_job', 'provider_webhook', 'operator')),
  scope_principal_id uuid references iam.principals(id) on delete restrict,
  api_version text not null check (api_version ~ '^v[1-9][0-9]*$'),
  operation text not null check (length(operation) between 1 and 96),
  target_type text not null check (length(target_type) between 1 and 64),
  target_id uuid,
  idempotency_key text not null check (length(idempotency_key) between 8 and 128),
  request_digest text not null check (request_digest ~ '^[a-f0-9]{64}$'),
  status text not null default 'PROCESSING'
    check (status in ('PROCESSING', 'SUCCEEDED', 'FAILED_FINAL')),
  lease_token uuid not null default gen_random_uuid(),
  lease_expires_at timestamptz not null,
  response_status smallint check (response_status between 200 and 599),
  response_json jsonb check (response_json is null or jsonb_typeof(response_json) = 'object'),
  response_schema_version integer check (response_schema_version is null or response_schema_version >= 1),
  resource_type text,
  resource_id uuid,
  retention_eligible_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,
  constraint idempotency_scope_actor_check check (
    (scope_actor_kind in ('customer', 'manager') and scope_principal_id is not null)
    or
    (scope_actor_kind in ('system_job', 'provider_webhook', 'operator') and scope_principal_id is null)
  ),
  constraint idempotency_completion_check check (
    (status = 'PROCESSING' and completed_at is null)
    or
    (status in ('SUCCEEDED', 'FAILED_FINAL') and completed_at is not null and response_status is not null)
  ),
  constraint idempotency_response_schema_check check (
    (response_json is null and response_schema_version is null)
    or
    (response_json is not null and response_schema_version is not null)
  ),
  constraint idempotency_scope_unique unique nulls not distinct
    (scope_actor_kind, scope_principal_id, api_version, operation, target_type, target_id, idempotency_key)
);

create table ops.outbox_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type ~ '^[A-Z][A-Z0-9_]{2,95}$'),
  event_schema_version integer not null check (event_schema_version >= 1),
  aggregate_type text not null,
  aggregate_id uuid not null,
  correlation_id uuid not null,
  created_by_actor_kind text not null default iam.current_actor_kind()
    check (created_by_actor_kind in ('customer', 'manager', 'system_job', 'provider_webhook', 'operator')),
  created_by_principal_id uuid default iam.current_principal_id()
    references iam.principals(id) on delete restrict,
  dedupe_key text not null unique check (length(dedupe_key) between 1 and 180),
  payload_json jsonb not null check (jsonb_typeof(payload_json) = 'object'),
  payload_schema_version integer not null check (payload_schema_version >= 1),
  state text not null default 'PENDING'
    check (state in ('PENDING', 'LEASED', 'COMPLETED', 'DEAD')),
  available_at timestamptz not null default clock_timestamp(),
  lease_token uuid,
  lease_expires_at timestamptz,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error_code text,
  retention_eligible_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,
  constraint outbox_lease_check check (
    (state = 'LEASED' and lease_token is not null and lease_expires_at is not null)
    or
    (state <> 'LEASED' and lease_token is null and lease_expires_at is null)
  ),
  constraint outbox_completion_check check (
    (state = 'COMPLETED' and completed_at is not null)
    or
    (state <> 'COMPLETED' and completed_at is null)
  ),
  constraint outbox_actor_attribution_check check (
    (created_by_actor_kind in ('customer', 'manager') and created_by_principal_id is not null)
    or
    (created_by_actor_kind in ('system_job', 'provider_webhook', 'operator') and created_by_principal_id is null)
  )
);

create index outbox_events_eligible_idx
  on ops.outbox_events(state, available_at, created_at)
  where state in ('PENDING', 'LEASED');

create table ops.jobs (
  id uuid primary key default gen_random_uuid(),
  source_outbox_event_id uuid unique references ops.outbox_events(id) on delete restrict,
  handler_type text not null check (length(handler_type) between 1 and 96),
  handler_version integer not null check (handler_version >= 1),
  dedupe_key text not null unique check (length(dedupe_key) between 1 and 180),
  payload_json jsonb not null check (jsonb_typeof(payload_json) = 'object'),
  payload_schema_version integer not null check (payload_schema_version >= 1),
  state text not null default 'PENDING'
    check (state in ('PENDING', 'LEASED', 'RETRY', 'SUCCEEDED', 'DEAD')),
  next_eligible_at timestamptz not null default clock_timestamp(),
  lease_token uuid,
  lease_expires_at timestamptz,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null check (max_attempts >= 1),
  last_error_code text,
  retention_eligible_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,
  constraint jobs_lease_check check (
    (state = 'LEASED' and lease_token is not null and lease_expires_at is not null)
    or
    (state <> 'LEASED' and lease_token is null and lease_expires_at is null)
  ),
  constraint jobs_completion_check check (
    (state in ('SUCCEEDED', 'DEAD') and completed_at is not null)
    or
    (state not in ('SUCCEEDED', 'DEAD') and completed_at is null)
  )
);

create index jobs_eligible_idx
  on ops.jobs(state, next_eligible_at, created_at)
  where state in ('PENDING', 'RETRY', 'LEASED');

create table ops.job_attempts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references ops.jobs(id) on delete restrict,
  attempt_number integer not null check (attempt_number >= 1),
  lease_token uuid not null,
  started_at timestamptz not null default clock_timestamp(),
  finished_at timestamptz,
  outcome text check (outcome in ('SUCCEEDED', 'RETRY', 'FAILED_FINAL', 'ABANDONED')),
  safe_error_code text,
  safe_diagnostic_json jsonb check (
    safe_diagnostic_json is null or (
      jsonb_typeof(safe_diagnostic_json) = 'object'
      and octet_length(safe_diagnostic_json::text) <= 2048
    )
  ),
  safe_diagnostic_schema_version integer
    check (safe_diagnostic_schema_version is null or safe_diagnostic_schema_version >= 1),
  created_at timestamptz not null default clock_timestamp(),
  constraint job_attempt_sequence_unique unique (job_id, attempt_number),
  constraint job_attempt_finish_check check (
    (finished_at is null and outcome is null)
    or
    (finished_at is not null and outcome is not null)
  ),
  constraint job_attempt_diagnostic_schema_check check (
    (safe_diagnostic_json is null and safe_diagnostic_schema_version is null)
    or
    (safe_diagnostic_json is not null and safe_diagnostic_schema_version is not null)
  )
);

create table ops.inbound_provider_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider ~ '^[a-z][a-z0-9_]{1,31}$'),
  provider_event_id text not null check (length(provider_event_id) between 1 and 255),
  semantic_key text,
  event_type text not null check (length(event_type) between 1 and 128),
  payload_digest text not null check (payload_digest ~ '^[a-f0-9]{64}$'),
  signature_verified boolean not null,
  provider_occurred_at timestamptz,
  received_at timestamptz not null default clock_timestamp(),
  process_state text not null default 'RECEIVED'
    check (process_state in ('RECEIVED', 'PROCESSING', 'PROCESSED', 'IGNORED', 'FAILED_RETRYABLE', 'FAILED_FINAL')),
  correlation_id uuid not null,
  processed_at timestamptz,
  safe_result_code text,
  retention_eligible_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint inbound_provider_event_unique unique (provider, provider_event_id),
  constraint inbound_provider_event_process_check check (
    (process_state in ('PROCESSED', 'IGNORED', 'FAILED_FINAL') and processed_at is not null)
    or
    (process_state not in ('PROCESSED', 'IGNORED', 'FAILED_FINAL') and processed_at is null)
  )
);

create unique index inbound_provider_event_semantic_unique
  on ops.inbound_provider_events(provider, semantic_key)
  where semantic_key is not null;

create function ops.reject_attempt_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception using errcode = '55000', message = 'job attempts are append-only';
end
$$;

create trigger job_attempts_mutation_guard
before update or delete on ops.job_attempts
for each row execute function ops.reject_attempt_mutation();

alter table iam.principals enable row level security;
alter table iam.principals force row level security;
alter table iam.external_identities enable row level security;
alter table iam.external_identities force row level security;
alter table iam.customers enable row level security;
alter table iam.customers force row level security;
alter table iam.managers enable row level security;
alter table iam.managers force row level security;
alter table config.business_profile enable row level security;
alter table config.business_profile force row level security;
alter table config.fulfilment_locations enable row level security;
alter table config.fulfilment_locations force row level security;
alter table config.configuration_definitions enable row level security;
alter table config.configuration_definitions force row level security;
alter table config.configuration_revisions enable row level security;
alter table config.configuration_revisions force row level security;
alter table audit.events enable row level security;
alter table audit.events force row level security;
alter table ops.idempotency_records enable row level security;
alter table ops.idempotency_records force row level security;
alter table ops.outbox_events enable row level security;
alter table ops.outbox_events force row level security;
alter table ops.jobs enable row level security;
alter table ops.jobs force row level security;
alter table ops.job_attempts enable row level security;
alter table ops.job_attempts force row level security;
alter table ops.inbound_provider_events enable row level security;
alter table ops.inbound_provider_events force row level security;

create policy principals_runtime_select on iam.principals
  for select to atelier_runtime
  using (
    id = iam.current_principal_id()
    or iam.current_actor_kind() in ('manager', 'provider_webhook', 'operator')
  );

create policy principals_runtime_update on iam.principals
  for update to atelier_runtime
  using (iam.current_actor_kind() = 'operator')
  with check (iam.current_actor_kind() = 'operator');

create policy principals_runtime_insert on iam.principals
  for insert to atelier_runtime
  with check (
    (iam.current_actor_kind() = 'provider_webhook' and actor_type = 'CUSTOMER')
    or iam.current_actor_kind() = 'operator'
  );

create policy external_identities_runtime_access on iam.external_identities
  for all to atelier_runtime
  using (iam.current_actor_kind() in ('provider_webhook', 'operator'))
  with check (iam.current_actor_kind() in ('provider_webhook', 'operator'));

create policy customers_runtime_select on iam.customers
  for select to atelier_runtime
  using (
    (iam.current_actor_kind() = 'customer'
      and principal_id = iam.current_principal_id()
      and id = iam.current_customer_id())
    or iam.current_actor_kind() in ('manager', 'operator')
  );

create policy customers_runtime_update on iam.customers
  for update to atelier_runtime
  using (
    (iam.current_actor_kind() = 'customer'
      and principal_id = iam.current_principal_id()
      and id = iam.current_customer_id())
    or iam.current_actor_kind() = 'operator'
  )
  with check (
    (iam.current_actor_kind() = 'customer'
      and principal_id = iam.current_principal_id()
      and id = iam.current_customer_id())
    or iam.current_actor_kind() = 'operator'
  );

create policy customers_identity_provision on iam.customers
  for insert to atelier_runtime
  with check (iam.current_actor_kind() in ('provider_webhook', 'operator'));

create policy managers_runtime_select on iam.managers
  for select to atelier_runtime
  using (
    principal_id = iam.current_principal_id()
    and iam.current_actor_kind() = 'manager'
  );

create policy managers_operator_write on iam.managers
  for all to atelier_runtime
  using (iam.current_actor_kind() = 'operator')
  with check (iam.current_actor_kind() = 'operator');

create policy business_profile_runtime_select on config.business_profile
  for select to atelier_runtime
  using (iam.current_actor_kind() is not null);

create policy business_profile_runtime_write on config.business_profile
  for all to atelier_runtime
  using (
    iam.current_actor_kind() = 'operator'
    or (iam.current_actor_kind() = 'manager' and iam.current_auth_assurance() = 'manager_mfa')
  )
  with check (
    iam.current_actor_kind() = 'operator'
    or (iam.current_actor_kind() = 'manager' and iam.current_auth_assurance() = 'manager_mfa')
  );

create policy fulfilment_locations_runtime_select on config.fulfilment_locations
  for select to atelier_runtime
  using (iam.current_actor_kind() is not null);

create policy fulfilment_locations_runtime_write on config.fulfilment_locations
  for all to atelier_runtime
  using (
    iam.current_actor_kind() = 'operator'
    or (iam.current_actor_kind() = 'manager' and iam.current_auth_assurance() = 'manager_mfa')
  )
  with check (
    iam.current_actor_kind() = 'operator'
    or (iam.current_actor_kind() = 'manager' and iam.current_auth_assurance() = 'manager_mfa')
  );

create policy configuration_definitions_runtime_select on config.configuration_definitions
  for select to atelier_runtime
  using (iam.current_actor_kind() in ('customer', 'manager', 'system_job', 'operator'));

create policy configuration_revisions_runtime_select on config.configuration_revisions
  for select to atelier_runtime
  using (iam.current_actor_kind() in ('customer', 'manager', 'system_job', 'operator'));

create policy configuration_revisions_runtime_write on config.configuration_revisions
  for all to atelier_runtime
  using (
    iam.current_actor_kind() = 'operator'
    or (iam.current_actor_kind() = 'manager' and iam.current_auth_assurance() = 'manager_mfa')
  )
  with check (
    iam.current_actor_kind() = 'operator'
    or (iam.current_actor_kind() = 'manager' and iam.current_auth_assurance() = 'manager_mfa')
  );

create policy audit_runtime_insert on audit.events
  for insert to atelier_runtime
  with check (
    actor_kind = iam.current_actor_kind()
    and (
      (actor_kind in ('customer', 'manager') and actor_principal_id = iam.current_principal_id())
      or actor_kind in ('provider_webhook', 'operator')
    )
  );

create policy audit_runtime_select on audit.events
  for select to atelier_runtime
  using (
    iam.current_actor_kind() = 'operator'
    or (iam.current_actor_kind() = 'manager' and iam.current_auth_assurance() = 'manager_mfa')
  );

create policy audit_job_insert on audit.events
  for insert to atelier_job
  with check (actor_kind = 'system_job' and iam.current_actor_kind() = 'system_job');

create policy audit_operations_read on audit.events
  for select to atelier_operations_readonly
  using (true);

create policy idempotency_runtime_access on ops.idempotency_records
  for all to atelier_runtime
  using (
    scope_actor_kind = iam.current_actor_kind()
    and scope_principal_id is not distinct from iam.current_principal_id()
  )
  with check (
    scope_actor_kind = iam.current_actor_kind()
    and scope_principal_id is not distinct from iam.current_principal_id()
  );

create policy outbox_runtime_insert on ops.outbox_events
  for insert to atelier_runtime
  with check (
    created_by_actor_kind = iam.current_actor_kind()
    and created_by_principal_id is not distinct from iam.current_principal_id()
    and iam.current_actor_kind() <> 'visitor'
  );

create policy outbox_runtime_creator_read on ops.outbox_events
  for select to atelier_runtime
  using (
    created_by_actor_kind = iam.current_actor_kind()
    and created_by_principal_id is not distinct from iam.current_principal_id()
  );

create policy outbox_runtime_reconciliation on ops.outbox_events
  for select to atelier_runtime
  using (iam.current_actor_kind() = 'operator');

create policy outbox_runtime_reconciliation_update on ops.outbox_events
  for update to atelier_runtime
  using (iam.current_actor_kind() = 'operator')
  with check (iam.current_actor_kind() = 'operator');

create policy jobs_runtime_reconciliation on ops.jobs
  for all to atelier_runtime
  using (iam.current_actor_kind() = 'operator')
  with check (iam.current_actor_kind() = 'operator');

create policy job_attempts_runtime_reconciliation on ops.job_attempts
  for select to atelier_runtime
  using (iam.current_actor_kind() = 'operator');

create policy job_attempts_runtime_insert on ops.job_attempts
  for insert to atelier_runtime
  with check (iam.current_actor_kind() = 'operator');

create policy provider_events_runtime_access on ops.inbound_provider_events
  for all to atelier_runtime
  using (iam.current_actor_kind() in ('provider_webhook', 'operator'))
  with check (iam.current_actor_kind() in ('provider_webhook', 'operator'));

create policy outbox_job_access on ops.outbox_events
  for all to atelier_job
  using (iam.current_actor_kind() = 'system_job')
  with check (iam.current_actor_kind() = 'system_job');

create policy jobs_job_access on ops.jobs
  for all to atelier_job
  using (iam.current_actor_kind() = 'system_job')
  with check (iam.current_actor_kind() = 'system_job');

create policy job_attempts_job_select on ops.job_attempts
  for select to atelier_job
  using (iam.current_actor_kind() = 'system_job');

create policy job_attempts_job_insert on ops.job_attempts
  for insert to atelier_job
  with check (iam.current_actor_kind() = 'system_job');

create policy provider_events_job_access on ops.inbound_provider_events
  for all to atelier_job
  using (iam.current_actor_kind() = 'system_job')
  with check (iam.current_actor_kind() = 'system_job');

create policy outbox_operations_read on ops.outbox_events
  for select to atelier_operations_readonly using (true);
create policy jobs_operations_read on ops.jobs
  for select to atelier_operations_readonly using (true);
create policy job_attempts_operations_read on ops.job_attempts
  for select to atelier_operations_readonly using (true);
create policy provider_events_operations_read on ops.inbound_provider_events
  for select to atelier_operations_readonly using (true);

grant usage on schema iam, config, audit, ops to atelier_runtime;
grant usage on schema iam, audit, ops to atelier_job;
grant usage on schema audit, ops to atelier_operations_readonly;
grant usage on schema iam to atelier_identity_resolver;

grant execute on function iam.current_actor_kind() to atelier_runtime, atelier_job;
grant execute on function iam.current_principal_id() to atelier_runtime, atelier_job;
grant execute on function iam.current_customer_id() to atelier_runtime, atelier_job;
grant execute on function iam.current_auth_assurance() to atelier_runtime, atelier_job;
grant execute on function iam.resolve_external_identity(text, text) to atelier_identity_resolver;
grant execute on function iam.provision_customer_external_identity(text, text, text, uuid)
  to atelier_identity_resolver;
grant execute on function iam.apply_customer_identity_provider_update(text, text, text, text)
  to atelier_runtime;

grant select, insert, update on iam.principals, iam.external_identities, iam.customers, iam.managers
  to atelier_runtime;
grant select on config.business_profile, config.fulfilment_locations,
  config.configuration_definitions, config.configuration_revisions to atelier_runtime;
grant insert, update on config.business_profile, config.fulfilment_locations,
  config.configuration_revisions to atelier_runtime;
grant select, insert on audit.events to atelier_runtime, atelier_job;
grant select on audit.events to atelier_operations_readonly;

grant select, insert, update on ops.idempotency_records, ops.outbox_events, ops.jobs,
  ops.inbound_provider_events to atelier_runtime;
grant select, insert on ops.job_attempts to atelier_runtime;
grant select, insert, update on ops.outbox_events, ops.jobs, ops.inbound_provider_events
  to atelier_job;
grant select, insert on ops.job_attempts to atelier_job;
grant select on ops.outbox_events, ops.jobs, ops.job_attempts, ops.inbound_provider_events
  to atelier_operations_readonly;

revoke update, delete, truncate on audit.events from atelier_runtime, atelier_job,
  atelier_operations_readonly;
revoke update, delete, truncate on ops.job_attempts from atelier_runtime, atelier_job,
  atelier_operations_readonly;
revoke create on schema iam, config, audit, ops from atelier_runtime, atelier_job,
  atelier_operations_readonly, atelier_identity_resolver;

comment on schema iam is 'Access and Identity module-owned schema';
comment on schema config is 'Business Configuration module-owned schema';
comment on schema audit is 'Audit and Operations append-only evidence schema';
comment on schema ops is 'Audit and Operations durable work schema';
