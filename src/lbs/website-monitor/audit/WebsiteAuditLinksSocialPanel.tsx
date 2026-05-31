import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  StaticAnalysisJson,
  WebsiteAuditAiSummaryJson,
} from "@/lbs/website-monitor/audit/types";
import { WebsiteAuditLinksPanel } from "@/lbs/website-monitor/audit/WebsiteAuditLinksPanel";
import { WebsiteAuditSocialPanel } from "@/lbs/website-monitor/audit/WebsiteAuditSocialPanel";

export const WebsiteAuditLinksSocialPanel = ({
  staticJson,
  auditUrl,
  aiSummary,
  linkCount,
  brokenLinkCount,
  socialCount,
}: {
  staticJson: StaticAnalysisJson;
  auditUrl?: string | null;
  aiSummary?: WebsiteAuditAiSummaryJson | null;
  linkCount: number;
  brokenLinkCount: number;
  socialCount: number;
}) => (
  <div className="space-y-4">
    <div>
      <h3 className="text-base font-semibold">Enlaces y presencia social</h3>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Páginas enlazadas desde el sitio y perfiles de redes sociales detectados
        en el DOM renderizado.
      </p>
    </div>

    <Tabs defaultValue="paginas" className="w-full">
      <TabsList className="h-auto w-full justify-start gap-1 bg-muted/50 p-1 sm:w-auto">
        <TabsTrigger value="paginas" className="rounded-lg">
          Páginas
          {brokenLinkCount > 0 ? (
            <span className="ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
              {brokenLinkCount}
            </span>
          ) : linkCount > 0 ? (
            <span className="ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold leading-none text-primary">
              {linkCount}
            </span>
          ) : null}
        </TabsTrigger>
        <TabsTrigger value="social" className="rounded-lg">
          Redes sociales
          {socialCount > 0 ? (
            <span className="ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold leading-none text-primary">
              {socialCount}
            </span>
          ) : null}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="paginas" className="mt-6">
        <WebsiteAuditLinksPanel
          staticJson={staticJson}
          auditUrl={auditUrl}
          aiSummary={aiSummary}
        />
      </TabsContent>

      <TabsContent value="social" className="mt-6">
        <WebsiteAuditSocialPanel staticJson={staticJson} />
      </TabsContent>
    </Tabs>
  </div>
);
