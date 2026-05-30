import type { AuditFindingInput } from "../types.js";
import { buildCommercialMessage } from "./commercialCopy.js";

/** Attach English commercial_message to critical findings (in-place copy). */
export const enrichCommercialMessages = (
  findings: AuditFindingInput[],
): AuditFindingInput[] =>
  findings.map((finding) => {
    if (finding.commercial_message || finding.severity !== "critico") {
      return finding;
    }

    const extras =
      finding.metric_key === "images_without_alt" && finding.description
        ? {
            images_without_alt: finding.metric_value,
            total_images: finding.description.match(/de (\d+)/)?.[1],
          }
        : undefined;

    const commercial_message = buildCommercialMessage({
      severity: finding.severity,
      metric_key: finding.metric_key,
      metric_value: finding.metric_value,
      source: finding.source,
      source_id: finding.source_id,
      extras,
    });

    return commercial_message ? { ...finding, commercial_message } : finding;
  });
