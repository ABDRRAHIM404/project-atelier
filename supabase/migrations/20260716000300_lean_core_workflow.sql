-- Project Atelier lean V1 core workflow
-- Owners: Customer Projects, Messaging, Quotations and Acceptance, Orders,
--         Payments, Production, Fulfilment, Notifications
-- Risk class: D (commercial history, authorization, payment and production gates)
-- Transaction-safe: yes; migration runner applies this file atomically
-- Expected lock: new-object catalog locks only
-- Recovery: discard an uncommitted transaction; after commit, forward-fix only

select pg_advisory_xact_lock(hashtextextended('project-atelier:lean-core-workflow', 0));

create schema if not exists projects;
create schema if not exists quotes;
create schema if not exists orders;
create schema if not exists payments;
create schema if not exists production;
create schema if not exists fulfilment;
create schema if not exists messaging;
create schema if not exists notifications;

revoke all on schema projects, quotes, orders, payments, production, fulfilment,
  messaging, notifications from public;

create function ops.reject_immutable_row()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception using errcode = '55000', message = 'historical row is immutable';
end
$$;
revoke all on function ops.reject_immutable_row() from public;

create table projects.customer_projects (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references iam.customers(id) on delete restrict,
  state text not null default 'DRAFT' check (state in (
    'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'WAITING_FOR_CUSTOMER_INFORMATION',
    'READY_FOR_QUOTATION', 'QUOTED'
  )),
  project_name text not null check (length(trim(project_name)) between 2 and 120),
  customer_notes text not null default '' check (length(customer_notes) <= 4000),
  submitted_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  record_version integer not null default 1 check (record_version >= 1),
  constraint customer_projects_submission_state_check check (
    (state = 'DRAFT' and submitted_at is null)
    or (state <> 'DRAFT' and submitted_at is not null)
  )
);
create index customer_projects_customer_created_idx
  on projects.customer_projects(customer_id, created_at desc);

create table projects.project_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects.customer_projects(id) on delete restrict,
  product_id uuid not null references catalog.products(id) on delete restrict,
  position integer not null check (position between 1 and 50),
  customer_notes text not null default '' check (length(customer_notes) <= 2000),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  record_version integer not null default 1 check (record_version >= 1),
  constraint project_items_position_unique unique (project_id, position)
);
create index project_items_project_idx on projects.project_items(project_id);

create table projects.product_configurations (
  id uuid primary key default gen_random_uuid(),
  project_item_id uuid not null unique references projects.project_items(id) on delete restrict,
  product_id uuid not null references catalog.products(id) on delete restrict,
  schema_version integer not null default 1 check (schema_version >= 1),
  selections jsonb not null default '{}'::jsonb check (jsonb_typeof(selections) = 'object'),
  dimensions jsonb not null default '{}'::jsonb check (jsonb_typeof(dimensions) = 'object'),
  catalog_record_version integer not null check (catalog_record_version >= 1),
  last_validated_at timestamptz not null default clock_timestamp(),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  record_version integer not null default 1 check (record_version >= 1)
);

create table projects.submitted_requests (
  id uuid primary key default gen_random_uuid(),
  source_project_id uuid not null unique references projects.customer_projects(id) on delete restrict,
  customer_id uuid not null references iam.customers(id) on delete restrict,
  state text not null default 'SUBMITTED' check (state in (
    'SUBMITTED', 'UNDER_REVIEW', 'WAITING_FOR_CUSTOMER_INFORMATION',
    'READY_FOR_QUOTATION', 'QUOTED'
  )),
  project_name_snapshot text not null,
  customer_notes_snapshot text not null default '',
  submitted_at timestamptz not null default clock_timestamp(),
  record_version integer not null default 1 check (record_version >= 1)
);
create index submitted_requests_customer_created_idx
  on projects.submitted_requests(customer_id, submitted_at desc);

create table projects.submitted_request_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references projects.submitted_requests(id) on delete restrict,
  source_project_item_id uuid not null unique references projects.project_items(id) on delete restrict,
  sequence integer not null check (sequence between 1 and 50),
  product_id uuid not null references catalog.products(id) on delete restrict,
  snapshot_schema_version integer not null default 1 check (snapshot_schema_version >= 1),
  product_snapshot jsonb not null check (jsonb_typeof(product_snapshot) = 'object'),
  configuration_snapshot jsonb not null check (jsonb_typeof(configuration_snapshot) = 'object'),
  customer_notes_snapshot text not null default '',
  created_at timestamptz not null default clock_timestamp(),
  constraint submitted_request_items_sequence_unique unique (request_id, sequence)
);

create function projects.require_draft_project_item()
returns trigger
language plpgsql
set search_path = pg_catalog, projects
as $$
declare
  target_project_id uuid := coalesce(new.project_id, old.project_id);
begin
  if not exists (
    select 1 from projects.customer_projects
    where id = target_project_id and state = 'DRAFT'
  ) then
    raise exception using errcode = '55000', message = 'only a draft Project can be changed';
  end if;
  return coalesce(new, old);
end
$$;

create function projects.require_draft_product_configuration()
returns trigger
language plpgsql
set search_path = pg_catalog, projects
as $$
declare
  target_project_id uuid;
