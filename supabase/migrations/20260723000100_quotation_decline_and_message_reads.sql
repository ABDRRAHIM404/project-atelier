-- Quotation decline reliability and per-recipient message read state
select pg_advisory_xact_lock(hashtextextended('project-atelier:quotation-decline-message-reads-v1', 0));

alter table notifications.notifications
  drop constraint if exists notifications_event_type_check,
  add constraint notifications_event_type_check check (event_type in (
    'REQUEST_SUBMITTED', 'CLARIFICATION_REQUESTED', 'QUOTATION_SENT',
    'QUOTATION_ACCEPTED', 'QUOTATION_DECLINED', 'PAYMENT_RECEIVED',
    'PAYMENT_VERIFIED', 'PAYMENT_REJECTED', 'PRODUCTION_STARTED',
    'ORDER_READY', 'ORDER_COMPLETED', 'REQUEST_CANCELLED', 'ORDER_CANCELLED'
  ));

alter table messaging.conversations
  add column if not exists customer_last_read_at timestamptz,
  add column if not exists manager_last_read_at timestamptz;

grant update on messaging.conversations to atelier_runtime;
