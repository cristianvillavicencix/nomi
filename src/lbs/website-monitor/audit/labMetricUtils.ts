export type LabMetricKey = "fcp" | "lcp" | "cls" | "tbt";

/** Map lab measurement to 0–100 for gauge ring (Lighthouse-style thresholds). */
export const labMetricScore = (
  metric: LabMetricKey,
  value?: number | null,
): number | null => {
  if (value == null || !Number.isFinite(value)) return null;
  const v = Number(value);

  const piecewise = (
    points: Array<{ at: number; score: number }>,
  ): number => {
    if (v <= points[0].at) return points[0].score;
    for (let i = 1; i < points.length; i += 1) {
      const prev = points[i - 1];
      const next = points[i];
      if (v <= next.at) {
        const t = (v - prev.at) / (next.at - prev.at);
        return Math.round(prev.score + t * (next.score - prev.score));
      }
    }
    return points[points.length - 1].score;
  };

  switch (metric) {
    case "fcp":
      return piecewise([
        { at: 0, score: 100 },
        { at: 1800, score: 90 },
        { at: 3000, score: 50 },
        { at: 5000, score: 0 },
      ]);
    case "lcp":
      return piecewise([
        { at: 0, score: 100 },
        { at: 2500, score: 90 },
        { at: 4000, score: 50 },
        { at: 6000, score: 0 },
      ]);
    case "cls":
      return piecewise([
        { at: 0, score: 100 },
        { at: 0.1, score: 90 },
        { at: 0.25, score: 50 },
        { at: 0.5, score: 0 },
      ]);
    case "tbt":
      return piecewise([
        { at: 0, score: 100 },
        { at: 200, score: 90 },
        { at: 600, score: 50 },
        { at: 1500, score: 0 },
      ]);
    default:
      return null;
  }
};

export const formatLabMetric = (
  metric: LabMetricKey,
  value?: number | null,
): string => {
  if (value == null || !Number.isFinite(value)) return "—";
  if (metric === "cls") return Number(value).toFixed(3);
  const ms = Number(value);
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)} s`;
  return `${Math.round(ms)} ms`;
};
