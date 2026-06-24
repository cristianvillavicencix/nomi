-- Stop stale follow-up reminder SMS for events that already passed before cron existed.

update public.calendar_events
set follow_up_reminder_sent_at = now()
where completed_at is null
  and follow_up_reminder_sent_at is null
  and contact_id is not null
  and organization_member_id is not null
  and (event_date::timestamp + coalesce(event_time, time '09:00')) < now();

update public.public_bookings
set guest_reminder_sent_at = now()
where status = 'confirmed'
  and guest_reminder_sent_at is null
  and guest_phone is not null
  and (event_date::timestamp + event_time) < now();
