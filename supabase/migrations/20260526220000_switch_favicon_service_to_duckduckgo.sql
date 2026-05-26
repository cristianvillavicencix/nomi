-- favicon.show is returning HTTP 500 for every request, so all imported
-- company logos and contact avatars are broken images. Switch the trigger
-- helper and backfill existing rows to use icons.duckduckgo.com which
-- responds 200 with the real logo (much higher quality than google's
-- 16-32px favicon endpoint).

create or replace function public.get_domain_favicon(domain_name text)
 returns text
 language plpgsql
as $function$
declare clean_domain text;
begin
    if exists (select from favicons_excluded_domains as fav where fav.domain = domain_name) then
        return null;
    end if;

    clean_domain := (regexp_matches(domain_name, '^(?:https?:\/\/)?(?:[^@\/\n]+@)?(?:www\.)?([^:\/?\n]+)', 'i'))[1];
    if clean_domain is null or clean_domain = '' then
        return null;
    end if;

    return concat('https://icons.duckduckgo.com/ip3/', clean_domain, '.ico');
end;
$function$;

-- Backfill existing broken favicon.show URLs to point at the new service.
update public.companies
set logo = jsonb_set(
  logo,
  '{src}',
  to_jsonb('https://icons.duckduckgo.com/ip3/' ||
           replace(logo->>'src', 'https://favicon.show/', '') ||
           '.ico')
)
where logo->>'src' like 'https://favicon.show/%';

update public.contacts
set avatar = jsonb_set(
  avatar,
  '{src}',
  to_jsonb('https://icons.duckduckgo.com/ip3/' ||
           replace(avatar->>'src', 'https://favicon.show/', '') ||
           '.ico')
)
where avatar->>'src' like 'https://favicon.show/%';