begin
  select project_id
    into target_project_id
    from projects.project_items
   where id = coalesce(new.project_item_id, old.project_item_id);

  if not exists (
    select 1 from projects.customer_projects
    where id = target_project_id and state = 'DRAFT'
  ) then
    raise exception using errcode = '55000', message = 'only a draft Project can be changed';
  end if;
  return coalesce(new, old);
end
$$;

create trigger project_items_draft_guard
before insert or update or delete on projects.project_items
for each row execute function projects.require_draft_project_item();
create trigger product_configurations_draft_guard
before insert or update or delete on projects.product_configurations
for each row execute function projects.require_draft_product_configuration();
create function projects.protect_submitted_request_snapshot()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if tg_op = 'DELETE'
     or new.source_project_id is distinct from old.source_project_id
     or new.customer_id is distinct from old.customer_id
     or new.project_name_snapshot is distinct from old.project_name_snapshot
     or new.customer_notes_snapshot is distinct from old.customer_notes_snapshot
     or new.submitted_at is distinct from old.submitted_at then
    raise exception using errcode = '55000', message = 'Submitted Request snapshot is immutable';
  end if;
  new.record_version := old.record_version + 1;
  return new;
end
$$;
create trigger submitted_requests_snapshot_guard
before update or delete on projects.submitted_requests
for each row execute function projects.protect_submitted_request_snapshot();
create trigger submitted_request_items_immutable
before update or delete on projects.submitted_request_items
for each row execute function ops.reject_immutable_row();

create table messaging.conversations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null unique references iam.customers(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp()
);

create table messaging.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references messaging.conversations(id) on delete restrict,
  sender_principal_id uuid not null references iam.principals(id) on delete restrict,
  sender_kind text not null check (sender_kind in ('CUSTOMER', 'MANAGER')),
  body text not null check (length(trim(body)) between 1 and 4000),
  project_id uuid references projects.customer_projects(id) on delete restrict,
  order_id uuid,
  client_message_key text not null check (length(client_message_key) between 8 and 255),
  sent_at timestamptz not null default clock_timestamp(),
  constraint messages_one_context_check check (not (project_id is not null and order_id is not null)),
  constraint messages_client_key_unique unique (conversation_id, sender_principal_id, client_message_key)
);
create index messages_conversation_sent_idx
  on messaging.messages(conversation_id, sent_at, id);
create trigger messages_immutable
before update or delete on messaging.messages
for each row execute function ops.reject_immutable_row();

create table quotes.quotations (
  id uuid primary key default gen_random_uuid(),
  submitted_request_id uuid not null unique references projects.submitted_requests(id) on delete restrict,
  customer_id uuid not null references iam.customers(id) on delete restrict,
  lifecycle text not null default 'DRAFT' check (lifecycle in ('DRAFT', 'SENT', 'ACCEPTED', 'DECLINED')),
  current_sent_revision_id uuid,
  next_revision_number integer not null default 1 check (next_revision_number >= 1),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  record_version integer not null default 1 check (record_version >= 1)
);

create table quotes.quotation_revisions (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references quotes.quotations(id) on delete restrict,
  revision_number integer not null check (revision_number >= 1),
  state text not null default 'DRAFT' check (state in ('DRAFT', 'SENT', 'SUPERSEDED', 'ACCEPTED', 'DECLINED')),
  currency_code text not null default 'SAR' check (currency_code ~ '^[A-Z]{3}$'),
  subtotal_minor bigint not null default 0 check (subtotal_minor >= 0),
  delivery_minor bigint not null default 0 check (delivery_minor >= 0),
  total_minor bigint generated always as (subtotal_minor + delivery_minor) stored,
  production_estimate_text text not null check (length(trim(production_estimate_text)) between 2 and 500),
  fulfilment_method text not null check (fulfilment_method in ('PICKUP', 'DELIVERY')),
  fulfilment_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(fulfilment_snapshot) = 'object'),
  terms_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(terms_snapshot) = 'object'),
  manager_notes text not null default '' check (length(manager_notes) <= 4000),
  authored_by_manager_id uuid not null references iam.managers(id) on delete restrict,
  sent_at timestamptz,
  digest_sha256 text,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  record_version integer not null default 1 check (record_version >= 1),
  constraint quotation_revisions_number_unique unique (quotation_id, revision_number),
  constraint quotation_revisions_sent_shape check (
    (state = 'DRAFT' and sent_at is null and digest_sha256 is null)
    or (state <> 'DRAFT' and sent_at is not null and digest_sha256 ~ '^[0-9a-f]{64}$')
  )
);

alter table quotes.quotations
  add constraint quotations_current_sent_revision_fk
  foreign key (current_sent_revision_id) references quotes.quotation_revisions(id) on delete restrict;

