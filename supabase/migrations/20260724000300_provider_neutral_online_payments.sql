-- Provider-neutral hosted checkout. Historical bank-transfer evidence remains immutable.
select pg_advisory_xact_lock(hashtextextended('project-atelier:provider-neutral-online-payments-v1', 0));

create table payments.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders.orders(id) on delete restrict,
  customer_id uuid not null references iam.customers(id) on delete restrict,
  provider_code text not null check (provider_code ~ '^[a-z][a-z0-9_]{1,31}$'),
  merchant_reference text not null check (length(merchant_reference) between 8 and 128),
  idempotency_key text not null check (length(idempotency_key) between 8 and 128),
  amount_minor bigint not null check (amount_minor > 0),
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  status text not null default 'CREATED' check (status in (
    'CREATED', 'PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED'
  )),
  safe_failure_code text check (
    safe_failure_code is null or safe_failure_code ~ '^[A-Z][A-Z0-9_]{2,95}$'
  ),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint payment_attempt_merchant_reference_unique unique (provider_code, merchant_reference),
  constraint payment_attempt_idempotency_unique unique (customer_id, order_id, idempotency_key)
);
create index payment_attempts_order_created_idx
  on payments.payment_attempts(order_id, created_at desc);

create table payments.checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  payment_attempt_id uuid not null references payments.payment_attempts(id) on delete restrict,
  provider_code text not null check (provider_code ~ '^[a-z][a-z0-9_]{1,31}$'),
  provider_session_id text not null check (length(provider_session_id) between 1 and 255),
  checkout_url text not null check (
    length(checkout_url) between 12 and 2048 and checkout_url ~ '^https://'
  ),
  status text not null default 'ACTIVE' check (status in (
    'ACTIVE', 'COMPLETED', 'FAILED', 'CANCELLED', 'EXPIRED'
  )),
  expires_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint checkout_session_provider_unique unique (provider_code, provider_session_id)
);
create index checkout_sessions_attempt_created_idx
  on payments.checkout_sessions(payment_attempt_id, created_at desc);

create table payments.gateway_transactions (
  id uuid primary key default gen_random_uuid(),
  payment_attempt_id uuid not null references payments.payment_attempts(id) on delete restrict,
  order_id uuid not null references orders.orders(id) on delete restrict,
  provider_code text not null check (provider_code ~ '^[a-z][a-z0-9_]{1,31}$'),
  provider_transaction_id text not null check (length(provider_transaction_id) between 1 and 255),
  payment_method text not null check (payment_method in (
    'MADA', 'VISA', 'MASTERCARD', 'APPLE_PAY', 'UNKNOWN'
  )),
  amount_minor bigint not null check (amount_minor > 0),
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  status text not null check (status in ('SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED')),
  provider_event_id uuid not null references ops.inbound_provider_events(id) on delete restrict,
  provider_occurred_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  constraint gateway_transaction_provider_unique unique (provider_code, provider_transaction_id)
);
create index gateway_transactions_order_created_idx
  on payments.gateway_transactions(order_id, created_at desc);

alter table payments.order_payment_status
  drop constraint if exists order_payment_status_current_state_check,
  alter column current_state set default 'AWAITING_PAYMENT',
  add column active_attempt_id uuid references payments.payment_attempts(id) on delete restrict,
  add column verified_transaction_id uuid
    references payments.gateway_transactions(id) on delete restrict,
  add column verification_source text check (
    verification_source in ('MANUAL_TRANSFER', 'PROVIDER_WEBHOOK')
  ),
  add constraint order_payment_status_current_state_check check (current_state in (
    'AWAITING_PAYMENT', 'CHECKOUT_PENDING', 'PROCESSING', 'FAILED', 'CANCELLED', 'EXPIRED',
    'AWAITING_SUBMISSION', 'SUBMITTED', 'REJECTED', 'VERIFIED'
  ));

