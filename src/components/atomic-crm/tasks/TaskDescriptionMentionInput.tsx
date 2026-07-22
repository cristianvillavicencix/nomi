import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  useGetList,
  useGetOne,
  useInput,
  useResourceContext,
  FieldTitle,
} from "ra-core";
import { useWatch } from "react-hook-form";
import {
  FormControl,
  FormError,
  FormField,
  FormLabel,
} from "@/components/admin/form";
import { cn } from "@/lib/utils";
import type { Deal, OrganizationMember } from "@/components/atomic-crm/types";
import {
  findActiveMentionInEditor,
  insertTaskMemberMentionInEditor,
  renderTaskMentionEditorContent,
  serializeTaskMentionEditor,
} from "@/components/atomic-crm/tasks/taskMentionEditor";
import {
  getMemberName,
  getMemberOptionText,
} from "@/components/atomic-crm/tasks/taskMemberOptions";

type TaskDescriptionMentionInputProps = {
  source?: string;
  label?: string | false;
  validate?: unknown;
  className?: string;
  rows?: number;
  defaultDealId?: string | number | null;
  autoFocus?: boolean;
};

export const TaskDescriptionMentionInput = ({
  source = "text",
  label = "Description",
  className,
  rows = 4,
  defaultDealId,
  autoFocus,
  ...validateProps
}: TaskDescriptionMentionInputProps) => {
  const resource = useResourceContext();
  const editorRef = useRef<HTMLDivElement>(null);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionRange, setMentionRange] = useState<Range | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [mentionDropdownRect, setMentionDropdownRect] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const { id, field, isRequired } = useInput({
    source,
    ...validateProps,
  });

  const dealId = useWatch({ name: "deal_id" }) ?? defaultDealId ?? null;

  const { data: deal } = useGetOne<Deal>(
    "deals",
    { id: dealId! },
    { enabled: dealId != null },
  );

  const teamIdSet = useMemo(
    () =>
      new Set(
        Array.isArray(deal?.salesperson_ids)
          ? deal.salesperson_ids.map(String)
          : [],
      ),
    [deal?.salesperson_ids],
  );

  const mentionOpen = mentionRange != null;
  const searchText = mentionQuery.trim();

  const { data: members = [], isPending } = useGetList<OrganizationMember>(
    "organization_members",
    {
      filter: {
        "disabled@neq": true,
        ...(searchText ? { q: searchText } : {}),
      },
      pagination: { page: 1, perPage: 20 },
      sort: { field: "first_name", order: "ASC" },
    },
    { enabled: mentionOpen, staleTime: 10_000 },
  );

  const candidates = useMemo(() => {
    return [...members].sort((left, right) => {
      const leftOnTeam = teamIdSet.has(String(left.id)) ? 0 : 1;
      const rightOnTeam = teamIdSet.has(String(right.id)) ? 0 : 1;
      if (leftOnTeam !== rightOnTeam) return leftOnTeam - rightOnTeam;
      return getMemberName(left).localeCompare(getMemberName(right));
    });
  }, [members, teamIdSet]);

  const updateMentionDropdownRect = () => {
    const editor = editorRef.current;
    if (!editor || mentionRange == null) {
      setMentionDropdownRect(null);
      return;
    }

    const rect = editor.getBoundingClientRect();
    setMentionDropdownRect({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    });
  };

  useLayoutEffect(() => {
    if (!mentionOpen) {
      setMentionDropdownRect(null);
      return;
    }

    updateMentionDropdownRect();

    const handleReposition = () => updateMentionDropdownRect();
    window.addEventListener("scroll", handleReposition, true);
    window.addEventListener("resize", handleReposition);

    return () => {
      window.removeEventListener("scroll", handleReposition, true);
      window.removeEventListener("resize", handleReposition);
    };
  }, [mentionOpen, mentionQuery, candidates.length]);

  const syncEditorFromValue = (value?: string | null) => {
    const editor = editorRef.current;
    if (!editor) return;

    const nextValue = value ?? "";
    if (serializeTaskMentionEditor(editor) === nextValue) return;

    renderTaskMentionEditorContent(editor, nextValue);
  };

  useEffect(() => {
    syncEditorFromValue(field.value);
  }, [field.value]);

  useEffect(() => {
    if (!autoFocus || !editorRef.current) return;
    editorRef.current.focus();
  }, [autoFocus]);

  const updateMentionState = () => {
    const editor = editorRef.current;
    if (!editor) return;

    const activeMention = findActiveMentionInEditor(editor);
    if (!activeMention) {
      setMentionRange(null);
      setMentionQuery("");
      setHighlightedIndex(0);
      return;
    }

    setMentionRange(activeMention.range);
    setMentionQuery(activeMention.query);
    setHighlightedIndex(0);
  };

  const handleInput = () => {
    const editor = editorRef.current;
    if (!editor) return;

    const serialized = serializeTaskMentionEditor(editor);
    field.onChange(serialized);
    updateMentionState();
  };

  const selectCandidate = (member: OrganizationMember) => {
    if (!mentionRange) return;

    insertTaskMemberMentionInEditor(mentionRange, member);

    setMentionRange(null);
    setMentionQuery("");
    setHighlightedIndex(0);
    handleInput();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!mentionOpen || candidates.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((current) => (current + 1) % candidates.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex(
        (current) => (current - 1 + candidates.length) % candidates.length,
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      selectCandidate(candidates[highlightedIndex]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setMentionRange(null);
      setMentionQuery("");
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const text = event.clipboardData.getData("text/plain");
    if (!text) return;
    document.execCommand("insertText", false, text);
    handleInput();
  };

  const minHeightClass =
    rows <= 2 ? "min-h-16" : rows <= 4 ? "min-h-24" : "min-h-32";

  const mentionDropdown =
    mentionOpen && mentionDropdownRect
      ? createPortal(
          <div
            className="overflow-hidden rounded-md border bg-popover shadow-md"
            style={{
              position: "fixed",
              top: mentionDropdownRect.top,
              left: mentionDropdownRect.left,
              width: mentionDropdownRect.width,
              zIndex: 100,
            }}
          >
            {isPending ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                Loading team members…
              </div>
            ) : candidates.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                No matches for “{mentionQuery || "@"}”
              </div>
            ) : (
              <ul className="max-h-48 overflow-y-auto py-1">
                {candidates.map((member, index) => (
                  <li key={`member:${member.id}`}>
                    <button
                      type="button"
                      className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted ${
                        index === highlightedIndex ? "bg-muted" : ""
                      }`}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => selectCandidate(member)}
                    >
                      <span>{getMemberOptionText(member)}</span>
                      <span className="ml-2 text-[10px] uppercase text-muted-foreground">
                        {teamIdSet.has(String(member.id))
                          ? "Project"
                          : "Team member"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>,
          document.body,
        )
      : null;

  return (
    <FormField id={id} className={className} name={field.name}>
      {label !== false ? (
        <FormLabel>
          <FieldTitle
            label={label}
            source={source}
            resource={resource}
            isRequired={isRequired}
          />
        </FormLabel>
      ) : null}
      <FormControl>
        <div className="relative">
          <div
            ref={editorRef}
            id={id}
            role="textbox"
            aria-multiline="true"
            contentEditable
            suppressContentEditableWarning
            data-slot="textarea"
            className={cn(
              "border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] whitespace-pre-wrap break-words empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]",
              minHeightClass,
            )}
            data-placeholder="Describe the task…"
            onInput={handleInput}
            onClick={updateMentionState}
            onKeyUp={updateMentionState}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onBlur={field.onBlur}
          />
        </div>
      </FormControl>
      {mentionDropdown}
      <FormError />
    </FormField>
  );
};