create table quotes.quotation_items (
  id uuid primary key default gen_random_uuid(),
  revision_id uuid not null references quotes.quotation_revisions(id) on delete restrict,
  source_submitted_item_id uuid not null references projects.submitted_request_items(id) on delete restrict,
  sequence integer not null check (sequence between 1 and 50),
  item_snapshot jsonb not null check (jsonb_typeof(item_snapshot) = 'object'),
  item_total_minor bigint not null check (item_total_minor >= 0),
  currency_code text not null default 'SAR' check (currency_code ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default clock_timestamp(),
  constraint quotation_items_sequence_unique unique (revision_id, sequence),
  constraint quotation_items_source_unique unique (revision_id, source_submitted_item_id)
);

create table quotes.quotation_responses (
  id uuid primary key default gen_random_uuid(),
  revision_id uuid not null references quotes.quotation_revisions(id) on delete restrict,
  customer_id uuid not null references iam.customers(id) on delete restrict,
  outcome text not null check (outcome in ('CHANGES_REQUESTED', 'DECLINED')),
  reason text not null check (length(trim(reason)) between 2 and 2000),
  created_at timestamptz not null default clock_timestamp()
);

create table quotes.customer_acceptances (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null unique references quotes.quotations(id) on delete restrict,
  revision_id uuid not null unique references quotes.quotation_revisions(id) on delete restrict,
  customer_id uuid not null references iam.customers(id) on delete restrict,
  accepted_digest_sha256 text not null check (accepted_digest_sha256 ~ '^[0-9a-f]{64}$'),
  accepted_at timestamptz not null default clock_timestamp()
);

create function quotes.require_draft_revision_child()
returns trigger
language plpgsql
set search_path = pg_catalog, quotes
as $$
begin
  if not exists (
    select 1 from quotes.quotation_revisions
    where id = coalesce(new.revision_id, old.revision_id) and state = 'DRAFT'
  ) then
    raise exception using errcode = '55000', message = 'only a draft Quotation Revision can be changed';
  end if;
  return coalesce(new, old);
end
$$;
create trigger quotation_items_draft_guard
before insert or update or delete on quotes.quotation_items
for each row execute function quotes.require_draft_revision_child();

create function quotes.protect_sent_revision()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if tg_op = 'DELETE' or old.state <> 'DRAFT' then
    raise exception using errcode = '55000', message = 'sent Quotation Revision is immutable';
  end if;
  return new;
end
$$;
create trigger quotation_revision_history_guard
before update or delete on quotes.quotation_revisions
for each row execute function quotes.protect_sent_revision();
create trigger quotation_responses_immutable
before update or delete on quotes.quotation_responses
for each row execute function ops.reject_immutable_row();
create trigger customer_acceptances_immutable
before update or delete on quotes.customer_acceptances
for each row execute function ops.reject_immutable_row();

create table orders.orders (
  id uuid primary key default gen_random_uuid(),
  display_reference text not null unique check (display_reference ~ '^ATL-[0-9]{8}-[A-Z0-9]{6}$'),
  customer_id uuid not null references iam.customers(id) on delete restrict,
  acceptance_id uuid not null unique references quotes.customer_acceptances(id) on delete restrict,
  accepted_revision_id uuid not null unique references quotes.quotation_revisions(id) on delete restrict,
  lifecycle_state text not null default 'AWAITING_PAYMENT' check (lifecycle_state in (
    'AWAITING_PAYMENT', 'PAYMENT_UNDER_REVIEW', 'PAYMENT_VERIFIED',
    'IN_PRODUCTION', 'READY_FOR_FULFILMENT', 'COMPLETED', 'CANCELLED'
  )),
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  accepted_total_minor bigint not null check (accepted_total_minor >= 0),
  created_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,
  updated_at timestamptz not null default clock_timestamp(),
  record_version integer not null default 1 check (record_version >= 1),
  constraint orders_completed_shape check (
    (lifecycle_state = 'COMPLETED' and completed_at is not null)
    or (lifecycle_state <> 'COMPLETED' and completed_at is null)
  )
);
create index orders_customer_created_idx on orders.orders(customer_id, created_at desc);

alter table messaging.messages
  add constraint messages_order_fk foreign key (order_id) references orders.orders(id) on delete restrict;

create table orders.order_item_snapshots (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders.orders(id) on delete restrict,
  source_quotation_item_id uuid not null unique references quotes.quotation_items(id) on delete restrict,
  sequence integer not null check (sequence between 1 and 50),
  product_id uuid references catalog.products(id) on delete restrict,
  item_snapshot jsonb not null check (jsonb_typeof(item_snapshot) = 'object'),
  item_total_minor bigint not null check (item_total_minor >= 0),
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default clock_timestamp(),
  constraint order_item_snapshots_sequence_unique unique (order_id, sequence)
);

create table orders.order_terms_snapshots (
  order_id uuid primary key references orders.orders(id) on delete restrict,
  terms_snapshot jsonb not null check (jsonb_typeof(terms_snapshot) = 'object'),
  fulfilment_method text not null check (fulfilment_method in ('PICKUP', 'DELIVERY')),
  fulfilment_snapshot jsonb not null check (jsonb_typeof(fulfilment_snapshot) = 'object'),
  production_estimate_text text not null,
  accepted_digest_sha256 text not null check (accepted_digest_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default clock_timestamp()
);

create function orders.guard_order_transition()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.lifecycle_state = old.lifecycle_state then return new; end if;
  if not (
    (old.lifecycle_state = 'AWAITING_PAYMENT' and new.lifecycle_state = 'PAYMENT_UNDER_REVIEW')
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
create trigger orders_transition_guard
before update of lifecycle_state on orders.orders
for each row execute function orders.guard_order_transition();
create trigger order_item_snapshots_immutable
before update or delete on orders.order_item_snapshots
for each row execute function ops.reject_immutable_row();
create trigger order_terms_snapshots_immutable
before update or delete on orders.order_terms_snapshots
for each row execute function ops.reject_immutable_row();

create table payments.order_payment_status (
  order_id uuid primary key references orders.orders(id) on delete restrict,
  current_state text not null default 'AWAITING_SUBMISSION' check (current_state in (
    'AWAITING_SUBMISSION', 'SUBMITTED', 'REJECTED', 'VERIFIED'
  )),
  current_submission_id uuid,
  verified_decision_id uuid,
  updated_at timestamptz not null default clock_timestamp(),
  record_version integer not null default 1 check (record_version >= 1)
);

create table payments.payment_submissions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders.orders(id) on delete restrict,
  customer_id uuid not null references iam.customers(id) on delete restrict,
  proof_object_key text not null check (length(trim(proof_object_key)) between 3 and 1024),
  proof_display_filename text not null check (length(trim(proof_display_filename)) between 1 and 255),
  proof_media_type text not null check (proof_media_type in ('image/jpeg', 'image/png', 'application/pdf')),
  proof_checksum_sha256 text check (proof_checksum_sha256 is null or proof_checksum_sha256 ~ '^[0-9a-f]{64}$'),
  storage_scan_state text not null default 'CLEAN' check (storage_scan_state = 'CLEAN'),
  declared_reference text not null default '' check (length(declared_reference) <= 160),
  submitted_at timestamptz not null default clock_timestamp(),
  constraint payment_submission_proof_unique unique (order_id, proof_object_key)
);

create table payments.payment_verifications (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders.orders(id) on delete restrict,
  submission_id uuid not null unique references payments.payment_submissions(id) on delete restrict,
  manager_id uuid not null references iam.managers(id) on delete restrict,
  outcome text not null check (outcome in ('VERIFIED', 'REJECTED')),
  safe_reason text not null default '' check (length(safe_reason) <= 1000),
  decided_at timestamptz not null default clock_timestamp()
);
create unique index payment_one_verified_per_order
  on payments.payment_verifications(order_id) where outcome = 'VERIFIED';

alter table payments.order_payment_status
  add constraint payment_status_current_submission_fk
    foreign key (current_submission_id) references payments.payment_submissions(id) on delete restrict,
  add constraint payment_status_verified_decision_fk
    foreign key (verified_decision_id) references payments.payment_verifications(id) on delete restrict;

create function payments.guard_payment_transition()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.current_state = old.current_state then return new; end if;
  if not (
    (old.current_state in ('AWAITING_SUBMISSION', 'REJECTED') and new.current_state = 'SUBMITTED')
    or (old.current_state = 'SUBMITTED' and new.current_state in ('REJECTED', 'VERIFIED'))
  ) then
    raise exception using errcode = '23514', message = 'forbidden Payment transition';
  end if;
  new.updated_at := clock_timestamp();
  new.record_version := old.record_version + 1;
  return new;
end
$$;
create trigger payment_status_transition_guard
before update of current_state on payments.order_payment_status
for each row execute function payments.guard_payment_transition();
create trigger payment_submissions_immutable
before update or delete on payments.payment_submissions
for each row execute function ops.reject_immutable_row();
create trigger payment_verifications_immutable
before update or delete on payments.payment_verifications
for each row execute function ops.reject_immutable_row();

create table production.order_production (
  order_id uuid primary key references orders.orders(id) on delete restrict,
  current_state text not null default 'NOT_STARTED' check (current_state in (
    'NOT_STARTED', 'MATERIALS_PREPARATION', 'IN_PRODUCTION', 'QUALITY_INSPECTION', 'READY'
  )),
  next_sequence integer not null default 1 check (next_sequence >= 1),
  started_at timestamptz,
  ready_at timestamptz,
  updated_at timestamptz not null default clock_timestamp(),
  record_version integer not null default 1 check (record_version >= 1)
);

create table production.production_updates (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders.orders(id) on delete restrict,
  sequence integer not null check (sequence >= 1),
  from_state text not null,
  to_state text not null,
  manager_id uuid not null references iam.managers(id) on delete restrict,
  customer_visible_note text not null default '' check (length(customer_visible_note) <= 1000),
  occurred_at timestamptz not null default clock_timestamp(),
  constraint production_updates_sequence_unique unique (order_id, sequence)
);

create function production.guard_production_transition()
returns trigger
language plpgsql
set search_path = pg_catalog, payments
as $$
begin
  if new.current_state = old.current_state then return new; end if;
  if not (
    (old.current_state = 'NOT_STARTED' and new.current_state = 'MATERIALS_PREPARATION')
    or (old.current_state = 'MATERIALS_PREPARATION' and new.current_state = 'IN_PRODUCTION')
    or (old.current_state = 'IN_PRODUCTION' and new.current_state = 'QUALITY_INSPECTION')
    or (old.current_state = 'QUALITY_INSPECTION' and new.current_state in ('IN_PRODUCTION', 'READY'))
  ) then
    raise exception using errcode = '23514', message = 'forbidden Production transition';
  end if;
  if old.current_state = 'NOT_STARTED' and not exists (
    select 1 from payments.order_payment_status
    where order_id = new.order_id and current_state = 'VERIFIED' and verified_decision_id is not null
  ) then
    raise exception using errcode = '23514', message = 'verified Payment is required before Production';
  end if;
  new.updated_at := clock_timestamp();
  new.record_version := old.record_version + 1;
  if new.current_state = 'MATERIALS_PREPARATION' then new.started_at := clock_timestamp(); end if;
  if new.current_state = 'READY' then new.ready_at := clock_timestamp(); end if;
  return new;
end
$$;
create trigger production_transition_guard
before update of current_state on production.order_production
for each row execute function production.guard_production_transition();
create trigger production_updates_immutable
before update or delete on production.production_updates
for each row execute function ops.reject_immutable_row();

create table fulfilment.fulfilments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references orders.orders(id) on delete restrict,
  accepted_method text not null check (accepted_method in ('PICKUP', 'DELIVERY')),
  accepted_snapshot jsonb not null check (jsonb_typeof(accepted_snapshot) = 'object'),
  state text not null default 'WAITING_FOR_PRODUCTION' check (state in (
    'WAITING_FOR_PRODUCTION', 'READY_FOR_HANDOFF', 'COMPLETED'
  )),
  ready_at timestamptz,
  handoff_at timestamptz,
  updated_at timestamptz not null default clock_timestamp(),
  record_version integer not null default 1 check (record_version >= 1)
);

create table fulfilment.handoff_proofs (
  id uuid primary key default gen_random_uuid(),
  fulfilment_id uuid not null references fulfilment.fulfilments(id) on delete restrict,
  proof_object_key text not null check (length(trim(proof_object_key)) between 3 and 1024),
  proof_display_filename text not null check (length(trim(proof_display_filename)) between 1 and 255),
  proof_media_type text not null check (proof_media_type in ('image/jpeg', 'image/png', 'application/pdf')),
  proof_checksum_sha256 text check (proof_checksum_sha256 is null or proof_checksum_sha256 ~ '^[0-9a-f]{64}$'),
  captured_by_principal_id uuid not null references iam.principals(id) on delete restrict,
  captured_at timestamptz not null default clock_timestamp(),
  constraint handoff_proofs_object_unique unique (fulfilment_id, proof_object_key)
);

create function fulfilment.guard_fulfilment_transition()
returns trigger
language plpgsql
set search_path = pg_catalog, production
as $$
begin
  if new.state = old.state then return new; end if;
  if not (
    (old.state = 'WAITING_FOR_PRODUCTION' and new.state = 'READY_FOR_HANDOFF')
    or (old.state = 'READY_FOR_HANDOFF' and new.state = 'COMPLETED')
  ) then
    raise exception using errcode = '23514', message = 'forbidden Fulfilment transition';
  end if;
  if old.state = 'WAITING_FOR_PRODUCTION' and not exists (
    select 1 from production.order_production
    where order_id = new.order_id and current_state = 'READY'
  ) then
    raise exception using errcode = '23514', message = 'Production must be READY before fulfilment';
  end if;
  if new.state = 'COMPLETED' and not exists (
    select 1 from fulfilment.handoff_proofs where fulfilment_id = new.id
  ) then
    raise exception using errcode = '23514', message = 'handoff proof is required before completion';
  end if;
  new.updated_at := clock_timestamp();
  new.record_version := old.record_version + 1;
  if new.state = 'READY_FOR_HANDOFF' then new.ready_at := clock_timestamp(); end if;
  if new.state = 'COMPLETED' then new.handoff_at := clock_timestamp(); end if;
  return new;
end
$$;
create trigger fulfilment_transition_guard
before update of state on fulfilment.fulfilments
for each row execute function fulfilment.guard_fulfilment_transition();
create trigger handoff_proofs_immutable
before update or delete on fulfilment.handoff_proofs
for each row execute function ops.reject_immutable_row();

create table notifications.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_principal_id uuid not null references iam.principals(id) on delete restrict,
  event_type text not null check (event_type in (
    'REQUEST_SUBMITTED', 'CLARIFICATION_REQUESTED', 'QUOTATION_SENT',
    'QUOTATION_ACCEPTED', 'PAYMENT_RECEIVED', 'PAYMENT_VERIFIED',
    'PAYMENT_REJECTED', 'PRODUCTION_STARTED', 'ORDER_READY', 'ORDER_COMPLETED'
  )),
  resource_type text not null check (resource_type in ('PROJECT', 'REQUEST', 'QUOTATION', 'ORDER')),
  resource_id uuid not null,
  title_ar text not null check (length(trim(title_ar)) between 1 and 200),
  body_ar text not null check (length(trim(body_ar)) between 1 and 1000),
  event_key text not null check (length(event_key) between 8 and 255),
  created_at timestamptz not null default clock_timestamp(),
  read_at timestamptz,
  constraint notifications_recipient_event_unique unique (recipient_principal_id, event_key)
);
create index notifications_recipient_created_idx
  on notifications.notifications(recipient_principal_id, created_at desc);

