-- Restore the quotation-decline notification function if deployed schema drift removed it
select pg_advisory_xact_lock(hashtextextended('project-atelier:restore-quotation-decline-notification-v1', 0));

create or replace function notifications.notify_managers_of_quotation_decline(
  quotation_id_input uuid,
  revision_id_input uuid,
  reason_input text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, iam, quotes, notifications
as $$
begin
  if iam.current_actor_kind() <> 'customer'
     or not exists (
       select 1
       from quotes.quotations q
       join quotes.quotation_responses response
         on response.revision_id = revision_id_input
        and response.customer_id = q.customer_id
        and response.outcome = 'DECLINED'
        and response.reason = reason_input
       where q.id = quotation_id_input
         and q.current_sent_revision_id = revision_id_input
         and q.customer_id = iam.current_customer_id()
         and q.lifecycle = 'DECLINED'
     )
  then
    raise exception using errcode = '42501', message = 'invalid quotation decline notification';
  end if;

  insert into notifications.notifications
    (recipient_principal_id, event_type, resource_type, resource_id,
     title_ar, body_ar, event_key)
  select manager.principal_id, 'QUOTATION_DECLINED', 'QUOTATION', quotation_id_input,
         'رفض العميل عرض السعر', reason_input,
         'quotation:' || revision_id_input::text || ':declined'
  from iam.managers manager
  where manager.is_active
  on conflict (recipient_principal_id, event_key) do nothing;
end
$$;

revoke all on function notifications.notify_managers_of_quotation_decline(uuid, uuid, text)
  from public;
grant execute on function notifications.notify_managers_of_quotation_decline(uuid, uuid, text)
  to atelier_runtime;
