import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
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
import { InputHelperText } from "@/components/admin/input-helper-text";
import { cn } from "@/lib/utils";
import type {
  Deal,
  OrganizationMember,
  Person,
} from "@/components/atomic-crm/types";
import {
  findActiveMentionInEditor,
  insertTaskMemberMentionInEditor,
  insertTaskPersonMentionInEditor,
  renderTaskMentionEditorContent,
  serializeTaskMentionEditor,
} from "@/components/atomic-crm/tasks/taskMentionEditor";
import {
  getPersonName,
  getPersonOptionText,
} from "@/components/atomic-crm/tasks/taskPeopleOptions";

type MentionCandidate =
  | { kind: "person"; person: Person; onTeam: boolean; dedupeKey: string }
  | { kind: "member"; member: OrganizationMember; dedupeKey: string };

type TaskDescriptionMentionInputProps = {
  source?: string;
  label?: string | false;
  validate?: unknown;
  className?: string;
  rows?: number;
  defaultDealId?: string | number | null;
  autoFocus?: boolean;
};

const getMemberOptionText = (member: OrganizationMember) => {
  const fullName = [member.first_name, member.last_name]
    .filter(Boolean)
    .join(" ");
  return member.email ? `${fullName} (${member.email})` : fullName;
};

const normalizeEmail = (value?: string | null) =>
  value?.trim().toLowerCase() ?? "";

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

  const { data: people = [], isPending: isPeoplePending } = useGetList<Person>(
    "people",
    {
      filter: {
        "status@eq": "active",
        ...(searchText ? { q: searchText } : {}),
      },
      pagination: { page: 1, perPage: 20 },
      sort: { field: "first_name", order: "ASC" },
    },
    { enabled: mentionOpen, staleTime: 10_000 },
  );

  const { data: members = [], isPending: isMembersPending } =
    useGetList<OrganizationMember>(
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
    const reservedEmails = new Set<string>();
    const next: MentionCandidate[] = [];

    const sortedPeople = [...people].sort((left, right) => {
      const leftOnTeam = teamIdSet.has(String(left.id)) ? 0 : 1;
      const rightOnTeam = teamIdSet.has(String(right.id)) ? 0 : 1;
      if (leftOnTeam !== rightOnTeam) return leftOnTeam - rightOnTeam;
      return getPersonName(left).localeCompare(getPersonName(right));
    });

    sortedPeople.forEach((person) => {
      const email = normalizeEmail(person.email);
      if (email) reservedEmails.add(email);
      next.push({
        kind: "person",
        person,
        onTeam: teamIdSet.has(String(person.id)),
        dedupeKey: `person:${person.id}`,
      });
    });

    members.forEach((member) => {
      const email = normalizeEmail(member.email);
      if (email && reservedEmails.has(email)) return;
      next.push({
        kind: "member",
        member,
        dedupeKey: `member:${member.id}`,
      });
    });

    return next;
  }, [members, people, teamIdSet]);

  const isPending = isPeoplePending || isMembersPending;

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

  const selectCandidate = (candidate: MentionCandidate) => {
    if (!mentionRange) return;

    if (candidate.kind === "person") {
      insertTaskPersonMentionInEditor(mentionRange, candidate.person);
    } else {
      insertTaskMemberMentionInEditor(mentionRange, candidate.member);
    }

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
            data-placeholder="Describe the task. Type @ to tag someone, e.g. @Cristina has to send the invoice."
            onInput={handleInput}
            onClick={updateMentionState}
            onKeyUp={updateMentionState}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onBlur={field.onBlur}
          />

          {mentionOpen ? (
            <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border bg-popover shadow-md">
              {isPending ? (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  Loading people…
                </div>
              ) : candidates.length === 0 ? (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  No matches for “{mentionQuery || "@"}”
                </div>
              ) : (
                <ul className="max-h-48 overflow-y-auto py-1">
                  {candidates.map((candidate, index) => (
                    <li key={candidate.dedupeKey}>
                      <button
                        type="button"
                        className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted ${
                          index === highlightedIndex ? "bg-muted" : ""
                        }`}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => selectCandidate(candidate)}
                      >
                        <span>
                          {candidate.kind === "person"
                            ? getPersonOptionText(candidate.person)
                            : getMemberOptionText(candidate.member)}
                        </span>
                        <span className="ml-2 text-[10px] uppercase text-muted-foreground">
                          {candidate.kind === "person"
                            ? candidate.onTeam
                              ? "Project"
                              : "Employee"
                            : "CRM user"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </div>
      </FormControl>
      <InputHelperText helperText="Use @ to tag employees or CRM users directly in the description." />
      <FormError />
    </FormField>
  );
};