-- RLS -----------------------------------------------------------------------

alter table projects.customer_projects enable row level security;
alter table projects.project_items enable row level security;
alter table projects.product_configurations enable row level security;
alter table projects.submitted_requests enable row level security;
alter table projects.submitted_request_items enable row level security;
alter table messaging.conversations enable row level security;
alter table messaging.messages enable row level security;
alter table quotes.quotations enable row level security;
alter table quotes.quotation_revisions enable row level security;
alter table quotes.quotation_items enable row level security;
alter table quotes.quotation_responses enable row level security;
alter table quotes.customer_acceptances enable row level security;
alter table orders.orders enable row level security;
alter table orders.order_item_snapshots enable row level security;
alter table orders.order_terms_snapshots enable row level security;
alter table payments.order_payment_status enable row level security;
alter table payments.payment_submissions enable row level security;
alter table payments.payment_verifications enable row level security;
alter table production.order_production enable row level security;
alter table production.production_updates enable row level security;
alter table fulfilment.fulfilments enable row level security;
alter table fulfilment.handoff_proofs enable row level security;
alter table notifications.notifications enable row level security;

alter table projects.customer_projects force row level security;
alter table projects.project_items force row level security;
alter table projects.product_configurations force row level security;
alter table projects.submitted_requests force row level security;
alter table projects.submitted_request_items force row level security;
alter table messaging.conversations force row level security;
alter table messaging.messages force row level security;
alter table quotes.quotations force row level security;
alter table quotes.quotation_revisions force row level security;
alter table quotes.quotation_items force row level security;
alter table quotes.quotation_responses force row level security;
alter table quotes.customer_acceptances force row level security;
alter table orders.orders force row level security;
alter table orders.order_item_snapshots force row level security;
alter table orders.order_terms_snapshots force row level security;
alter table payments.order_payment_status force row level security;
alter table payments.payment_submissions force row level security;
alter table payments.payment_verifications force row level security;
alter table production.order_production force row level security;
alter table production.production_updates force row level security;
alter table fulfilment.fulfilments force row level security;
alter table fulfilment.handoff_proofs force row level security;
alter table notifications.notifications force row level security;