update payments.order_payment_status
set verification_source = 'MANUAL_TRANSFER'
where current_state = 'VERIFIED' and verified_decision_id is not null;

alter table payments.order_payment_status
  add constraint order_payment_status_verification_shape check (
    (
      current_state = 'VERIFIED'
      and (
        (
          verification_source = 'MANUAL_TRANSFER'
          and verified_decision_id is not null
          and verified_transaction_id is null
        )
        or
        (
          verification_source = 'PROVIDER_WEBHOOK'
          and verified_transaction_id is not null
          and verified_decision_id is null
        )
      )
    )
    or
    (
      current_state <> 'VERIFIED'
      and verification_source is null
      and verified_transaction_id is null
      and verified_decision_id is null
    )
  );

create or replace function payments.guard_payment_transition()
returns trigger
language plpgsql
set search_path = pg_catalog, iam
as $$
begin
  if new.current_state = old.current_state then return new; end if;
  if not (
    (old.current_state in ('AWAITING_PAYMENT', 'AWAITING_SUBMISSION', 'REJECTED',
                           'FAILED', 'CANCELLED', 'EXPIRED')
      and new.current_state = 'CHECKOUT_PENDING')
    or (old.current_state in ('AWAITING_SUBMISSION', 'SUBMITTED', 'REJECTED')
      and new.current_state = 'AWAITING_PAYMENT')
    or (old.current_state = 'CHECKOUT_PENDING'
      and new.current_state in ('PROCESSING', 'VERIFIED', 'FAILED', 'CANCELLED', 'EXPIRED'))
    or (old.current_state = 'PROCESSING'
      and new.current_state in ('VERIFIED', 'FAILED', 'CANCELLED', 'EXPIRED'))
    -- Historical transitions remain structurally valid, but no active HTTP route exposes them.
    or (old.current_state in ('AWAITING_SUBMISSION', 'REJECTED') and new.current_state = 'SUBMITTED')
    or (old.current_state = 'SUBMITTED' and new.current_state in ('REJECTED', 'VERIFIED'))
  ) then
    raise exception using errcode = '23514', message = 'forbidden Payment transition';
  end if;
  if new.current_state = 'VERIFIED'
    and iam.current_actor_kind() <> 'provider_webhook'
    and not (
      iam.current_actor_kind() = 'manager'
      and iam.current_auth_assurance() = 'manager_mfa'
      and new.verification_source = 'MANUAL_TRANSFER'
    )
  then
    raise exception using errcode = '42501', message = 'verified Payment requires a trusted verifier';
  end if;
  new.updated_at := clock_timestamp();
  new.record_version := old.record_version + 1;
  return new;
end
$$;

create function payments.guard_payment_attempt_update()
returns trigger
language plpgsql
set search_path = pg_catalog, iam
as $$
begin
  if new.id <> old.id
    or new.order_id <> old.order_id
    or new.customer_id <> old.customer_id
    or new.provider_code <> old.provider_code
    or new.merchant_reference <> old.merchant_reference
    or new.idempotency_key <> old.idempotency_key
    or new.amount_minor <> old.amount_minor
    or new.currency_code <> old.currency_code
    or new.created_at <> old.created_at
  then
    raise exception using errcode = '55000', message = 'Payment Attempt identity is immutable';
  end if;
  if new.status <> old.status and not (
    (old.status = 'CREATED' and new.status in ('PENDING', 'FAILED'))
    or (old.status = 'PENDING' and new.status in ('SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED'))
  ) then
    raise exception using errcode = '23514', message = 'forbidden Payment Attempt transition';
  end if;
  if new.status in ('SUCCEEDED', 'CANCELLED', 'EXPIRED')
    and iam.current_actor_kind() <> 'provider_webhook'
  then
    raise exception using errcode = '42501', message = 'provider webhook is required';
  end if;
  new.updated_at := clock_timestamp();
  return new;
end
$$;
create trigger payment_attempt_update_guard
before update on payments.payment_attempts
for each row execute function payments.guard_payment_attempt_update();

