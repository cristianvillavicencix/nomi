-- Normalize legacy public-format attachment references to path-only storage ids.
-- Safe after private bucket migration: readers resolve via path + defaultBucket or parse legacy URLs.

update public.ticket_deliverables
set src = path
where path is not null
  and src is not null
  and src ~ '/storage/v1/object/public/attachments/';

-- jsonb[] attachment columns (ticket_messages, contact_notes, deal_notes)
do $$
declare
  tbl text;
begin
  foreach tbl in array array['ticket_messages', 'contact_notes', 'deal_notes']
  loop
    execute format(
      $sql$
      update public.%I src_table
      set attachments = sub.normalized
      from (
        select
          base.id,
          coalesce(
            array_agg(
              case
                when elem->>'src' ~ '/storage/v1/object/public/attachments/'
                  and coalesce(elem->>'path', '') <> ''
                then jsonb_set(elem, '{src}', to_jsonb(elem->>'path'))
                when elem->>'src' ~ '/storage/v1/object/public/attachments/'
                then jsonb_set(
                  elem,
                  '{src}',
                  to_jsonb(
                    regexp_replace(
                      elem->>'src',
                      '^.*/storage/v1/object/public/attachments/',
                      ''
                    )
                  )
                )
                else elem
              end
            ),
            '{}'::jsonb[]
          ) as normalized
        from public.%I base
        cross join lateral unnest(coalesce(base.attachments, '{}'::jsonb[])) as elem
        where base.attachments is not null
        group by base.id
      ) sub
      where src_table.id = sub.id
        and exists (
          select 1
          from unnest(src_table.attachments) e
          where e->>'src' ~ '/storage/v1/object/public/attachments/'
        )
      $sql$,
      tbl,
      tbl
    );
  end loop;
end $$;

-- organization_members: avatar_url legacy public URLs → path only
update public.organization_members
set avatar_url = regexp_replace(
  avatar_url,
  '^.*/storage/v1/object/public/avatars/',
  ''
)
where avatar_url ~ '/storage/v1/object/public/avatars/';
