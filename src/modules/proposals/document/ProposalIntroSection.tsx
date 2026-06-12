import { EditableBlock } from "@/modules/proposals/document/EditableBlock";
import { ProposalImageDropZone } from "@/modules/proposals/document/ProposalImageDropZone";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

const splitPreambleParagraphs = (text: string) =>
  text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

export const ProposalIntroSection = ({
  title,
  body,
  editable,
  eyebrow,
  onTitleChange,
  onBodyChange,
  titlePlaceholder = "Introduction title",
  bodyPlaceholder = "Write your introduction… Use blank lines between paragraphs.",
  editHint,
  variant = "default",
  signatory,
  signatoryCompany,
  signatoryImageUrl,
  signatoryNamePlaceholder = "Contact name on this proposal",
  signatoryCompanyPlaceholder = "Organization",
  signatoryHint,
  signatoryOrgLabel = "Latinos Business Support",
  orgId,
  proposalId,
  onSignatoryNameChange,
  onSignatoryCompanyChange,
  onSignatoryImageChange,
  embedded = false,
}: {
  title: string;
  body: string;
  editable: boolean;
  eyebrow: string;
  onTitleChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  titlePlaceholder?: string;
  bodyPlaceholder?: string;
  editHint?: string;
  variant?: "default" | "formal";
  /** Display name on the intro letter (proposal contact). */
  signatory?: string;
  signatoryCompany?: string;
  signatoryImageUrl?: string | null;
  signatoryNamePlaceholder?: string;
  signatoryCompanyPlaceholder?: string;
  signatoryHint?: string;
  signatoryOrgLabel?: string;
  orgId?: number;
  proposalId?: number;
  onSignatoryNameChange?: (value: string) => void;
  onSignatoryCompanyChange?: (value: string) => void;
  onSignatoryImageChange?: (url: string | null) => void;
  embedded?: boolean;
}) => {
  const paragraphs = splitPreambleParagraphs(body);
  const hasBody = paragraphs.length > 0;
  const displayName = signatory?.trim();
  const displayCompany =
    signatoryCompany?.trim() || signatoryOrgLabel;
  const showSignatory =
    editable ||
    Boolean(displayName) ||
    Boolean(signatoryImageUrl?.trim());

  const initialsFromName = (name: string) =>
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");

  const signatoryBlock = showSignatory ? (
    <div className="pf-signatory mt-6 border-t border-border pt-4">
      <div className="flex items-center gap-3">
        {orgId != null && proposalId != null ? (
          <ProposalImageDropZone
            imageUrl={signatoryImageUrl}
            onChange={onSignatoryImageChange}
            orgId={orgId}
            proposalId={proposalId}
            editable={editable}
            aspectClass="pf-avatar size-14 shrink-0 sm:size-16"
            placeholder="Profile photo"
            initials={
              displayName ? initialsFromName(displayName) : undefined
            }
            className="mb-0"
          />
        ) : (
          <div className="pf-avatar pf-avatar-fallback size-14 shrink-0 sm:size-16">
            {displayName ? initialsFromName(displayName) : "?"}
          </div>
        )}
        <div className="min-w-0 flex-1 leading-tight">
          {editable ? (
            <div className="space-y-1">
              <Input
                value={signatory ?? ""}
                onChange={(event) =>
                  onSignatoryNameChange?.(event.target.value)
                }
                placeholder={signatoryNamePlaceholder}
                className="h-8 border-[#eceef2] text-sm font-bold"
              />
              <Input
                value={signatoryCompany ?? ""}
                onChange={(event) =>
                  onSignatoryCompanyChange?.(event.target.value)
                }
                placeholder={signatoryCompanyPlaceholder}
                className="h-7 border-[#eceef2] text-xs text-muted-foreground"
              />
              {signatoryHint ? (
                <p className="text-[10px] text-[#9aa3b5]">{signatoryHint}</p>
              ) : null}
            </div>
          ) : (
            <>
              <p className="text-sm font-bold text-foreground">
                {displayName || "Prepared by"}
              </p>
              <p className="text-xs text-muted-foreground">{displayCompany}</p>
            </>
          )}
        </div>
      </div>
    </div>
  ) : null;

  if (variant === "formal") {
    const letter = (
      <div className="pf-letter">
        {editable ? (
          <div className="space-y-2">
            <EditableBlock
              as="h2"
              editable
              value={title}
              onChange={onTitleChange}
              placeholder={titlePlaceholder}
              className="pf-h2 !mb-4"
            />
            <EditableBlock
              editable
              value={body}
              onChange={onBodyChange}
              placeholder={bodyPlaceholder}
              className="min-h-[10rem] text-[15.5px] leading-[1.8] text-[#475068]"
            />
            {editHint ? (
              <p className="text-xs text-[#9aa3b5]">{editHint}</p>
            ) : null}
          </div>
        ) : hasBody ? (
          <>
            {title.trim() ? <h2 className="pf-h2">{title}</h2> : null}
            {paragraphs.map((paragraph, index) => (
              <p key={String(index)}>{paragraph}</p>
            ))}
          </>
        ) : (
          <p className="text-sm text-[#9aa3b5]">{bodyPlaceholder}</p>
        )}
        {signatoryBlock}
      </div>
    );

    if (embedded) return letter;
    return (
      <section id="intro" className="pf-section scroll-mt-6">
        {letter}
      </section>
    );
  }

  return (
    <section id="intro" className="scroll-mt-6 space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {eyebrow}
      </p>

      <div
        className={cn(
          "relative rounded-2xl border bg-card/60 p-6 sm:p-8",
          "border-l-4 border-l-primary/80 shadow-sm",
        )}
      >
        <EditableBlock
          as="h2"
          editable={editable}
          value={title}
          onChange={onTitleChange}
          placeholder={titlePlaceholder}
          className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"
        />

        {editable ? (
          <div className="mt-5 space-y-2">
            <EditableBlock
              editable
              value={body}
              onChange={onBodyChange}
              placeholder={bodyPlaceholder}
              className="min-h-[12rem] text-base leading-relaxed text-foreground/90"
            />
            {editHint ? (
              <p className="text-xs text-muted-foreground">{editHint}</p>
            ) : null}
          </div>
        ) : hasBody ? (
          <div className="mt-5 space-y-4 text-base leading-relaxed text-muted-foreground">
            {paragraphs.map((paragraph, index) => (
              <p
                key={String(index)}
                className={cn(
                  index === 0 && "text-foreground/90 text-[1.05rem] leading-relaxed",
                )}
              >
                {paragraph}
              </p>
            ))}
          </div>
        ) : (
          <p className="mt-5 text-sm text-muted-foreground">{bodyPlaceholder}</p>
        )}
        {signatoryBlock}
      </div>
    </section>
  );
};
