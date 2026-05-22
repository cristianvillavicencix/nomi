-- Replace contractor project stages with the LBS digital-marketing pipeline.

UPDATE public.deals
SET stage = CASE stage
  WHEN 'approved' THEN 'lead'
  WHEN 'scheduled' THEN 'discovery'
  WHEN 'material_ordered' THEN 'in_progress'
  WHEN 'pending_inspection' THEN 'client_review'
  WHEN 'completed' THEN 'active'
  ELSE stage
END
WHERE stage IN (
  'approved',
  'scheduled',
  'material_ordered',
  'pending_inspection',
  'completed'
);

UPDATE public.configuration
SET config = config
  || jsonb_build_object(
    'dealPipelineStatuses', '["active", "closed"]'::jsonb,
    'dealStages', jsonb_build_array(
      jsonb_build_object('value', 'lead', 'label', 'Lead'),
      jsonb_build_object('value', 'discovery', 'label', 'Discovery'),
      jsonb_build_object('value', 'proposal', 'label', 'Proposal'),
      jsonb_build_object('value', 'in_progress', 'label', 'In progress'),
      jsonb_build_object('value', 'client_review', 'label', 'Client review'),
      jsonb_build_object('value', 'launch', 'label', 'Launch / Go-live'),
      jsonb_build_object('value', 'active', 'label', 'Active'),
      jsonb_build_object('value', 'on_hold', 'label', 'On hold'),
      jsonb_build_object('value', 'closed', 'label', 'Closed')
    ),
    'dealPipelines', jsonb_build_array(
      jsonb_build_object(
        'id', 'default',
        'label', 'Default Board',
        'order', 1,
        'isDefault', true,
        'stages', jsonb_build_array(
          jsonb_build_object('id', 'lead', 'label', 'Lead', 'color', '#7dbde8', 'order', 1, 'pipelineId', 'default', 'isDefault', true),
          jsonb_build_object('id', 'discovery', 'label', 'Discovery', 'color', '#64748b', 'order', 2, 'pipelineId', 'default', 'isDefault', false),
          jsonb_build_object('id', 'proposal', 'label', 'Proposal', 'color', '#c084fc', 'order', 3, 'pipelineId', 'default', 'isDefault', false),
          jsonb_build_object('id', 'in_progress', 'label', 'In progress', 'color', '#6366f1', 'order', 4, 'pipelineId', 'default', 'isDefault', false),
          jsonb_build_object('id', 'client_review', 'label', 'Client review', 'color', '#f59e0b', 'order', 5, 'pipelineId', 'default', 'isDefault', false),
          jsonb_build_object('id', 'launch', 'label', 'Launch / Go-live', 'color', '#16a34a', 'order', 6, 'pipelineId', 'default', 'isDefault', false),
          jsonb_build_object('id', 'active', 'label', 'Active', 'color', '#16a34a', 'order', 7, 'pipelineId', 'default', 'isDefault', false),
          jsonb_build_object('id', 'on_hold', 'label', 'On hold', 'color', '#d97706', 'order', 8, 'pipelineId', 'default', 'isDefault', false),
          jsonb_build_object('id', 'closed', 'label', 'Closed', 'color', '#0f766e', 'order', 9, 'pipelineId', 'default', 'isDefault', false)
        )
      )
    )
  )
WHERE id = 1
  AND (
    config->'dealPipelines' IS NULL
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements(config->'dealPipelines') AS pipeline,
           jsonb_array_elements(pipeline->'stages') AS stage
      WHERE stage->>'id' IN (
        'approved',
        'scheduled',
        'material_ordered',
        'pending_inspection',
        'completed'
      )
    )
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements(config->'dealStages') AS stage
      WHERE stage->>'value' IN (
        'approved',
        'scheduled',
        'material_ordered',
        'pending_inspection',
        'completed'
      )
    )
  );
