import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { EditableBlock } from "@/modules/proposals/document/EditableBlock";
import { ProposalFormattedBody } from "@/modules/proposals/document/proposalFormattedBody";
import { ProposalImageDropZone } from "@/modules/proposals/document/ProposalImageDropZone";
import { useLbsGoogleReviews } from "@/modules/proposals/document/lbsGoogleReviews";
import { ProposalTimelineGantt } from "@/modules/proposals/document/ProposalTimelineGantt";
import { resolveProposalTimelineBars } from "@/modules/proposals/document/proposalTimeline";
import type { ProposalDocumentCopy } from "@/modules/proposals/document/proposalDocumentI18n";
import type {
  ProposalAboutStats,
  ProposalClientLogo,
  ProposalCustomSection,
  ProposalDocumentContent,
  ProposalPortfolioItem,
  ProposalTeamMember,
} from "@/modules/proposals/document/proposalDocumentTypes";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

const splitBullets = (value: string) =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^-+\s*/, "").replace(/^\d+\.\s*/, ""));

type ProcessStep = { title: string; body: string };

const parseProcessSteps = (body: string): ProcessStep[] => {
  if (!body.trim()) return [];
  const lines = body
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  return lines.map((line) => {
    const match = line.match(/^(\d+)\.\s*(.*)$/);
    if (match) {
      const rest = match[2].trim();
      if (!rest) return { title: "", body: "" };
      const dash = rest.indexOf("—");
      if (dash > -1) {
        return {
          title: rest.slice(0, dash).trim(),
          body: rest.slice(dash + 1).trim(),
        };
      }
      return { title: rest, body: "" };
    }
    return { title: line, body: "" };
  });
};

const serializeProcessSteps = (steps: ProcessStep[]) =>
  steps
    .map((step, index) => {
      const title = step.title.trim();
      const detail = step.body.trim();
      if (!title && !detail) return `${index + 1}.`;
      const line = detail ? `${title} — ${detail}` : title;
      return `${index + 1}. ${line}`;
    })
    .join("\n");

type DeliverableItem = { title: string; detail: string };

const parseDeliverableItems = (body: string): DeliverableItem[] => {
  if (!body.trim()) return [];
  const lines = body.split("\n").map((line) => line.trim());
  const bulletLines = lines.filter(
    (line) => line.startsWith("-") || line === "-",
  );
  const source = bulletLines.length > 0 ? bulletLines : lines.filter(Boolean);
  return source.map((line) => {
    const text = line.replace(/^-+\s*/, "");
    if (!text) return { title: "", detail: "" };
    const dash = text.indexOf("—");
    if (dash > -1) {
      return {
        title: text.slice(0, dash).trim(),
        detail: text.slice(dash + 1).trim(),
      };
    }
    return { title: text, detail: "" };
  });
};

const serializeDeliverableItems = (items: DeliverableItem[]) =>
  items
    .map(({ title, detail }) => {
      const t = title.trim();
      const d = detail.trim();
      if (!t && !d) return "-";
      const line = d ? `${t} — ${d}` : t;
      return `- ${line}`;
    })
    .join("\n");

const ItemRemoveButton = ({
  visible,
  label,
  onClick,
}: {
  visible: boolean;
  label: string;
  onClick: () => void;
}) =>
  visible ? (
    <IconButton
      className="absolute right-0 top-0 z-10 text-muted-foreground opacity-0 transition-opacity group-hover/item:opacity-100 focus-visible:opacity-100"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      aria-label={label}
    >
      <Trash2 className="size-4" />
    </IconButton>
  ) : null;

const SectionHeader = ({
  sectionId,
  title,
  editable,
  onRemove,
}: {
  sectionId: string;
  title: string;
  editable: boolean;
  onRemove?: (id: string) => void;
}) => (
  <div className="mb-4 flex items-start justify-between gap-2">
    <div className="pf-kicker">{title}</div>
    {editable && onRemove ? (
      <IconButton
        className="shrink-0"
        onClick={() => onRemove(sectionId)}
        aria-label="Remove section"
      >
        <Trash2 className="size-4" />
      </IconButton>
    ) : null}
  </div>
);

