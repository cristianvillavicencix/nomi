-- Simplify LBS project pipeline: Setup → In progress → Client review → Launch → Delivered.

UPDATE public.deals
SET stage = CASE stage
  WHEN 'active' THEN 'launch'
  WHEN 'on_hold' THEN 'in_progress'
  WHEN 'completed' THEN 'delivered'
  ELSE stage
END
WHERE stage IN ('active', 'on_hold', 'completed');

UPDATE public.configuration
SET config = config
  || jsonb_build_object(
    'dealPipelineStatuses', '["delivered"]'::jsonb,
    'dealStages', jsonb_build_array(
      jsonb_build_object('value', 'setup', 'label', 'Setup'),
      jsonb_build_object('value', 'in_progress', 'label', 'In progress'),
      jsonb_build_object('value', 'client_review', 'label', 'Client review'),
      jsonb_build_object('value', 'launch', 'label', 'Launch'),
      jsonb_build_object('value', 'delivered', 'label', 'Delivered')
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
          jsonb_build_object('id', 'launch', 'label', 'Launch', 'color', '#16a34a', 'order', 4, 'pipelineId', 'default', 'isDefault', false),
          jsonb_build_object('id', 'delivered', 'label', 'Delivered', 'color', '#0f766e', 'order', 5, 'pipelineId', 'default', 'isDefault', false)
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
      WHERE stage->>'id' IN ('active', 'on_hold')
        OR stage->>'label' = 'Entregado'
    )
    OR (
      SELECT count(*)::int
      FROM jsonb_array_elements(config->'dealPipelines') AS pipeline,
           jsonb_array_elements(pipeline->'stages') AS stage
      WHERE pipeline->>'id' = 'default' OR pipeline->>'isDefault' = 'true'
    ) <> 5
  );
