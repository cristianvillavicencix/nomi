declare module "simple-wappalyzer" {
  type WappalyzerInput = {
    url: string;
    html: string;
    statusCode: number;
    headers: Record<string, string>;
  };

  type WappalyzerResult = {
    applications?: Array<{
      name?: string;
      confidence?: string;
      version?: string | null;
      website?: string | null;
      icon?: string | null;
      categories?: Array<Record<string, string>>;
    }>;
  };

  export default function wappalyzer(input: WappalyzerInput): Promise<WappalyzerResult>;
}