create policy customer_projects_customer_access on projects.customer_projects
  for all to atelier_runtime
  using (customer_id = iam.current_customer_id() or iam.current_actor_kind() = 'manager')
  with check (customer_id = iam.current_customer_id() or iam.current_actor_kind() = 'manager');
create policy project_items_actor_access on projects.project_items
  for all to atelier_runtime
  using (exists (
    select 1 from projects.customer_projects p
    where p.id = project_id and (p.customer_id = iam.current_customer_id() or iam.current_actor_kind() = 'manager')
  ))
  with check (exists (
    select 1 from projects.customer_projects p
    where p.id = project_id and (p.customer_id = iam.current_customer_id() or iam.current_actor_kind() = 'manager')
  ));
create policy product_configurations_actor_access on projects.product_configurations
  for all to atelier_runtime
  using (exists (
    select 1 from projects.project_items i join projects.customer_projects p on p.id = i.project_id
    where i.id = project_item_id and (p.customer_id = iam.current_customer_id() or iam.current_actor_kind() = 'manager')
  ))
  with check (exists (
    select 1 from projects.project_items i join projects.customer_projects p on p.id = i.project_id
    where i.id = project_item_id and (p.customer_id = iam.current_customer_id() or iam.current_actor_kind() = 'manager')
  ));