export const ProposalFormalSection = ({
  section,
  content,
  copy,
  editable,
  orgId,
  proposalId,
  preparadaPor,
  onPatchSection,
  onPatchContent,
  onRemove,
}: {
  section: ProposalCustomSection;
  content: ProposalDocumentContent;
  copy: ProposalDocumentCopy;
  editable: boolean;
  orgId: number;
  proposalId: number;
  preparadaPor?: string;
  onPatchSection: (id: string, partial: Partial<ProposalCustomSection>) => void;
  onPatchContent: (partial: Partial<ProposalDocumentContent>) => void;
  onRemove?: (id: string) => void;
}) => {
  const { data: reviewsData, isLoading: reviewsLoading } = useLbsGoogleReviews(
    section.id === "work-reviews",
  );

  const portfolio = content.portfolio_items ?? [];
  const team = content.team_members ?? [];
  const clientLogos = content.client_logos ?? [];
  const stats = content.about_stats ?? {};

  const patchPortfolio = (
    index: number,
    partial: Partial<ProposalPortfolioItem>,
  ) => {
    const next = portfolio.map((item, i) =>
      i === index ? { ...item, ...partial } : item,
    );
    onPatchContent({ portfolio_items: next });
  };

  const patchTeam = (index: number, partial: Partial<ProposalTeamMember>) => {
    const next = team.map((item, i) =>
      i === index ? { ...item, ...partial } : item,
    );
    onPatchContent({ team_members: next });
  };

  const patchClientLogo = (
    index: number,
    partial: Partial<ProposalClientLogo>,
  ) => {
    const next = clientLogos.map((item, i) =>
      i === index ? { ...item, ...partial } : item,
    );
    onPatchContent({ client_logos: next });
  };

  const addClientLogo = () => {
    onPatchContent({
      client_logos: [
        ...clientLogos,
        {
          id: `client-logo-${Date.now().toString(36)}`,
          name: "",
          image_url: "",
        },
      ],
    });
  };

  const removeClientLogo = (index: number) => {
    onPatchContent({
      client_logos: clientLogos.filter((_, i) => i !== index),
    });
  };

  const addTeamMember = () => {
    onPatchContent({
      team_members: [
        ...team,
        {
          id: `team-${Date.now().toString(36)}`,
          name: "Team member",
          role: "Role",
          bio: "",
          image_url: "",
        },
      ],
    });
  };

  const removeTeamMember = (index: number) => {
    onPatchContent({
      team_members: team.filter((_, i) => i !== index),
    });
  };

  const timelineBars = resolveProposalTimelineBars(content.timeline_bars);

  const patchStats = (partial: Partial<ProposalAboutStats>) => {
    onPatchContent({ about_stats: { ...stats, ...partial } });
  };

  if (section.id === "about-us") {
    return (
      <section
        id={`custom-${section.id}`}
        className="pf-section proposal-pdf-page scroll-mt-6"
      >
        <SectionHeader
          sectionId={section.id}
          title={copy.sections.aboutUs}
          editable={editable}
          onRemove={onRemove}
        />
        <EditableBlock
          as="h2"
          editable={editable}
          value={section.title}
          onChange={(title) => onPatchSection(section.id, { title })}
          className="pf-h2"
          placeholder="About us"
        />
        {editable ? (
          <EditableBlock
            editable
            value={section.body}
            onChange={(body) => onPatchSection(section.id, { body })}
            className="pf-lead"
            placeholder="About your company…"
          />
        ) : (
          <ProposalFormattedBody body={section.body} />
        )}
        <div className="pf-stats">
          {(
            [
              ["websites", stats.websites ?? "120+", "Websites launched"],
              ["years", stats.years ?? "8 yrs", "Years in business"],
              ["leads", stats.leads ?? "3.4×", "Avg. lead increase"],
              ["retention", stats.retention ?? "98%", "Client retention"],
            ] as const
          ).map(([key, value, label]) => (
            <div key={key} className="pf-stat">
              {editable ? (
                <input
                  className="pf-stat-n w-full border-0 bg-transparent text-center outline-none"
                  value={value}
                  onChange={(e) => patchStats({ [key]: e.target.value })}
                />
              ) : (
                <div className="pf-stat-n">{value}</div>
              )}
              <div className="mt-2 text-xs font-medium text-[#475068]">
                {label}
              </div>
            </div>
          ))}
        </div>
        <div className="mb-4 mt-10 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-bold text-foreground">
            {copy.teamSectionTitle}
          </h3>
          {editable ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={addTeamMember}
            >
              <Plus className="size-4" />
              Add member
            </Button>
          ) : null}
        </div>
        {team.length === 0 && !editable ? (
          <p className="text-sm text-muted-foreground">
            Team members will appear here.
          </p>
        ) : null}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {team.map((member, index) => (
            <div
              key={member.id}
              className="pf-team-card group/item relative rounded-xl px-2 py-3 text-center transition-colors hover:bg-muted/30"
            >
              {editable ? (
                <IconButton
                  className="absolute right-0 top-0 z-10 size-7 rounded-full bg-background opacity-0 shadow-sm transition-opacity group-hover/item:opacity-100 focus-visible:opacity-100"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => removeTeamMember(index)}
                  aria-label="Remove team member"
                >
                  <Trash2 className="size-3.5" />
                </IconButton>
              ) : null}
              <ProposalImageDropZone
                imageUrl={member.image_url}
                onChange={(url) => patchTeam(index, { image_url: url })}
                orgId={orgId}
                proposalId={proposalId}
                editable={editable}
                aspectClass="pf-avatar aspect-square size-24 sm:size-28"
                placeholder="Team photo"
                initials={initials(member.name)}
              />
              {editable ? (
                <>
                  <input
                    className="mb-1 mt-3 w-full rounded border border-[#eceef2] px-1 py-0.5 text-center text-sm font-bold"
                    value={member.name}
                    onChange={(e) => patchTeam(index, { name: e.target.value })}
                  />
                  <input
                    className="mb-2 w-full rounded border border-[#eceef2] px-1 py-0.5 text-center text-xs text-[#9aa3b5]"
                    value={member.role}
                    onChange={(e) => patchTeam(index, { role: e.target.value })}
                  />
                  <textarea
                    className="w-full resize-y rounded border border-[#eceef2] px-2 py-1 text-left text-xs leading-relaxed text-[#475068]"
                    rows={3}
                    value={member.bio ?? ""}
                    placeholder={copy.teamBioPlaceholder}
                    onChange={(e) => patchTeam(index, { bio: e.target.value })}
                  />
                </>
              ) : (
                <>
                  <p className="mt-3 text-sm font-bold">{member.name}</p>
                  <p className="text-xs font-medium text-[#1E5FA8]">
                    {member.role}
                  </p>
                  {member.bio?.trim() ? (
                    <p className="mt-2 text-left text-xs leading-relaxed text-[#475068]">
                      {member.bio}
                    </p>
                  ) : null}
                </>
              )}
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (section.id === "work-reviews") {
    const reviews = reviewsData?.reviews?.slice(0, 2) ?? [];
    return (
      <section
        id={`custom-${section.id}`}
        className="pf-section proposal-pdf-page scroll-mt-6"
      >
        <SectionHeader
          sectionId={section.id}
          title={copy.sections.workReviews}
          editable={editable}
          onRemove={onRemove}
        />
        <EditableBlock
          as="h2"
          editable={editable}
          value={section.title}
          onChange={(title) => onPatchSection(section.id, { title })}
          className="pf-h2"
        />
        {editable ? (
          <EditableBlock
            editable
            value={section.body}
            onChange={(body) => onPatchSection(section.id, { body })}
            className="pf-lead"
          />
        ) : (
          <ProposalFormattedBody body={section.body} className="mb-6" />
        )}
        {editable || clientLogos.length > 0 ? (
          <div className="pf-client-logos">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="pf-client-logos-title mb-0">
                {copy.trustedByTitle}
              </p>
              {editable ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={addClientLogo}
                >
                  <Plus className="mr-1 size-3.5" />
                  {copy.addClientLogo}
                </Button>
              ) : null}
            </div>
            {clientLogos.length === 0 && editable ? (
              <p className="text-center text-xs text-[#9aa3b5]">
                {copy.clientLogosEmpty}
              </p>
            ) : (
              <div className="pf-client-logos-grid">
                {clientLogos.map((logo, index) => (
                  <div
                    key={logo.id}
                    className="pf-client-logo-slot group/logo relative"
                  >
                    {editable ? (
                      <IconButton
                        className="absolute -right-2 -top-2 z-10 size-6 rounded-full bg-background opacity-0 shadow-sm transition-opacity group-hover/logo:opacity-100 focus-visible:opacity-100"
                        onClick={() => removeClientLogo(index)}
                        aria-label="Remove logo"
                      >
                        <Trash2 className="size-3" />
                      </IconButton>
                    ) : null}
                    <ProposalImageDropZone
                      imageUrl={logo.image_url}
                      onChange={(url) =>
                        patchClientLogo(index, { image_url: url })
                      }
                      orgId={orgId}
                      proposalId={proposalId}
                      editable={editable}
                      aspectClass="aspect-[3/2] min-h-[52px]"
                      imageFit="contain"
                      placeholder="Company logo"
                      className="w-full"
                    />
                    {editable ? (
                      <input
                        className="mt-1.5 w-full rounded border border-transparent bg-transparent px-1 text-center text-[10px] text-[#9aa3b5] outline-none focus:border-[#eceef2]"
                        value={logo.name ?? ""}
                        placeholder={copy.clientLogoNamePlaceholder}
                        onChange={(e) =>
                          patchClientLogo(index, { name: e.target.value })
                        }
                      />
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
        <div className="pf-work-grid mb-6">
          {portfolio.map((item, index) => (
            <div key={item.id} className="pf-work">
              <ProposalImageDropZone
                imageUrl={item.image_url}
                onChange={(url) => patchPortfolio(index, { image_url: url })}
                orgId={orgId}
                proposalId={proposalId}
                editable={editable}
                aspectClass="aspect-[16/10] rounded-none border-0"
                placeholder="Project screenshot"
                className="rounded-none border-0"
              />
              <div className="px-3 py-2.5 text-xs text-[#9aa3b5]">
                {editable ? (
                  <>
                    <input
                      className="mb-0.5 w-full font-semibold text-[#0f1729]"
                      value={item.title}
                      onChange={(e) =>
                        patchPortfolio(index, { title: e.target.value })
                      }
                    />
                    <input
                      className="w-full"
                      value={item.subtitle}
                      onChange={(e) =>
                        patchPortfolio(index, { subtitle: e.target.value })
                      }
                    />
                  </>
                ) : (
                  <>
                    <b className="text-[#0f1729]">{item.title}</b>
                    {item.subtitle ? ` · ${item.subtitle}` : null}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="pf-reviews">
          {reviewsLoading ? (
            <p className="text-sm text-[#9aa3b5]">Loading Google reviews…</p>
          ) : reviews.length ? (
            reviews.map((review) => (
              <div
                key={`${review.authorName}-${review.text.slice(0, 20)}`}
                className="pf-review"
              >
                <div className="pf-stars">
                  {"★".repeat(Math.min(5, review.rating))}
                </div>
                <p className="text-sm leading-relaxed text-[#0f1729]">
                  {review.text}
                </p>
                <div className="mt-4 flex items-center gap-2.5 border-t border-[#eceef2] pt-3">
                  <div className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-[#1E5FA8] to-[#0D3B6E] text-xs font-bold text-white">
                    {initials(review.authorName)}
                  </div>
                  <div>
                    <p className="text-sm font-bold">{review.authorName}</p>
                    <p className="text-xs text-[#9aa3b5]">
                      {review.relativeTime ?? "Google review · LBS"}
                    </p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-[#9aa3b5] col-span-2">
              {copy.reviewsUnavailable}
            </p>
          )}
        </div>
      </section>
    );
  }

  if (section.id === "what-we-deliver") {
    const parsed = parseDeliverableItems(section.body);
    const filled = parsed.filter((item) => item.title || item.detail);
    const items: DeliverableItem[] = editable
      ? parsed.length > 0
        ? parsed
        : [{ title: "", detail: "" }]
      : filled;

    const patchItems = (next: DeliverableItem[]) => {
      onPatchSection(section.id, { body: serializeDeliverableItems(next) });
    };

    const updateItem = (index: number, partial: Partial<DeliverableItem>) => {
      const next = items.map((item, i) =>
        i === index ? { ...item, ...partial } : item,
      );
      patchItems(next);
    };

    return (
      <section
        id={`custom-${section.id}`}
        className="pf-section proposal-pdf-page scroll-mt-6"
      >
        <div className="pf-kicker">{copy.sections.whatWeDeliver}</div>
        <EditableBlock
          as="h2"
          editable={editable}
          value={section.title}
          onChange={(title) => onPatchSection(section.id, { title })}
          className="pf-h2"
        />
        <div className="mt-4 grid gap-7 sm:grid-cols-2">
          {items.map((item, i) => (
            <div
              key={`${section.id}-deliverable-${i}`}
              className="group/item relative rounded-xl pr-8 transition-colors hover:bg-muted/30"
            >
              <ItemRemoveButton
                visible={editable && items.length > 1}
                label={copy.removeItem}
                onClick={() => patchItems(items.filter((_, j) => j !== i))}
              />
              <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-[#1E5FA8]/10 text-[#1E5FA8]">
                <span className="text-sm font-bold">{i + 1}</span>
              </div>
              {editable ? (
                <>
                  <EditableBlock
                    editable
                    value={item.title}
                    onChange={(title) => updateItem(i, { title })}
                    className="text-sm font-bold text-foreground"
                    placeholder="Deliverable"
                  />
                  <EditableBlock
                    editable
                    value={item.detail}
                    onChange={(detail) => updateItem(i, { detail })}
                    className="mt-1 text-sm leading-relaxed text-[#475068]"
                    placeholder="Details (optional)"
                  />
                </>
              ) : item.detail ? (
                <>
                  <h4 className="text-sm font-bold">{item.title}</h4>
                  <p className="mt-1 text-sm leading-relaxed text-[#475068]">
                    {item.detail}
                  </p>
                </>
              ) : (
                <p className="text-sm leading-relaxed text-[#475068]">
                  {item.title}
                </p>
              )}
            </div>
          ))}
        </div>
        {editable ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-4"
            onClick={() => patchItems([...items, { title: "", detail: "" }])}
          >
            <Plus className="mr-1 size-3.5" />
            {copy.addDeliverable}
          </Button>
        ) : null}
      </section>
    );
  }

  if (section.id === "website-features") {
    const parsed = parseDeliverableItems(section.body);
    const filled = parsed.filter((item) => item.title || item.detail);
    const items: DeliverableItem[] = editable
      ? parsed.length > 0
        ? parsed
        : [{ title: "", detail: "" }]
      : filled;

    const patchItems = (next: DeliverableItem[]) => {
      onPatchSection(section.id, { body: serializeDeliverableItems(next) });
    };

    const updateItem = (index: number, partial: Partial<DeliverableItem>) => {
      const next = items.map((item, i) =>
        i === index ? { ...item, ...partial } : item,
      );
      patchItems(next);
    };

    return (
      <section
        id={`custom-${section.id}`}
        className="pf-section proposal-pdf-page scroll-mt-6"
      >
        <div className="pf-kicker">{copy.sections.websiteFeatures}</div>
        <EditableBlock
          as="h2"
          editable={editable}
          value={section.title}
          onChange={(title) => onPatchSection(section.id, { title })}
          className="pf-h2"
        />
        <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, i) => (
            <div
              key={`${section.id}-feature-${i}`}
              className="group/item relative rounded-xl pr-8 transition-colors hover:bg-muted/30"
            >
              <ItemRemoveButton
                visible={editable && items.length > 1}
                label={copy.removeItem}
                onClick={() => patchItems(items.filter((_, j) => j !== i))}
              />
              <div className="mb-3 flex size-9 items-center justify-center rounded-lg bg-[#0D3B6E] text-white">
                <span className="text-xs font-bold">{i + 1}</span>
              </div>
              {editable ? (
                <>
                  <EditableBlock
                    editable
                    value={item.title}
                    onChange={(title) => updateItem(i, { title })}
                    className="text-sm font-bold text-foreground"
                    placeholder="Feature"
                  />
                  <EditableBlock
                    editable
                    value={item.detail}
                    onChange={(detail) => updateItem(i, { detail })}
                    className="mt-1 text-xs leading-relaxed text-[#475068]"
                    placeholder="Details (optional)"
                  />
                </>
              ) : item.detail ? (
                <>
                  <h4 className="text-sm font-bold">{item.title}</h4>
                  <p className="mt-1 text-xs leading-relaxed text-[#475068]">
                    {item.detail}
                  </p>
                </>
              ) : (
                <p className="text-sm leading-relaxed text-[#475068]">
                  {item.title}
                </p>
              )}
            </div>
          ))}
        </div>
        {editable ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-4"
            onClick={() => patchItems([...items, { title: "", detail: "" }])}
          >
            <Plus className="mr-1 size-3.5" />
            {copy.addFeature}
          </Button>
        ) : null}
      </section>
    );
  }

  if (section.id === "process") {
    const parsed = parseProcessSteps(section.body);
    const filled = parsed.filter((step) => step.title || step.body);
    const steps: ProcessStep[] = editable
      ? parsed.length > 0
        ? parsed
        : [{ title: "", body: "" }]
      : filled;

    const patchSteps = (next: ProcessStep[]) => {
      onPatchSection(section.id, { body: serializeProcessSteps(next) });
    };

    const updateStep = (index: number, partial: Partial<ProcessStep>) => {
      const next = steps.map((step, i) =>
        i === index ? { ...step, ...partial } : step,
      );
      patchSteps(next);
    };

    return (
      <section
        id={`custom-${section.id}`}
        className="pf-section proposal-pdf-page scroll-mt-6"
      >
        <div className="pf-kicker">{copy.sections.process}</div>
        <EditableBlock
          as="h2"
          editable={editable}
          value={section.title}
          onChange={(title) => onPatchSection(section.id, { title })}
          className="pf-h2"
        />
        <div className="relative mt-6 border-l-2 border-[#eceef2] pl-8">
          {steps.map((step, i) => (
            <div
              key={`${section.id}-step-${i}`}
              className="group/item relative rounded-lg pb-7 pr-8 transition-colors last:pb-0 hover:bg-muted/30"
            >
              <ItemRemoveButton
                visible={editable && steps.length > 1}
                label={copy.removeItem}
                onClick={() => patchSteps(steps.filter((_, j) => j !== i))}
              />
              <span className="absolute -left-[33px] top-1 size-3.5 rounded-full bg-[#1E5FA8] ring-4 ring-white" />
              {editable ? (
                <>
                  <EditableBlock
                    editable
                    value={step.title}
                    onChange={(title) => updateStep(i, { title })}
                    className="font-bold text-base text-foreground"
                    placeholder="Step name"
                  />
                  <EditableBlock
                    editable
                    value={step.body}
                    onChange={(body) => updateStep(i, { body })}
                    className="mt-1 text-sm text-[#475068]"
                    placeholder="Short description"
                  />
                </>
              ) : (
                <>
                  <h4 className="font-bold">{step.title}</h4>
                  {step.body ? (
                    <p className="mt-1 text-sm text-[#475068]">{step.body}</p>
                  ) : null}
                </>
              )}
            </div>
          ))}
          {editable ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mt-2"
              onClick={() => patchSteps([...steps, { title: "", body: "" }])}
            >
              <Plus className="mr-1 size-3.5" />
              {copy.addStep}
            </Button>
          ) : null}
        </div>
      </section>
    );
  }

  if (section.id === "content-management") {
    return (
      <section
        id={`custom-${section.id}`}
        className="pf-section proposal-pdf-page scroll-mt-6"
      >
        <div className="pf-kicker">{copy.sections.contentManagement}</div>
        <EditableBlock
          as="h2"
          editable={editable}
          value={section.title}
          onChange={(title) => onPatchSection(section.id, { title })}
          className="pf-h2"
        />
        <div className="pf-cms-panel relative mt-4 overflow-hidden rounded-[20px] bg-gradient-to-br from-[#0D3B6E] to-[#1E5FA8] p-8 text-white">
          {editable ? (
            <EditableBlock
              editable
              value={section.body}
              onChange={(body) => onPatchSection(section.id, { body })}
              className="relative text-sm leading-relaxed text-white/90"
            />
          ) : (
            <ProposalFormattedBody body={section.body} />
          )}
        </div>
      </section>
    );
  }

  if (section.id === "timeline" || section.id === "project-timeline") {
    return (
      <section
        id={`custom-${section.id}`}
        className="pf-section proposal-pdf-page scroll-mt-6"
      >
        <div className="pf-kicker">{copy.sections.timeline}</div>
        <EditableBlock
          as="h2"
          editable={editable}
          value={section.title}
          onChange={(title) => onPatchSection(section.id, { title })}
          className="pf-h2"
        />
        <ProposalTimelineGantt
          bars={timelineBars}
          editable={editable}
          onChange={(bars) => onPatchContent({ timeline_bars: bars })}
          addPhaseLabel={copy.addTimelinePhase}
          phasePlaceholder={copy.timelinePhasePlaceholder}
          removeLabel={copy.removeItem}
        />
      </section>
    );
  }

  return (
    <section
      id={`custom-${section.id}`}
      className="pf-section proposal-pdf-page scroll-mt-6"
    >
      <div className="pf-kicker">{copy.sections.custom}</div>
      <EditableBlock
        as="h2"
        editable={editable}
        value={section.title}
        onChange={(title) => onPatchSection(section.id, { title })}
        className="pf-h2"
      />
      {editable ? (
        <EditableBlock
          editable
          value={section.body}
          onChange={(body) => onPatchSection(section.id, { body })}
          className="pf-lead"
        />
      ) : (
        <ProposalFormattedBody body={section.body} />
      )}
    </section>
  );
};
