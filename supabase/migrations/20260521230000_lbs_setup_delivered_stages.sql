-- Rename kickoff → setup and closed → Entregado (delivered).

UPDATE public.deals
SET stage = CASE stage
  WHEN 'kickoff' THEN 'setup'
  WHEN 'closed' THEN 'delivered'
  ELSE stage
END
WHERE stage IN ('kickoff', 'closed');

UPDATE public.configuration
SET config = config
  || jsonb_build_object(
    'dealPipelineStatuses', '["active", "delivered"]'::jsonb,
    'dealStages', jsonb_build_array(
      jsonb_build_object('value', 'setup', 'label', 'Setup'),
      jsonb_build_object('value', 'in_progress', 'label', 'In progress'),
      jsonb_build_object('value', 'client_review', 'label', 'Client review'),
      jsonb_build_object('value', 'launch', 'label', 'Launch / Go-live'),
      jsonb_build_object('value', 'active', 'label', 'Active'),
      jsonb_build_object('value', 'on_hold', 'label', 'On hold'),
      jsonb_build_object('value', 'delivered', 'label', 'Entregado')
    ),
    'dealPipelines', jsonb_build_array(
      jsonb_build_object(
        'id', 'default',
        'label', 'Default Board',
        'order', 1,
        'isDefault', true,
        'stages', jsonb_build_array(
          jsonb_build_object('id', 'setup', 'label', 'Setup', 'color', '#7dbde8', 'order', 1, 'pipelineId', 'default', 'isDefault', true),
          jsonb_build_object('id', 'in_progress', 'label', 'In progress', 'color', '#6366f1', 'order', 2, 'pipelineId', 'default', 'isDefault', false),
          jsonb_build_object('id', 'client_review', 'label', 'Client review', 'color', '#f59e0b', 'order', 3, 'pipelineId', 'default', 'isDefault', false),
          jsonb_build_object('id', 'launch', 'label', 'Launch / Go-live', 'color', '#16a34a', 'order', 4, 'pipelineId', 'default', 'isDefault', false),
          jsonb_build_object('id', 'active', 'label', 'Active', 'color', '#16a34a', 'order', 5, 'pipelineId', 'default', 'isDefault', false),
          jsonb_build_object('id', 'on_hold', 'label', 'On hold', 'color', '#d97706', 'order', 6, 'pipelineId', 'default', 'isDefault', false),
          jsonb_build_object('id', 'delivered', 'label', 'Entregado', 'color', '#0f766e', 'order', 7, 'pipelineId', 'default', 'isDefault', false)
        )
      )
    )
  )
WHERE id = 1
  AND (
    EXISTS (
      SELECT 1
      FROM jsonb_array_elements(config->'dealPipelines') AS pipeline,
           jsonb_array_elements(pipeline->'stages') AS stage
      WHERE stage->>'id' IN ('kickoff', 'closed')
    )
    OR NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(config->'dealPipelines') AS pipeline,
           jsonb_array_elements(pipeline->'stages') AS stage
      WHERE stage->>'id' = 'setup'
    )
  );