create policy submitted_requests_actor_read on projects.submitted_requests
  for select to atelier_runtime
  using (customer_id = iam.current_customer_id() or iam.current_actor_kind() = 'manager');
create policy submitted_requests_actor_insert on projects.submitted_requests
  for insert to atelier_runtime
  with check (customer_id = iam.current_customer_id() or iam.current_actor_kind() = 'manager');
create policy submitted_requests_manager_update on projects.submitted_requests
  for update to atelier_runtime
  using (iam.current_actor_kind() = 'manager' and iam.current_auth_assurance() = 'manager_mfa')
  with check (iam.current_actor_kind() = 'manager' and iam.current_auth_assurance() = 'manager_mfa');
create policy submitted_request_items_actor_read on projects.submitted_request_items
  for select to atelier_runtime
  using (exists (
    select 1 from projects.submitted_requests r
    where r.id = request_id and (r.customer_id = iam.current_customer_id() or iam.current_actor_kind() = 'manager')
  ));
create policy submitted_request_items_actor_insert on projects.submitted_request_items
  for insert to atelier_runtime
  with check (exists (
    select 1 from projects.submitted_requests r
    where r.id = request_id and (r.customer_id = iam.current_customer_id() or iam.current_actor_kind() = 'manager')
  ));

create policy conversations_actor_access on messaging.conversations
  for all to atelier_runtime
  using (customer_id = iam.current_customer_id() or iam.current_actor_kind() = 'manager')
  with check (customer_id = iam.current_customer_id() or iam.current_actor_kind() = 'manager');
create policy messages_actor_read on messaging.messages
  for select to atelier_runtime
  using (exists (
    select 1 from messaging.conversations c
    where c.id = conversation_id and (c.customer_id = iam.current_customer_id() or iam.current_actor_kind() = 'manager')
  ));
create policy messages_actor_insert on messaging.messages
  for insert to atelier_runtime
  with check (exists (
    select 1 from messaging.conversations c
    where c.id = conversation_id and (c.customer_id = iam.current_customer_id() or iam.current_actor_kind() = 'manager')
  ));

create policy quotations_actor_access on quotes.quotations
  for all to atelier_runtime
  using (customer_id = iam.current_customer_id() or iam.current_actor_kind() = 'manager')
  with check (iam.current_actor_kind() = 'manager');
create policy quotations_customer_accept_update on quotes.quotations
  for update to atelier_runtime
  using (customer_id = iam.current_customer_id())
  with check (customer_id = iam.current_customer_id() and lifecycle = 'ACCEPTED');
create policy quotation_revisions_actor_access on quotes.quotation_revisions
  for all to atelier_runtime
  using (exists (
    select 1 from quotes.quotations q
    where q.id = quotation_id and (q.customer_id = iam.current_customer_id() or iam.current_actor_kind() = 'manager')
  ))
  with check (iam.current_actor_kind() = 'manager');
