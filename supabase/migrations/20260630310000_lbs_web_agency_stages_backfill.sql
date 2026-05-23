-- LBS web agency pipeline: map legacy deal stages to full sales + delivery funnel.

update public.deals
set stage = case stage
  when 'setup' then 'won'
  when 'in_progress' then 'development'
  when 'client_review' then 'review'
  when 'delivered' then 'closed_won'
  when 'opportunity' then 'lead'
  when 'qualified' then 'discovery'
  when 'proposal' then 'proposal_sent'
  when 'negotiation' then 'proposal_sent'
  when 'lost' then 'closed_lost'
  when 'closed' then 'closed_won'
  when 'active' then 'launch'
  when 'on_hold' then 'development'
  when 'content_collection' then 'development'
  when 'live' then 'launch'
  when 'completed' then 'closed_won'
  when 'kickoff' then 'won'
  when 'approved' then 'won'
  when 'scheduled' then 'design'
  when 'material_ordered' then 'development'
  when 'pending_inspection' then 'review'
  else stage
end
where archived_at is null;

update public.deals
set lifecycle_phase = case
  when stage in ('lead', 'discovery', 'proposal_sent') then 'opportunity'
  when stage in ('closed_won', 'closed_lost') then 'closed'
  else 'delivery'
end
where archived_at is null;

update public.deals
set delivery_status = case stage
  when 'won' then coalesce(delivery_status, 'planning')
  when 'design' then coalesce(delivery_status, 'in_design')
  when 'development' then coalesce(delivery_status, 'in_development')
  when 'review' then coalesce(delivery_status, 'client_review')
  when 'launch' then coalesce(delivery_status, 'ready_to_launch')
  when 'maintenance' then coalesce(delivery_status, 'launched')
  when 'closed_won' then coalesce(delivery_status, 'completed')
  else delivery_status
end
where archived_at is null
  and lifecycle_phase = 'delivery';
