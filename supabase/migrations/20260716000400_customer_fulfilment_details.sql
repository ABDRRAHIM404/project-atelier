begin;

alter table fulfilment.fulfilments
  add column customer_details_confirmed_at timestamptz,
  add constraint fulfilments_customer_details_shape check (
    customer_details_confirmed_at is null
    or (
      accepted_method = 'PICKUP'
      and length(trim(coalesce(accepted_snapshot->>'phoneNumber', ''))) between 7 and 30
    )
    or (
      accepted_method = 'DELIVERY'
      and length(trim(coalesce(accepted_snapshot->>'city', ''))) between 2 and 120
      and length(trim(coalesce(accepted_snapshot->>'district', ''))) between 2 and 160
      and length(trim(coalesce(accepted_snapshot->>'address', ''))) between 5 and 500
      and length(trim(coalesce(accepted_snapshot->>'phoneNumber', ''))) between 7 and 30
    )
  );

create function fulfilment.guard_customer_details_update()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, iam, orders, payments
as $$
begin
  if iam.current_actor_kind() <> 'customer' then
    return new;
  end if;

  if not exists (
    select 1 from orders.orders o
    where o.id = old.order_id and o.customer_id = iam.current_customer_id()
      and o.lifecycle_state in ('AWAITING_PAYMENT', 'PAYMENT_UNDER_REVIEW')
  ) then
    raise exception using errcode = '42501', message = 'customer cannot update fulfilment details';
  end if;

  if exists (select 1 from payments.payment_submissions p where p.order_id = old.order_id) then
    raise exception using errcode = '23514', message = 'fulfilment details cannot change after payment submission';
  end if;

  if new.id <> old.id
     or new.order_id <> old.order_id
     or new.state <> old.state
     or new.ready_at is distinct from old.ready_at
     or new.handoff_at is distinct from old.handoff_at then
    raise exception using errcode = '42501', message = 'customer update changed protected fulfilment fields';
  end if;

  return new;
end
$$;

create trigger fulfilment_customer_details_guard
before update on fulfilment.fulfilments
for each row execute function fulfilment.guard_customer_details_update();

create policy fulfilments_customer_update on fulfilment.fulfilments
  for update to atelier_runtime
  using (exists (
    select 1 from orders.orders o
    where o.id = order_id and o.customer_id = iam.current_customer_id()
  ))
  with check (exists (
    select 1 from orders.orders o
    where o.id = order_id and o.customer_id = iam.current_customer_id()
  ));

comment on column fulfilment.fulfilments.customer_details_confirmed_at is
  'Customer confirmation timestamp for delivery or pickup details; required before payment proof submission.';

commit;