create policy quotation_items_actor_access on quotes.quotation_items
  for all to atelier_runtime
  using (exists (
    select 1 from quotes.quotation_revisions r join quotes.quotations q on q.id = r.quotation_id
    where r.id = revision_id and (q.customer_id = iam.current_customer_id() or iam.current_actor_kind() = 'manager')
  ))
  with check (iam.current_actor_kind() = 'manager');
create policy quotation_responses_customer_access on quotes.quotation_responses
  for select to atelier_runtime
  using (customer_id = iam.current_customer_id() or iam.current_actor_kind() = 'manager');
create policy quotation_responses_customer_insert on quotes.quotation_responses
  for insert to atelier_runtime
  with check (customer_id = iam.current_customer_id());
create policy customer_acceptances_actor_read on quotes.customer_acceptances
  for select to atelier_runtime
  using (customer_id = iam.current_customer_id() or iam.current_actor_kind() = 'manager');
create policy customer_acceptances_customer_insert on quotes.customer_acceptances
  for insert to atelier_runtime
  with check (customer_id = iam.current_customer_id());

create policy orders_actor_read on orders.orders
  for select to atelier_runtime
  using (customer_id = iam.current_customer_id() or iam.current_actor_kind() = 'manager');
create policy orders_actor_insert on orders.orders
  for insert to atelier_runtime with check (customer_id = iam.current_customer_id());
create policy orders_customer_workflow_update on orders.orders
  for update to atelier_runtime
  using (customer_id = iam.current_customer_id())
  with check (customer_id = iam.current_customer_id());
create policy orders_manager_update on orders.orders
  for update to atelier_runtime
  using (iam.current_actor_kind() = 'manager' and iam.current_auth_assurance() = 'manager_mfa')
  with check (iam.current_actor_kind() = 'manager' and iam.current_auth_assurance() = 'manager_mfa');
create policy order_items_actor_read on orders.order_item_snapshots
  for select to atelier_runtime
  using (exists (
    select 1 from orders.orders o where o.id = order_id
      and (o.customer_id = iam.current_customer_id() or iam.current_actor_kind() = 'manager')
  ));
create policy order_items_customer_insert on orders.order_item_snapshots
  for insert to atelier_runtime
  with check (exists (
    select 1 from orders.orders o where o.id = order_id and o.customer_id = iam.current_customer_id()
  ));
create policy order_terms_actor_read on orders.order_terms_snapshots
  for select to atelier_runtime
  using (exists (
    select 1 from orders.orders o where o.id = order_id
      and (o.customer_id = iam.current_customer_id() or iam.current_actor_kind() = 'manager')
  ));
create policy order_terms_customer_insert on orders.order_terms_snapshots
  for insert to atelier_runtime
  with check (exists (
    select 1 from orders.orders o where o.id = order_id and o.customer_id = iam.current_customer_id()
  ));

create policy payment_status_actor_read on payments.order_payment_status
  for select to atelier_runtime
  using (exists (
    select 1 from orders.orders o where o.id = order_id
      and (o.customer_id = iam.current_customer_id() or iam.current_actor_kind() = 'manager')
  ));
create policy payment_status_customer_insert on payments.order_payment_status
  for insert to atelier_runtime
  with check (exists (
    select 1 from orders.orders o where o.id = order_id and o.customer_id = iam.current_customer_id()
  ));
create policy payment_status_actor_update on payments.order_payment_status
  for update to atelier_runtime
  using (exists (
    select 1 from orders.orders o where o.id = order_id
      and (o.customer_id = iam.current_customer_id() or (iam.current_actor_kind() = 'manager' and iam.current_auth_assurance() = 'manager_mfa'))
  ))
  with check (exists (
    select 1 from orders.orders o where o.id = order_id
      and (o.customer_id = iam.current_customer_id() or (iam.current_actor_kind() = 'manager' and iam.current_auth_assurance() = 'manager_mfa'))
  ));
create policy payment_submissions_actor_read on payments.payment_submissions
  for select to atelier_runtime
  using (customer_id = iam.current_customer_id() or iam.current_actor_kind() = 'manager');
create policy payment_submissions_customer_insert on payments.payment_submissions
  for insert to atelier_runtime with check (customer_id = iam.current_customer_id());
create policy payment_verifications_actor_read on payments.payment_verifications
  for select to atelier_runtime
  using (exists (
    select 1 from orders.orders o where o.id = order_id
      and (o.customer_id = iam.current_customer_id() or iam.current_actor_kind() = 'manager')
  ));
create policy payment_verifications_manager_insert on payments.payment_verifications
  for insert to atelier_runtime
  with check (iam.current_actor_kind() = 'manager' and iam.current_auth_assurance() = 'manager_mfa');

create policy production_actor_read on production.order_production
  for select to atelier_runtime
  using (exists (
    select 1 from orders.orders o where o.id = order_id
      and (o.customer_id = iam.current_customer_id() or iam.current_actor_kind() = 'manager')
  ));
create policy production_customer_insert on production.order_production
  for insert to atelier_runtime
  with check (exists (
    select 1 from orders.orders o where o.id = order_id and o.customer_id = iam.current_customer_id()
  ));
