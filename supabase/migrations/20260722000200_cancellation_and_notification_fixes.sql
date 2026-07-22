-- Cancellation reliability and notification lifecycle forward fix
select pg_advisory_xact_lock(hashtextextended('project-atelier:cancellation-notification-fixes-v1', 0));

alter table notifications.notifications
  drop constraint if exists notifications_event_type_check,
  add constraint notifications_event_type_check check (event_type in (
    'REQUEST_SUBMITTED', 'CLARIFICATION_REQUESTED', 'QUOTATION_SENT',
    'QUOTATION_ACCEPTED', 'PAYMENT_RECEIVED', 'PAYMENT_VERIFIED',
    'PAYMENT_REJECTED', 'PRODUCTION_STARTED', 'ORDER_READY', 'ORDER_COMPLETED',
    'REQUEST_CANCELLED', 'ORDER_CANCELLED'
  ));

drop policy if exists request_activity_customer_insert on projects.request_activity;
create policy request_activity_customer_insert on projects.request_activity
for insert
with check (
  actor_kind = 'CUSTOMER'
  and actor_principal_id = iam.current_principal_id()
  and exists (
    select 1
    from projects.submitted_requests request
    where request.id = request_id
      and request.customer_id = iam.current_customer_id()
  )
);

grant select, insert on projects.request_activity to atelier_runtime;
