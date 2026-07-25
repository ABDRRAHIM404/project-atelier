-- Restore lifecycle-only cancellation after hosted-payment transition changes.
select pg_advisory_xact_lock(hashtextextended('project-atelier:cancellation-lifecycle-consistency-v1', 0));

create or replace function orders.guard_order_transition()
returns trigger
language plpgsql
set search_path = pg_catalog, payments, iam
as $$
begin
  if new.lifecycle_state = old.lifecycle_state then return new; end if;
  if not (
    (new.lifecycle_state = 'CANCELLED' and old.lifecycle_state not in ('COMPLETED', 'CANCELLED'))
    or (old.lifecycle_state = 'AWAITING_PAYMENT' and new.lifecycle_state = 'PAYMENT_UNDER_REVIEW')
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

drop policy if exists submitted_requests_customer_cancel_update on projects.submitted_requests;
create policy submitted_requests_customer_cancel_update on projects.submitted_requests
for update to atelier_runtime
using (
  customer_id = iam.current_customer_id()
  and state not in ('CANCELLED', 'REJECTED', 'COMPLETED')
  and not exists (
    select 1
    from quotes.quotations quotation
    join quotes.quotation_revisions revision
      on revision.quotation_id = quotation.id
    join orders.orders existing_order
      on existing_order.accepted_revision_id = revision.id
    where quotation.submitted_request_id = projects.submitted_requests.id
  )
)
with check (
  customer_id = iam.current_customer_id()
  and state = 'CANCELLED'
  and cancelled_by = 'CUSTOMER'
  and cancelled_at is not null
  and cancellation_reason is not null
);

comment on function orders.guard_order_transition() is
  'Allows lifecycle-only cancellation from every non-terminal Order state while preserving verified-payment production gates';