create policy production_manager_update on production.order_production
  for update to atelier_runtime
  using (iam.current_actor_kind() = 'manager' and iam.current_auth_assurance() = 'manager_mfa')
  with check (iam.current_actor_kind() = 'manager' and iam.current_auth_assurance() = 'manager_mfa');
create policy production_updates_actor_read on production.production_updates
  for select to atelier_runtime
  using (exists (
    select 1 from orders.orders o where o.id = order_id
      and (o.customer_id = iam.current_customer_id() or iam.current_actor_kind() = 'manager')
  ));
create policy production_updates_manager_insert on production.production_updates
  for insert to atelier_runtime
  with check (iam.current_actor_kind() = 'manager' and iam.current_auth_assurance() = 'manager_mfa');

create policy fulfilments_actor_read on fulfilment.fulfilments
  for select to atelier_runtime
  using (exists (
    select 1 from orders.orders o where o.id = order_id
      and (o.customer_id = iam.current_customer_id() or iam.current_actor_kind() = 'manager')
  ));
create policy fulfilments_customer_insert on fulfilment.fulfilments
  for insert to atelier_runtime
  with check (exists (
    select 1 from orders.orders o where o.id = order_id and o.customer_id = iam.current_customer_id()
  ));
create policy fulfilments_manager_update on fulfilment.fulfilments
  for update to atelier_runtime
  using (iam.current_actor_kind() = 'manager' and iam.current_auth_assurance() = 'manager_mfa')
  with check (iam.current_actor_kind() = 'manager' and iam.current_auth_assurance() = 'manager_mfa');
create policy handoff_proofs_actor_read on fulfilment.handoff_proofs
  for select to atelier_runtime
  using (exists (
    select 1 from fulfilment.fulfilments f join orders.orders o on o.id = f.order_id
    where f.id = fulfilment_id and (o.customer_id = iam.current_customer_id() or iam.current_actor_kind() = 'manager')
  ));
create policy handoff_proofs_manager_insert on fulfilment.handoff_proofs
  for insert to atelier_runtime
  with check (iam.current_actor_kind() = 'manager' and iam.current_auth_assurance() = 'manager_mfa');

create policy notifications_recipient_access on notifications.notifications
  for select to atelier_runtime
  using (recipient_principal_id = iam.current_principal_id() or iam.current_actor_kind() = 'manager');
create policy notifications_recipient_update on notifications.notifications
  for update to atelier_runtime
  using (recipient_principal_id = iam.current_principal_id())
  with check (recipient_principal_id = iam.current_principal_id());
create policy notifications_actor_insert on notifications.notifications
  for insert to atelier_runtime
  with check (iam.current_actor_kind() in ('customer', 'manager'));

-- Grants --------------------------------------------------------------------

grant usage on schema projects, quotes, orders, payments, production, fulfilment,
  messaging, notifications to atelier_runtime, atelier_job;

grant select, insert, update, delete on projects.customer_projects,
  projects.project_items, projects.product_configurations to atelier_runtime;
grant select, insert, update on projects.submitted_requests to atelier_runtime;
grant select, insert on projects.submitted_request_items to atelier_runtime;
grant select, insert on messaging.conversations, messaging.messages to atelier_runtime;
grant select, insert, update on quotes.quotations, quotes.quotation_revisions,
  quotes.quotation_items to atelier_runtime;
grant delete on quotes.quotation_items to atelier_runtime;
grant select, insert on quotes.quotation_responses, quotes.customer_acceptances to atelier_runtime;
grant select, insert, update on orders.orders to atelier_runtime;
grant select, insert on orders.order_item_snapshots, orders.order_terms_snapshots to atelier_runtime;
grant select, insert, update on payments.order_payment_status to atelier_runtime;
grant select, insert on payments.payment_submissions, payments.payment_verifications to atelier_runtime;
grant select, insert, update on production.order_production to atelier_runtime;
grant select, insert on production.production_updates to atelier_runtime;
grant select, insert, update on fulfilment.fulfilments to atelier_runtime;
grant select, insert on fulfilment.handoff_proofs to atelier_runtime;
grant select, insert, update on notifications.notifications to atelier_runtime;

revoke truncate on all tables in schema projects, quotes, orders, payments, production,
  fulfilment, messaging, notifications from atelier_runtime, atelier_job;
revoke delete on projects.submitted_requests, projects.submitted_request_items,
  messaging.messages, quotes.quotation_revisions, quotes.quotation_responses,
  quotes.customer_acceptances, orders.orders, orders.order_item_snapshots,
  orders.order_terms_snapshots, payments.order_payment_status,
  payments.payment_submissions, payments.payment_verifications,
  production.order_production, production.production_updates,
  fulfilment.fulfilments, fulfilment.handoff_proofs, notifications.notifications
  from atelier_runtime;
revoke create on schema projects, quotes, orders, payments, production, fulfilment,
  messaging, notifications from atelier_runtime, atelier_job,
  atelier_operations_readonly, atelier_identity_resolver;

comment on schema projects is 'Customer Projects and immutable submitted request history';
comment on schema quotes is 'Versioned quotations and customer acceptance';
comment on schema orders is 'Immutable accepted commercial Order history';
comment on schema payments is 'Bank-transfer proof and manual Manager decisions';
comment on schema production is 'Order-level production progress';
comment on schema fulfilment is 'Accepted pickup/delivery handoff';
comment on schema messaging is 'Continuous Customer and Manager conversation';
comment on schema notifications is 'Essential in-app business notifications';
