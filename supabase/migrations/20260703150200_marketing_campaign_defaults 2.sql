-- Default org_id and created_by_member_id on marketing campaign inserts.

create or replace function public.apply_marketing_campaign_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.org_id is null then
    new.org_id := public.current_user_org_id();
  end if;

  if tg_table_name in ('sms_campaigns', 'email_campaigns')
    and new.created_by_member_id is null then
    new.created_by_member_id := public.current_user_member_id();
  end if;

  if tg_table_name = 'contact_marketing_preferences' and new.org_id is null then
    select c.org_id into new.org_id
    from public.contacts c
    where c.id = new.contact_id;
  end if;

  return new;
end;
$$;

drop trigger if exists sms_campaigns_defaults on public.sms_campaigns;
create trigger sms_campaigns_defaults
before insert on public.sms_campaigns
for each row execute function public.apply_marketing_campaign_defaults();

drop trigger if exists email_campaigns_defaults on public.email_campaigns;
create trigger email_campaigns_defaults
before insert on public.email_campaigns
for each row execute function public.apply_marketing_campaign_defaults();

drop trigger if exists contact_marketing_preferences_defaults on public.contact_marketing_preferences;
create trigger contact_marketing_preferences_defaults
before insert on public.contact_marketing_preferences
for each row execute function public.apply_marketing_campaign_defaults();
