-- Fix DM/conversation creation failing with 42501 (RLS) on INSERT ... RETURNING.
--
-- PostgREST issues INSERTs with `Prefer: return=representation`, which forces
-- Postgres to re-evaluate the SELECT (USING) policy on the freshly-inserted
-- row. The previous USING clause depended on `can_view_conversation(id)`,
-- which is STABLE and internally selects from `public.conversations`. Because
-- the row being inserted is not yet visible to that subquery's snapshot, the
-- function returned false and the whole INSERT failed even when WITH CHECK
-- passed. Net effect: no team_dm could ever be created from the client.
--
-- We loosen USING with the same short-circuits as WITH CHECK so creators,
-- assignees, and project/client conversations on viewable deals can read
-- their own rows without needing can_view_conversation to see them first.

drop policy if exists "conversations_access" on public.conversations;
create policy "conversations_access" on public.conversations
  for all to authenticated
  using (
    org_id = public.current_user_org_id()
    and (
      created_by_member_id = public.current_user_member_id()
      or assignee_member_id = public.current_user_member_id()
      or (
        type in ('project', 'client')
        and deal_id is not null
        and public.can_view_deal(deal_id)
      )
      or public.can_view_conversation(id)
    )
  )
  with check (
    org_id = public.current_user_org_id()
    and (
      created_by_member_id = public.current_user_member_id()
      or (
        type in ('project', 'client')
        and deal_id is not null
        and public.can_view_deal(deal_id)
      )
      or public.can_view_conversation(id)
    )
  );
