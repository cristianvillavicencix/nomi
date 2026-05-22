-- Projects start after proposal acceptance: remove lead/discovery/proposal from the board.

UPDATE public.deals
SET stage = CASE stage
  WHEN 'lead' THEN 'kickoff'
  WHEN 'discovery' THEN 'kickoff'
  WHEN 'proposal' THEN 'kickoff'
  WHEN 'approved' THEN 'kickoff'
  WHEN 'scheduled' THEN 'kickoff'
  ELSE stage
END
WHERE stage IN ('lead', 'discovery', 'proposal', 'approved', 'scheduled');

UPDATE public.configuration
SET config = config
  || jsonb_build_object(
    'dealPipelineStatuses', '["active", "closed"]'::jsonb,
    'dealStages', jsonb_build_array(
      jsonb_build_object('value', 'kickoff', 'label', 'Kickoff'),
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
          jsonb_build_object('id', 'kickoff', 'label', 'Kickoff', 'color', '#7dbde8', 'order', 1, 'pipelineId', 'default', 'isDefault', true),
          jsonb_build_object('id', 'in_progress', 'label', 'In progress', 'color', '#6366f1', 'order', 2, 'pipelineId', 'default', 'isDefault', false),
          jsonb_build_object('id', 'client_review', 'label', 'Client review', 'color', '#f59e0b', 'order', 3, 'pipelineId', 'default', 'isDefault', false),
          jsonb_build_object('id', 'launch', 'label', 'Launch / Go-live', 'color', '#16a34a', 'order', 4, 'pipelineId', 'default', 'isDefault', false),
          jsonb_build_object('id', 'active', 'label', 'Active', 'color', '#16a34a', 'order', 5, 'pipelineId', 'default', 'isDefault', false),
          jsonb_build_object('id', 'on_hold', 'label', 'On hold', 'color', '#d97706', 'order', 6, 'pipelineId', 'default', 'isDefault', false),
          jsonb_build_object('id', 'closed', 'label', 'Closed', 'color', '#0f766e', 'order', 7, 'pipelineId', 'default', 'isDefault', false)
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
      WHERE stage->>'id' IN ('lead', 'discovery', 'proposal', 'approved', 'scheduled')
    )
    OR NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(config->'dealPipelines') AS pipeline,
           jsonb_array_elements(pipeline->'stages') AS stage
      WHERE stage->>'id' = 'kickoff'
    )
  );
