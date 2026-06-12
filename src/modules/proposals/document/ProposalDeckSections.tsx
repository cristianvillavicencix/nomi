import { Timer, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { EditableBlock } from "@/modules/proposals/document/EditableBlock";
import {
  ProposalSectionImage,
  ProposalSectionImageField,
} from "@/modules/proposals/document/ProposalSectionImageField";
import { isProposalImageUrl } from "@/modules/proposals/document/uploadProposalImage";
import type { ProposalCustomSection } from "@/modules/proposals/document/proposalDocumentTypes";
import type {
  ProposalDocumentCopy,
  ProposalLocale,
} from "@/modules/proposals/document/proposalDocumentI18n";

const DecorativeSectionArt = ({ id }: { id: string }) => {
  const palette: Record<string, { a: string; b: string; c: string }> = {
    "about-us": { a: "#60a5fa", b: "#a78bfa", c: "#22c55e" },
    "what-we-deliver": { a: "#22c55e", b: "#06b6d4", c: "#a78bfa" },
    guidelines: { a: "#a78bfa", b: "#f59e0b", c: "#60a5fa" },
    "website-features": { a: "#f59e0b", b: "#60a5fa", c: "#22c55e" },
    process: { a: "#06b6d4", b: "#a78bfa", c: "#f59e0b" },
    "content-management": { a: "#22c55e", b: "#60a5fa", c: "#a78bfa" },
    timeline: { a: "#f59e0b", b: "#60a5fa", c: "#22c55e" },
  };
  const colors = palette[id] ?? { a: "#60a5fa", b: "#a78bfa", c: "#22c55e" };
  return (
    <svg
      aria-hidden
      viewBox="0 0 560 240"
      className="h-32 w-full rounded-xl border bg-gradient-to-br from-muted/30 to-muted/10"
    >
      <defs>
        <linearGradient id={`g-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={colors.a} stopOpacity="0.55" />
          <stop offset="55%" stopColor={colors.b} stopOpacity="0.45" />
          <stop offset="100%" stopColor={colors.c} stopOpacity="0.35" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="560" height="240" rx="18" fill={`url(#g-${id})`} opacity="0.22" />
      <circle cx="140" cy="90" r="70" fill={colors.a} opacity="0.55" />
      <circle cx="310" cy="150" r="92" fill={colors.b} opacity="0.45" />
      <circle cx="430" cy="70" r="68" fill={colors.c} opacity="0.40" />
    </svg>
  );
};

const ProposalSectionImageWide = ({
  src,
}: {
  src: string;
}) => <ProposalSectionImage src={src} alt="" aspect="wide" />;

const sectionVisual = (sectionId: string, imageUrl?: string | null) =>
  isProposalImageUrl(imageUrl) ? (
    <ProposalSectionImageWide src={imageUrl} />
  ) : (
    <DecorativeSectionArt id={sectionId} />
  );

const splitBullets = (value: string) =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^-+\s*/, ""));

const SectionEyebrow = ({ children }: { children: React.ReactNode }) => (
  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
    {children}
  </p>
);

export const ProposalNarrativeDeckSection = ({
  section,
  copy,
  locale,
  editable,
  orgId,
  proposalId,
  onPatch,
  onRemove,
}: {
  section: ProposalCustomSection;
  copy: ProposalDocumentCopy;
  locale: ProposalLocale;
  editable: boolean;
  orgId?: string | number;
  proposalId?: string | number;
  onPatch: (id: string, partial: Partial<ProposalCustomSection>) => void;
  onRemove?: (id: string) => void;
}) => (
  <section
    key={section.id}
    id={`custom-${section.id}`}
    className="scroll-mt-6 space-y-4"
  >
    <div className="flex items-start justify-between gap-2">
      <SectionEyebrow>{copy.sections.custom}</SectionEyebrow>
      {editable && onRemove ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={() => onRemove(section.id)}
          aria-label="Remove section"
        >
          <Trash2 className="size-4" />
        </Button>
      ) : null}
    </div>

    {editable && orgId != null && proposalId != null ? (
      <ProposalSectionImageField
        locale={locale}
        imageUrl={section.image_url}
        onChange={(url) => onPatch(section.id, { image_url: url })}
        orgId={Number(orgId)}
        proposalId={Number(proposalId)}
      />
    ) : isProposalImageUrl(section.image_url) ? (
      <ProposalSectionImage
        src={section.image_url}
        alt={section.title}
        aspect="video"
        className="mb-1"
      />
    ) : null}

    <div className="grid gap-4 lg:grid-cols-[1fr_0.85fr]">
      <div className="space-y-3">
        <EditableBlock
          as="h2"
          editable={editable}
          value={section.title}
          onChange={(title) => onPatch(section.id, { title })}
          placeholder="Section title"
          className="text-2xl font-semibold tracking-tight"
        />
        <Card>
          <CardContent className="p-5">
            <EditableBlock
              editable={editable}
              value={section.body}
              onChange={(body) => onPatch(section.id, { body })}
              placeholder="Section content…"
              className="text-sm leading-relaxed text-muted-foreground"
            />
          </CardContent>
        </Card>
      </div>
      <div className="hidden lg:block">{sectionVisual(section.id, section.image_url)}</div>
    </div>
  </section>
);

export const ProposalTimelineDeckSection = ({
  section,
  copy,
  locale,
  editable,
  orgId,
  proposalId,
  onPatch,
  onRemove,
}: {
  section: ProposalCustomSection;
  copy: ProposalDocumentCopy;
  locale: ProposalLocale;
  editable: boolean;
  orgId?: string | number;
  proposalId?: string | number;
  onPatch: (id: string, partial: Partial<ProposalCustomSection>) => void;
  onRemove?: (id: string) => void;
}) => {
  const bullets = splitBullets(section.body);

  return (
    <section
      key={section.id}
      id={`custom-${section.id}`}
      className="scroll-mt-6 space-y-4"
    >
      <div className="flex items-start justify-between gap-2">
        <SectionEyebrow>{copy.sections.timeline}</SectionEyebrow>
        {editable && onRemove ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
            onClick={() => onRemove(section.id)}
            aria-label="Remove section"
          >
            <Trash2 className="size-4" />
          </Button>
        ) : null}
      </div>

      {editable && orgId != null && proposalId != null ? (
        <ProposalSectionImageField
          locale={locale}
          imageUrl={section.image_url}
          onChange={(url) => onPatch(section.id, { image_url: url })}
          orgId={Number(orgId)}
          proposalId={Number(proposalId)}
        />
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-2">
        <EditableBlock
          as="h2"
          editable={editable}
          value={section.title}
          onChange={(title) => onPatch(section.id, { title })}
          placeholder="Project timeline"
          className="text-2xl font-semibold tracking-tight"
        />
        <Badge variant="secondary" className="gap-1">
          <Timer className="size-3.5" />
          Typical 2–4 weeks
        </Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        {sectionVisual("timeline", section.image_url)}
        <Card>
          <CardContent className="p-5">
            <ol className="space-y-3">
              {(bullets.length ? bullets : ["Add timeline milestones…"]).map((b, i) => (
                <li key={String(i)} className="flex gap-3">
                  <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary tabular-nums">
                    {i + 1}
                  </span>
                  <p className="text-sm text-muted-foreground">{b}</p>
                </li>
              ))}
            </ol>
            {editable ? (
              <>
                <Separator className="my-4" />
                <EditableBlock
                  editable
                  value={section.body}
                  onChange={(body) => onPatch(section.id, { body })}
                  placeholder="- Week 1: ...\n- Week 2: ..."
                  className="text-xs text-muted-foreground"
                />
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </section>
  );
};
