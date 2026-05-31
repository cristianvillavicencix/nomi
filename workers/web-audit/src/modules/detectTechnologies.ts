export type DetectedTechnology = {
  name: string;
  confidence: string;
  version: string | null;
  categories: string[];
  website: string | null;
  icon: string | null;
};

type WappalyzerApplication = {
  name?: string;
  confidence?: string;
  version?: string | null;
  website?: string | null;
  icon?: string | null;
  categories?: Array<Record<string, string>>;
};

type WappalyzerResult = {
  applications?: WappalyzerApplication[];
};

const flattenCategories = (
  categories: WappalyzerApplication["categories"],
): string[] => {
  if (!Array.isArray(categories)) return [];
  return categories.flatMap((entry) => Object.values(entry)).filter(Boolean);
};

export const detectTechnologies = async (params: {
  url: string;
  html: string;
  statusCode: number;
  headers: Record<string, string>;
}): Promise<DetectedTechnology[]> => {
  try {
    const wappalyzerModule = await import("simple-wappalyzer");
    const wappalyzer = wappalyzerModule.default as (input: {
      url: string;
      html: string;
      statusCode: number;
      headers: Record<string, string>;
    }) => Promise<WappalyzerResult>;

    const result = await wappalyzer({
      url: params.url,
      html: params.html,
      statusCode: params.statusCode,
      headers: params.headers,
    });

    return (result.applications ?? [])
      .filter((app) => app.name)
      .map((app) => ({
        name: app.name!,
        confidence: app.confidence ?? "100",
        version: app.version ?? null,
        categories: flattenCategories(app.categories),
        website: app.website ?? null,
        icon: app.icon ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    console.warn("detectTechnologies failed", message);
    return [];
  }
};
