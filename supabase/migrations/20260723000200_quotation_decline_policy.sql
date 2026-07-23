-- Allow a customer to decline only their own currently sent quotation
select pg_advisory_xact_lock(hashtextextended('project-atelier:quotation-decline-policy-v1', 0));

drop policy if exists quotations_customer_decline_update on quotes.quotations;
create policy quotations_customer_decline_update on quotes.quotations
  for update to atelier_runtime
  using (
    customer_id = iam.current_customer_id()
    and lifecycle = 'SENT'
  )
  with check (
    customer_id = iam.current_customer_id()
    and lifecycle = 'DECLINED'
  );
