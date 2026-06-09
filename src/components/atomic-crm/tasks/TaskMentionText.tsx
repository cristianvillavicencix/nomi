import { Link } from "react-router";
import { parseTaskMentionSegments } from "@/components/atomic-crm/tasks/taskMentions";

export const TaskMentionText = ({
  text,
  className,
}: {
  text?: string | null;
  className?: string;
}) => {
  if (!text) return null;

  const segments = parseTaskMentionSegments(text);

  return (
    <span className={className}>
      {segments.map((segment, index) => {
        if (segment.type === "text") {
          return <span key={`text-${index}`}>{segment.value}</span>;
        }

        return (
          <Link
            key={`member-${segment.id}-${index}`}
            to={`/organization_members/${segment.id}`}
            className="font-semibold text-foreground underline-offset-2 hover:underline"
            onClick={(event) => event.stopPropagation()}
          >
            @{segment.name}
          </Link>
        );
      })}
    </span>
  );
};
