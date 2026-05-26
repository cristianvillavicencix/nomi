-- =====================================================================
-- Fase 1 — Activación de Deals + Sync con Anti-Olvido
-- =====================================================================
-- Objetivo: cerrar el loop Lead -> Cliente -> Deal sin romper el sistema
-- Anti-Olvido (lead_attention) recién instalado.
--
-- Cambios:
--   1. deals.converted_from_contact_id (audit trail del lead origen)
--   2. function sync_deal_stage_to_contact_lead_stage()
--      mapea deal.stage -> contacts.lead_stage y maneja snooze_until
--   3. trigger trg_sync_deal_to_lead_stage en deals (AFTER INSERT OR UPDATE)
--
-- Política de mapping (deal.stage -> contact.lead_stage):
--   won, closed_won   -> 'won'    + snooze_until = '2099-12-31'
--   closed_lost       -> 'lost'   + snooze_until = '2099-12-31'
--   proposal_sent     -> 'quoted' (sin tocar snooze_until)
--   discovery         -> 'talking'(sin tocar snooze_until)
--   otros             -> sin cambios (preserva lead_stage actual)
--
-- Notas de seguridad:
--   - El trigger es AFTER (no BEFORE), no afecta la fila del deal.
--   - Si deal.contact_id es NULL, el trigger es no-op (return new).
--   - WHERE clause evita UPDATEs redundantes (no loop).
--   - No reemplaza otros triggers existentes en deals o contacts.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Audit column: deals.converted_from_contact_id
-- ---------------------------------------------------------------------
alter table public.deals
  add column if not exists converted_from_contact_id bigint
    references public.contacts(id) on delete set null;

create index if not exists idx_deals_converted_from_contact_id
  on public.deals (converted_from_contact_id)
  where converted_from_contact_id is not null;

comment on column public.deals.converted_from_contact_id is
  'Audit trail: contacts.id del lead que generó este deal al ser convertido a cliente. NULL para deals creados por otras vías (form, manual desde admin, accept_proposal).';

-- ---------------------------------------------------------------------
-- 2. Función de sincronización deal.stage -> contact.lead_stage
-- ---------------------------------------------------------------------
create or replace function public.sync_deal_stage_to_contact_lead_stage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_lead_stage text;
  v_should_freeze     boolean;
begin
  -- Skip si el deal no está atado a un contact concreto.
  if new.contact_id is null then
    return new;
  end if;

  -- Solo procesar si stage realmente cambió (o es INSERT, donde OLD es NULL).
  if TG_OP = 'UPDATE' and new.stage is not distinct from old.stage then
    return new;
  end if;

  -- Calcular target lead_stage según el deal.stage actual.
  v_target_lead_stage := case new.stage
    when 'won'           then 'won'
    when 'closed_won'    then 'won'
    when 'closed_lost'   then 'lost'
    when 'proposal_sent' then 'quoted'
    when 'discovery'     then 'talking'
    else null  -- valor null -> no cambia lead_stage en el UPDATE
  end;

  v_should_freeze := new.stage in ('won', 'closed_won', 'closed_lost');

  -- UPDATE solo si hay algo nuevo que aplicar.
  -- v_target_lead_stage IS NULL significa "no remapear" (stage no monitoreado).
  update public.contacts c
  set
    lead_stage = coalesce(v_target_lead_stage, c.lead_stage),
    snooze_until = case
      when v_should_freeze then '2099-12-31 00:00:00+00'::timestamptz
      else c.snooze_until
    end
  where c.id = new.contact_id
    and (
      -- Cambio en lead_stage:
      (v_target_lead_stage is not null
       and c.lead_stage is distinct from v_target_lead_stage)
      -- O cambio en snooze_until (deal cerrado):
      or (v_should_freeze
          and c.snooze_until is distinct from '2099-12-31 00:00:00+00'::timestamptz)
    );

  return new;
end;
$$;

comment on function public.sync_deal_stage_to_contact_lead_stage() is
  'Mantiene contacts.lead_stage y contacts.snooze_until coherentes con el deal.stage. Llamado por trg_sync_deal_to_lead_stage. Idempotente y libre de loops (WHERE clause evita UPDATEs no-op).';

-- ---------------------------------------------------------------------
-- 3. Trigger en deals
-- ---------------------------------------------------------------------
drop trigger if exists trg_sync_deal_to_lead_stage on public.deals;

create trigger trg_sync_deal_to_lead_stage
  after insert or update on public.deals
  for each row
  execute function public.sync_deal_stage_to_contact_lead_stage();

-- =====================================================================
-- FIN Fase 1 migration
-- =====================================================================