create function payments.guard_checkout_session_update()
returns trigger
language plpgsql
set search_path = pg_catalog, iam
as $$
begin
  if new.id <> old.id
    or new.payment_attempt_id <> old.payment_attempt_id
    or new.provider_code <> old.provider_code
    or new.provider_session_id <> old.provider_session_id
    or new.checkout_url <> old.checkout_url
    or new.expires_at is distinct from old.expires_at
    or new.created_at <> old.created_at
  then
    raise exception using errcode = '55000', message = 'Checkout Session identity is immutable';
  end if;
  if iam.current_actor_kind() <> 'provider_webhook'
    or not (
      old.status = 'ACTIVE'
      and new.status in ('COMPLETED', 'FAILED', 'CANCELLED', 'EXPIRED')
    )
  then
    raise exception using errcode = '42501', message = 'provider webhook is required';
  end if;
  new.updated_at := clock_timestamp();
  return new;
end
$$;
create trigger checkout_session_update_guard
before update on payments.checkout_sessions
for each row execute function payments.guard_checkout_session_update();

create trigger gateway_transactions_immutable
before update or delete on payments.gateway_transactions
for each row execute function ops.reject_immutable_row();

create or replace function orders.guard_order_transition()
returns trigger
language plpgsql
set search_path = pg_catalog, payments, iam
as $$
begin
  if new.lifecycle_state = old.lifecycle_state then return new; end if;
  if not (
    (old.lifecycle_state = 'AWAITING_PAYMENT' and new.lifecycle_state = 'PAYMENT_UNDER_REVIEW')
    or (
      old.lifecycle_state = 'AWAITING_PAYMENT'
      and new.lifecycle_state = 'PAYMENT_VERIFIED'
      and iam.current_actor_kind() = 'provider_webhook'
      and exists (
        select 1 from payments.order_payment_status
        where order_id = new.id
          and current_state = 'VERIFIED'
          and verification_source = 'PROVIDER_WEBHOOK'
          and verified_transaction_id is not null
      )
    )
    or (old.lifecycle_state = 'PAYMENT_UNDER_REVIEW'
      and new.lifecycle_state in ('AWAITING_PAYMENT', 'PAYMENT_VERIFIED'))
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

create or replace function production.guard_production_transition()
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
    where order_id = new.order_id
      and current_state = 'VERIFIED'
      and (
        (verification_source = 'MANUAL_TRANSFER' and verified_decision_id is not null)
        or
        (verification_source = 'PROVIDER_WEBHOOK' and verified_transaction_id is not null)
      )
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

-- Retire unfinished manual-review state without deleting its immutable evidence.
update payments.order_payment_status
set current_state = 'AWAITING_PAYMENT',
    current_submission_id = null,
    verified_decision_id = null,
    verification_source = null
where current_state in ('AWAITING_SUBMISSION', 'SUBMITTED', 'REJECTED');

update orders.orders
set lifecycle_state = 'AWAITING_PAYMENT'
where lifecycle_state = 'PAYMENT_UNDER_REVIEW';

alter table notifications.notifications
  drop constraint if exists notifications_event_type_check,
  add constraint notifications_event_type_check check (event_type in (
    'REQUEST_SUBMITTED', 'CLARIFICATION_REQUESTED', 'QUOTATION_SENT',
    'QUOTATION_ACCEPTED', 'QUOTATION_DECLINED', 'PAYMENT_RECEIVED',
    'PAYMENT_VERIFIED', 'PAYMENT_REJECTED', 'PAYMENT_FAILED',
    'PAYMENT_CANCELLED', 'PAYMENT_EXPIRED', 'PRODUCTION_STARTED',
    'ORDER_READY', 'ORDER_COMPLETED', 'REQUEST_CANCELLED', 'ORDER_CANCELLED'
  ));

create function notifications.notify_online_payment_result(
  requested_order_id uuid,
  requested_event_type text,
  requested_event_key text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  customer_principal_id uuid;
  title_text text;
  body_text text;
begin
  if iam.current_actor_kind() <> 'provider_webhook'
    or iam.current_auth_assurance() <> 'provider_signature'
  then
    raise exception using errcode = '42501', message = 'verified provider webhook required';
  end if;
  if requested_event_type not in (
    'PAYMENT_VERIFIED', 'PAYMENT_FAILED', 'PAYMENT_CANCELLED', 'PAYMENT_EXPIRED'
  ) then
    raise exception using errcode = '22023', message = 'unsupported payment notification';
  end if;

  select customer.principal_id
  into customer_principal_id
  from orders.orders as ordered
  join iam.customers as customer on customer.id = ordered.customer_id
  where ordered.id = requested_order_id;
  if customer_principal_id is null then
    raise exception using errcode = 'P0002', message = 'Order not found';
  end if;

  title_text := case requested_event_type
    when 'PAYMENT_VERIFIED' then 'تم الدفع بنجاح'
    when 'PAYMENT_FAILED' then 'لم تكتمل عملية الدفع'
    when 'PAYMENT_CANCELLED' then 'أُلغيت عملية الدفع'
    else 'انتهت صلاحية عملية الدفع'
  end;
  body_text := case requested_event_type
    when 'PAYMENT_VERIFIED' then 'تم تأكيد الدفع ويمكن الآن بدء تنفيذ الطلب.'
    else 'لا يزال الطلب بانتظار الدفع ويمكنك المحاولة مرة أخرى.'
  end;

  insert into notifications.notifications
    (recipient_principal_id, event_type, resource_type, resource_id,
     title_ar, body_ar, event_key)
  values
    (customer_principal_id, requested_event_type, 'ORDER', requested_order_id,
     title_text, body_text, requested_event_key)
  on conflict (recipient_principal_id, event_key) do nothing;

  if requested_event_type = 'PAYMENT_VERIFIED' then
    insert into notifications.notifications
      (recipient_principal_id, event_type, resource_type, resource_id,
       title_ar, body_ar, event_key)
    select manager.principal_id, requested_event_type, 'ORDER', requested_order_id,
           'تم دفع طلب', 'تم تأكيد الدفع الإلكتروني للطلب.', requested_event_key
    from iam.managers as manager
    where manager.is_active
    on conflict (recipient_principal_id, event_key) do nothing;
  end if;
end
$$;
revoke all on function notifications.notify_online_payment_result(uuid, text, text) from public;
grant execute on function notifications.notify_online_payment_result(uuid, text, text)
  to atelier_runtime;

alter table payments.payment_attempts enable row level security;
alter table payments.checkout_sessions enable row level security;
alter table payments.gateway_transactions enable row level security;
alter table payments.payment_attempts force row level security;
alter table payments.checkout_sessions force row level security;
alter table payments.gateway_transactions force row level security;

drop policy if exists payment_status_actor_update on payments.order_payment_status;
create policy payment_status_provider_read on payments.order_payment_status
  for select to atelier_runtime
  using (iam.current_actor_kind() = 'provider_webhook');
create policy payment_status_customer_checkout_update on payments.order_payment_status
  for update to atelier_runtime
  using (exists (
    select 1 from orders.orders as ordered
    where ordered.id = order_id and ordered.customer_id = iam.current_customer_id()
  ))
  with check (
    current_state in ('CHECKOUT_PENDING', 'FAILED')
    and verification_source is null
    and verified_transaction_id is null
    and verified_decision_id is null
    and exists (
      select 1 from orders.orders as ordered
      where ordered.id = order_id and ordered.customer_id = iam.current_customer_id()
    )
  );
create policy payment_status_provider_update on payments.order_payment_status
  for update to atelier_runtime
  using (iam.current_actor_kind() = 'provider_webhook')
  with check (iam.current_actor_kind() = 'provider_webhook');

create policy payment_attempts_actor_read on payments.payment_attempts
  for select to atelier_runtime
  using (
    customer_id = iam.current_customer_id()
    or iam.current_actor_kind() in ('manager', 'provider_webhook', 'operator')
  );
create policy payment_attempts_customer_insert on payments.payment_attempts
  for insert to atelier_runtime
  with check (
    customer_id = iam.current_customer_id()
    and status = 'CREATED'
    and exists (
      select 1 from orders.orders as ordered
      where ordered.id = order_id
        and ordered.customer_id = iam.current_customer_id()
        and ordered.accepted_total_minor = amount_minor
        and ordered.currency_code = currency_code
        and ordered.lifecycle_state = 'AWAITING_PAYMENT'
    )
  );
create policy payment_attempts_customer_update on payments.payment_attempts
  for update to atelier_runtime
  using (customer_id = iam.current_customer_id() and status = 'CREATED')
  with check (customer_id = iam.current_customer_id() and status in ('PENDING', 'FAILED'));
create policy payment_attempts_provider_update on payments.payment_attempts
  for update to atelier_runtime
  using (iam.current_actor_kind() = 'provider_webhook')
  with check (iam.current_actor_kind() = 'provider_webhook');

create policy checkout_sessions_actor_read on payments.checkout_sessions
  for select to atelier_runtime
  using (exists (
    select 1 from payments.payment_attempts as attempt
    where attempt.id = payment_attempt_id
      and (
        attempt.customer_id = iam.current_customer_id()
        or iam.current_actor_kind() in ('manager', 'provider_webhook', 'operator')
      )
  ));
create policy checkout_sessions_customer_insert on payments.checkout_sessions
  for insert to atelier_runtime
  with check (status = 'ACTIVE' and exists (
    select 1 from payments.payment_attempts as attempt
    where attempt.id = payment_attempt_id
      and attempt.customer_id = iam.current_customer_id()
      and attempt.provider_code = provider_code
      and attempt.status = 'CREATED'
  ));
create policy checkout_sessions_provider_update on payments.checkout_sessions
  for update to atelier_runtime
  using (iam.current_actor_kind() = 'provider_webhook')
  with check (iam.current_actor_kind() = 'provider_webhook');

create policy gateway_transactions_actor_read on payments.gateway_transactions
  for select to atelier_runtime
  using (exists (
    select 1 from payments.payment_attempts as attempt
    where attempt.id = payment_attempt_id
      and (
        attempt.customer_id = iam.current_customer_id()
        or iam.current_actor_kind() in ('manager', 'provider_webhook', 'operator')
      )
  ));
create policy gateway_transactions_provider_insert on payments.gateway_transactions
  for insert to atelier_runtime
  with check (iam.current_actor_kind() = 'provider_webhook');

create policy orders_provider_payment_update on orders.orders
  for update to atelier_runtime
  using (iam.current_actor_kind() = 'provider_webhook' and lifecycle_state = 'AWAITING_PAYMENT')
  with check (
    iam.current_actor_kind() = 'provider_webhook'
    and lifecycle_state = 'PAYMENT_VERIFIED'
  );
create policy orders_provider_payment_read on orders.orders
  for select to atelier_runtime
  using (iam.current_actor_kind() = 'provider_webhook');

grant select, insert, update on payments.payment_attempts,
  payments.checkout_sessions to atelier_runtime;
grant select, insert on payments.gateway_transactions to atelier_runtime;
revoke delete on payments.payment_attempts, payments.checkout_sessions,
  payments.gateway_transactions from atelier_runtime, atelier_job;

comment on schema payments is
  'Provider-neutral hosted checkout plus immutable historical bank-transfer evidence';
comment on table payments.payment_attempts is
  'Authoritative Order amount copied for each hosted-checkout attempt; never card data';
comment on table payments.checkout_sessions is
  'Private hosted-checkout redirects; URLs must never be exposed outside the owning actor';
comment on table payments.gateway_transactions is
  'Immutable normalized transaction facts accepted only from verified provider webhooks';
