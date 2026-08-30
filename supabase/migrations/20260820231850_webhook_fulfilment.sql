-- Payment webhook fulfilment: confirm the sale here, never on the
-- browser redirect (which can be forged, lost, or double-fired).
--
-- fulfil_order_from_webhook() is the only place order.status moves to
-- 'paid'. It locks the order row (FOR UPDATE) before deciding anything,
-- so a duplicate webhook delivery arriving concurrently with the first
-- can't both act on a stale status. It re-reads total_cents/currency
-- from the row itself -- the caller passes in what the *webhook* payload
-- says was charged, and this function is what actually compares the two
-- and refuses to fulfil on a mismatch.

-- A session id belongs to exactly one order.
create unique index orders_payment_provider_session_id_unique_idx
  on orders (payment_provider, payment_provider_session_id)
  where payment_provider_session_id is not null;

create or replace function fulfil_order_from_webhook(
  p_order_id uuid,
  p_amount_cents integer,
  p_currency text
)
returns text
language plpgsql
as $$
declare
  v_status text;
  v_total_cents integer;
  v_currency text;
begin
  select status, total_cents, currency
    into v_status, v_total_cents, v_currency
  from orders
  where id = p_order_id
  for update;

  if not found then
    return 'order_not_found';
  end if;

  if v_status in ('paid', 'fulfilled') then
    -- Already handled by an earlier delivery of this or another event
    -- for the same order. Idempotent no-op, not an error.
    return 'already_fulfilled';
  end if;

  if v_status in ('cancelled', 'expired') then
    -- The reservation already lapsed (or was cancelled) by the time this
    -- webhook arrived. Money may have moved on the provider's side; that
    -- is a manual-refund situation, not something this function can fix
    -- by itself (the stock this order held may already be resold).
    return 'order_not_payable';
  end if;

  if v_total_cents <> p_amount_cents or v_currency <> p_currency then
    return 'amount_mismatch';
  end if;

  update orders set status = 'paid' where id = p_order_id;

  update stock_reservations
  set status = 'consumed'
  where order_id = p_order_id
    and status = 'active';

  if not found then
    -- Extremely narrow race: the reservation expired and was released
    -- (see release_expired_reservations()) in between this order being
    -- created and this webhook being processed, despite the order still
    -- being 'pending' a moment ago in this same transaction. The order
    -- is still marked paid below -- the customer was charged -- but this
    -- is flagged distinctly so it surfaces in webhook_events for manual
    -- reconciliation instead of silently drifting.
    return 'paid_but_reservation_lost';
  end if;

  return 'fulfilled';
end;
$$;

revoke all on function fulfil_order_from_webhook(uuid, integer, text) from public;
grant execute on function fulfil_order_from_webhook(uuid, integer, text) to service_role;
