import { useMemo, useState } from "react";
import { Link } from "react-router";
import { ChevronDown, Plus, Video, Zap } from "lucide-react";
import { useGetList, useGetMany, type Identifier } from "ra-core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  PageLayout,
  ScrollableContentArea,
} from "@/components/atomic-crm/layout/page-shell";
import {
  PageActions,
  PageTitle,
} from "@/components/atomic-crm/layout/PageActions";
import {
  ModuleSearchField,
  ModuleToolbar,
  ModuleToolbarActions,
} from "@/components/atomic-crm/layout/ModuleToolbar";
import type {
  CalendarEventRecord,
  Contact,
  Company,
  OrganizationMember,
} from "@/components/atomic-crm/types";
import { CompanyAvatar } from "@/components/atomic-crm/companies/CompanyAvatar";
import { CalendarReminderDialog } from "@/modules/calendar/CalendarReminderDialog";
import {
  formatEventTimeRange,
  formatDurationLabel,
  getContactDisplayName,
  DEFAULT_MEETING_DURATION_MINUTES,
} from "@/modules/calendar/calendarReminderOptions";
import { CalendarEventAssigneeAvatars } from "@/modules/calendar/CalendarEventAssigneeAvatars";
import { toDateKey, type CalendarEvent } from "@/modules/calendar/calendarUtils";
import { MeetingRowActionsMenu } from "@/modules/meetings/MeetingRowActionsMenu";
import {
  MeetingDoneSwitch,
  MarkMeetingDoneButton,
} from "@/modules/meetings/MeetingDoneSwitch";
import { QuickMeetingDialog } from "@/modules/meetings/QuickMeetingDialog";

type MeetingsTab = "upcoming" | "past";

