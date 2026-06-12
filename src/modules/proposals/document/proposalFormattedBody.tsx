import { cn } from "@/lib/utils";

export type ProposalBodyLine = {
  title: string;
  detail: string;
};

const parseLineWithDetail = (line: string): ProposalBodyLine => {
  const text = line.replace(/^-\s*/, "").replace(/^\d+\.\s*/, "").trim();
  if (!text) return { title: "", detail: "" };
  const dash = text.indexOf("—");
  if (dash > -1) {
    return {
      title: text.slice(0, dash).trim(),
      detail: text.slice(dash + 1).trim(),
    };
  }
  const hyphen = text.indexOf(" - ");
  if (hyphen > -1) {
    return {
      title: text.slice(0, hyphen).trim(),
      detail: text.slice(hyphen + 3).trim(),
    };
  }
  return { title: text, detail: "" };
};

export type ProposalBodyBlock =
  | { type: "paragraph"; paragraphs: string[] }
  | { type: "bullets"; items: ProposalBodyLine[] }
  | { type: "numbered"; items: ProposalBodyLine[] };

export const parseProposalBodyBlocks = (body: string): ProposalBodyBlock[] => {
  const trimmed = body.trim();
  if (!trimmed) return [];

  return trimmed
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split("\n").map((line) => line.trim());

      if (lines.every((line) => !line || line.startsWith("-"))) {
        const items = lines
          .filter((line) => line.length > 0)
          .map(parseLineWithDetail);
        return { type: "bullets" as const, items };
      }

      if (lines.every((line) => /^\d+\.\s/.test(line))) {
        return {
          type: "numbered" as const,
          items: lines.map(parseLineWithDetail),
        };
      }

      return {
        type: "paragraph" as const,
        paragraphs: lines.filter(Boolean),
      };
    });
};

export const ProposalFormattedBody = ({
  body,
  className,
  listClassName,
  paragraphClassName,
  itemTitleClassName,
  itemDetailClassName,
}: {
  body: string;
  className?: string;
  listClassName?: string;
  paragraphClassName?: string;
  itemTitleClassName?: string;
  itemDetailClassName?: string;
}) => {
  const blocks = parseProposalBodyBlocks(body);
  if (blocks.length === 0) return null;

  return (
    <div className={cn("pf-body", className)}>
      {blocks.map((block, blockIndex) => {
        if (block.type === "paragraph") {
          return (
            <div key={`p-${blockIndex}`} className="pf-body-paragraphs">
              {block.paragraphs.map((paragraph, index) => (
                <p
                  key={`${blockIndex}-${index}`}
                  className={cn("pf-body-p", paragraphClassName)}
                >
                  {paragraph}
                </p>
              ))}
            </div>
          );
        }

        const ListTag = block.type === "numbered" ? "ol" : "ul";
        return (
          <ListTag
            key={`list-${blockIndex}`}
            className={cn(
              block.type === "numbered" ? "pf-body-ol" : "pf-body-ul",
              listClassName,
            )}
          >
            {block.items.map((item, index) => (
              <li key={`${blockIndex}-${index}`} className="pf-body-li">
                {item.title ? (
                  <span className={cn("pf-body-li-title", itemTitleClassName)}>
                    {item.title}
                  </span>
                ) : null}
                {item.detail ? (
                  <span className={cn("pf-body-li-detail", itemDetailClassName)}>
                    {item.detail}
                  </span>
                ) : null}
              </li>
            ))}
          </ListTag>
        );
      })}
    </div>
  );
};
