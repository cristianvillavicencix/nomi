-- Ensure every workspace has a non-empty display name (legacy or whitespace-only).
update public.organizations
set name = 'Organización ' || id::text
where btrim(name) = '';