const formatMeetingDate = (eventDate: string) => {
  const date = new Date(`${eventDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
};

const getMeetingSortKey = (record: CalendarEventRecord) => {
  const time = record.event_time?.slice(0, 5) ?? "00:00";
  return `${record.event_date}T${time}`;
};

const isUpcomingMeeting = (record: CalendarEventRecord, todayKey: string) => {
  if (record.completed_at) return false;
  return record.event_date >= todayKey;
};

export const MeetingsPage = () => {
  const todayKey = toDateKey(new Date());
  const [tab, setTab] = useState<MeetingsTab>("upcoming");
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [editId, setEditId] = useState<Identifier | null>(null);
  const [editDateKey, setEditDateKey] = useState(todayKey);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: meetings = [], isPending } = useGetList<CalendarEventRecord>(
    "calendar_events",
    {
      filter: { "meeting_format@not.is": null },
      pagination: { page: 1, perPage: 200 },
      sort: { field: "event_date", order: tab === "upcoming" ? "ASC" : "DESC" },
    },
    { staleTime: 30_000 },
  );

  const contactIds = useMemo(
    () => [
      ...new Set(
        meetings
          .map((meeting) => meeting.contact_id)
          .filter(
            (id): id is Identifier => id != null && String(id).trim() !== "",
          ),
      ),
    ],
    [meetings],
  );

  const { data: contacts = [] } = useGetMany<Contact>(
    "contacts_summary",
    { ids: contactIds },
    { enabled: contactIds.length > 0 },
  );

  const contactNameById = useMemo(() => {
    const map = new Map<string, string>();
    contacts.forEach((contact) => {
      map.set(String(contact.id), getContactDisplayName(contact));
    });
    return map;
  }, [contacts]);

  const companyIds = useMemo(() => {
    const ids = meetings
      .map((meeting) => meeting.company_id)
      .filter(
        (id): id is Identifier =>
          id != null && String(id).trim() !== "",
      );
    return Array.from(new Set(ids));
  }, [meetings]);

  const { data: companies = [] } = useGetMany<Company>(
    "companies_summary",
    { ids: companyIds },
    { enabled: companyIds.length > 0 },
  );

  const companiesById = useMemo(() => {
    return new Map(companies.map((company) => [String(company.id), company]));
  }, [companies]);

  const memberIds = useMemo(() => {
    const ids = new Set<Identifier>();
    for (const meeting of meetings) {
      if (
        meeting.organization_member_id != null &&
        String(meeting.organization_member_id).trim() !== ""
      ) {
        ids.add(meeting.organization_member_id);
      }
      for (const id of meeting.assignee_member_ids ?? []) {
        if (id != null && String(id).trim() !== "") {
          ids.add(id);
        }
      }
    }
    return Array.from(ids);
  }, [meetings]);

  const { data: members = [] } = useGetMany<OrganizationMember>(
    "organization_members",
    { ids: memberIds },
    { enabled: memberIds.length > 0 },
  );

  const membersById = useMemo(() => {
    return new Map(members.map((member) => [String(member.id), member]));
  }, [members]);

  const filteredMeetings = useMemo(() => {
    const scoped = meetings.filter((record) =>
      tab === "upcoming"
        ? isUpcomingMeeting(record, todayKey)
        : !isUpcomingMeeting(record, todayKey),
    );

    const sorted = [...scoped].sort((left, right) => {
      const diff = getMeetingSortKey(left).localeCompare(
        getMeetingSortKey(right),
      );
      return tab === "upcoming" ? diff : -diff;
    });

    const trimmed = searchQuery.trim().toLowerCase();
    if (!trimmed) return sorted;

    return sorted.filter((record) => {
      const contactName = record.contact_id
        ? contactNameById.get(String(record.contact_id))
        : null;
      const haystack = [record.title, contactName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(trimmed);
    });
  }, [meetings, tab, todayKey, searchQuery, contactNameById]);

  const scheduleDefaults = useMemo(
    () => ({
      title: "",
      event_date: todayKey,
      event_time: null,
      duration_minutes: DEFAULT_MEETING_DURATION_MINUTES,
      remind_before_minutes: 15,
      description: "",
      contact_id: null,
      deal_id: null,
      meeting_url: null,
      meeting_format: "video",
      location: null,
      completed_at: null,
    }),
    [todayKey],
  );

  return (
    <PageLayout className="gap-3">
      <PageActions>
        <PageTitle label="Meetings" />
      </PageActions>

      <ModuleToolbar className="shrink-0">
          <ModuleSearchField
            value={searchQuery}
            onChange={setSearchQuery}
            basePlaceholder="Search meetings by title or contact"
            total={filteredMeetings.length}
            itemSingular="meeting"
          />
          <ModuleToolbarActions>
            <ToggleGroup
              type="single"
              value={tab}
              onValueChange={(value) => {
                if (value === "upcoming" || value === "past") {
                  setTab(value);
                }
              }}
              variant="outline"
              size="sm"
              className="w-fit shrink-0"
            >
              <ToggleGroupItem value="upcoming" aria-label="Upcoming meetings">
                Upcoming
              </ToggleGroupItem>
              <ToggleGroupItem value="past" aria-label="Past meetings">
                Past
              </ToggleGroupItem>
            </ToggleGroup>
            <div className="flex shrink-0 items-stretch">
              <Button
                type="button"
                size="sm"
                variant="primary"
                className="rounded-r-none"
                onClick={() => setQuickOpen(true)}
                aria-label="Quick call"
              >
                <Zap className="size-4" />
                Quick call
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    variant="primary"
                    className="rounded-l-none border-l border-primary-foreground/20 px-2"
                    aria-label="More meeting options"
                  >
                    <ChevronDown className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onSelect={() => {
                      setEditId(null);
                      setEditDateKey(todayKey);
                      setScheduleOpen(true);
                    }}
                  >
                    <Plus className="size-4" />
                    Schedule meeting
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </ModuleToolbarActions>
        </ModuleToolbar>

      <ScrollableContentArea className="min-h-0 flex-1">
        {isPending ? null : filteredMeetings.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <Video className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">
              {tab === "upcoming"
                ? "No upcoming video calls"
                : "No past video calls"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Schedule a meeting and choose a contact to generate the call link.
            </p>
            {tab === "upcoming" ? (
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <Button type="button" onClick={() => setQuickOpen(true)}>
                  <Zap className="size-4" />
                  Quick call
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setScheduleOpen(true)}
                >
                  Schedule meeting
                </Button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contact</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead
                    className={
                      tab === "upcoming" ? "w-[72px] text-center" : "w-[88px]"
                    }
                  >
                    {tab === "upcoming" ? "Done" : "Status"}
                  </TableHead>
                  <TableHead className="w-[52px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMeetings.map((meeting) => {
                  const contactName = meeting.contact_id
                    ? (contactNameById.get(String(meeting.contact_id)) ?? "—")
                    : "—";
                  const timeLabel =
                    formatEventTimeRange(
                      meeting.event_time,
                      meeting.duration_minutes,
                    ) ?? "—";
                  const durationLabel =
                    formatDurationLabel(meeting.duration_minutes) ?? "—";
                  const isDone = Boolean(meeting.completed_at);
                  const isPastTab = tab === "past";
                  const company =
                    meeting.company_id != null
                      ? companiesById.get(String(meeting.company_id)) ?? null
                      : null;

                  const calendarEventForAvatars = {
                    kind: "meeting",
                    id: String(meeting.id),
                    date: meeting.event_date,
                    time: meeting.event_time ?? null,
                    title: meeting.title,
                    record: meeting,
                    done: isDone,
                    assignedName: null,
                    contactName: null,
                  } as CalendarEvent;

                  return (
                    <TableRow key={String(meeting.id)}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {company ? (
                            <CompanyAvatar record={company} width={20} />
                          ) : null}
                          {meeting.contact_id ? (
                            <Link
                              to={`/contacts/${meeting.contact_id}/show`}
                              className="link-action"
                            >
                              {contactName}
                            </Link>
                          ) : (
                            contactName
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <CalendarEventAssigneeAvatars
                          event={calendarEventForAvatars}
                          membersById={membersById}
                          compact
                        />
                      </TableCell>
                      <TableCell>{meeting.title}</TableCell>
                      <TableCell>
                        {formatMeetingDate(meeting.event_date)}
                      </TableCell>
                      <TableCell>{timeLabel}</TableCell>
                      <TableCell>{durationLabel}</TableCell>
                      <TableCell
                        className={isPastTab ? undefined : "text-center"}
                      >
                        {isPastTab ? (
                          isDone ? (
                            <Badge variant="secondary">Done</Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              —
                            </span>
                          )
                        ) : (
                          <MeetingDoneSwitch meeting={meeting} />
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {isPastTab ? (
                          <div className="flex items-center justify-end gap-1">
                            {!isDone ? (
                              <MarkMeetingDoneButton meeting={meeting} />
                            ) : null}
                            <MeetingRowActionsMenu
                              meeting={meeting}
                              onEdit={() => {
                                setEditId(meeting.id);
                                setEditDateKey(meeting.event_date);
                                setScheduleOpen(true);
                              }}
                            />
                          </div>
                        ) : (
                          <MeetingRowActionsMenu
                            meeting={meeting}
                            onEdit={() => {
                              setEditId(meeting.id);
                              setEditDateKey(meeting.event_date);
                              setScheduleOpen(true);
                            }}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </ScrollableContentArea>

      <QuickMeetingDialog open={quickOpen} onOpenChange={setQuickOpen} />

      <CalendarReminderDialog
        open={scheduleOpen}
        onOpenChange={(open) => {
          setScheduleOpen(open);
          if (!open) setEditId(null);
        }}
        dateKey={editDateKey}
        reminderId={editId}
        variant="meeting"
        initialRecord={editId ? undefined : scheduleDefaults}
      />
    </PageLayout>
  );
};
