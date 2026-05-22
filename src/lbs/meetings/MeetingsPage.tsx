import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Plus, Video } from "lucide-react";
import { useGetList, useGetMany, type Identifier } from "ra-core";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  StickyPageHeader,
} from "@/components/atomic-crm/layout/page-shell";
import { ModuleInfoPopover } from "@/components/atomic-crm/layout/ModuleInfoPopover";
import type { CalendarEventRecord, Contact } from "@/components/atomic-crm/types";
import { CalendarReminderDialog } from "@/lbs/calendar/CalendarReminderDialog";
import {
  formatEventTimeRange,
  formatDurationLabel,
  getContactDisplayName,
  DEFAULT_MEETING_DURATION_MINUTES,
} from "@/lbs/calendar/calendarReminderOptions";
import { toDateKey } from "@/lbs/calendar/calendarUtils";
import { MeetingLinkActions } from "@/lbs/meetings/MeetingLinkActions";
import { MeetingDoneSwitch } from "@/lbs/meetings/MeetingDoneSwitch";

type MeetingsTab = "upcoming" | "past";

const formatMeetingDate = (record: CalendarEventRecord) =>
  new Date(`${record.event_date}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

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
  const [editId, setEditId] = useState<Identifier | null>(null);
  const [editDateKey, setEditDateKey] = useState(todayKey);

  const { data: meetings = [], isPending } = useGetList<CalendarEventRecord>(
    "calendar_events",
    {
      filter: { "meeting_url@not.is": null },
      pagination: { page: 1, perPage: 200 },
      sort: { field: "event_date", order: tab === "upcoming" ? "ASC" : "DESC" },
    },
    { staleTime: 30_000 },
  );

  const contactIds = useMemo(
    () =>
      [
        ...new Set(
          meetings
            .map((meeting) => meeting.contact_id)
            .filter((id): id is Identifier => id != null && String(id).trim() !== ""),
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

  const filteredMeetings = useMemo(() => {
    const scoped = meetings.filter((record) =>
      tab === "upcoming"
        ? isUpcomingMeeting(record, todayKey)
        : !isUpcomingMeeting(record, todayKey),
    );

    return [...scoped].sort((left, right) => {
      const diff = getMeetingSortKey(left).localeCompare(getMeetingSortKey(right));
      return tab === "upcoming" ? diff : -diff;
    });
  }, [meetings, tab, todayKey]);

  const scheduleDefaults = useMemo(
    () => ({
      title: "",
      event_date: todayKey,
      event_time: null,
      duration_minutes: DEFAULT_MEETING_DURATION_MINUTES,
      remind_before_minutes: 15,
      description: "",
      person_id: null,
      contact_id: null,
      deal_id: null,
      meeting_url: null,
      completed_at: null,
    }),
    [todayKey],
  );

  return (
    <PageLayout>
      <StickyPageHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">Meetings</h1>
            <ModuleInfoPopover
              title="Video meetings"
              description="Schedule Jitsi video calls with clients. Pick a contact first — the title and link are generated from that person."
            />
          </div>
          <Button
            type="button"
            onClick={() => {
              setEditId(null);
              setEditDateKey(todayKey);
              setScheduleOpen(true);
            }}
          >
            <Plus className="size-4" />
            Schedule meeting
          </Button>
        </div>

        <Tabs value={tab} onValueChange={(value) => setTab(value as MeetingsTab)}>
          <TabsList>
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="past">Past</TabsTrigger>
          </TabsList>
        </Tabs>
      </StickyPageHeader>

      <ScrollableContentArea>
        {isPending ? null : filteredMeetings.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <Video className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">
              {tab === "upcoming" ? "No upcoming video calls" : "No past video calls"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Schedule a meeting and choose a contact to generate the call link.
            </p>
            {tab === "upcoming" ? (
              <Button
                type="button"
                className="mt-4"
                variant="outline"
                onClick={() => setScheduleOpen(true)}
              >
                Schedule meeting
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contact</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead className="w-[72px] text-center">Done</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMeetings.map((meeting) => {
                  const contactName = meeting.contact_id
                    ? contactNameById.get(String(meeting.contact_id)) ?? "—"
                    : "—";
                  const timeLabel =
                    formatEventTimeRange(meeting.event_time, meeting.duration_minutes) ?? "—";
                  const durationLabel =
                    formatDurationLabel(meeting.duration_minutes) ?? "—";
                  const isDone = Boolean(meeting.completed_at);

                  return (
                    <TableRow
                      key={String(meeting.id)}
                      className={isDone ? "opacity-70" : undefined}
                    >
                      <TableCell className="font-medium">
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
                      </TableCell>
                      <TableCell className={isDone ? "line-through" : undefined}>
                        {meeting.title}
                      </TableCell>
                      <TableCell>{formatMeetingDate(meeting.event_date)}</TableCell>
                      <TableCell>{timeLabel}</TableCell>
                      <TableCell>{durationLabel}</TableCell>
                      <TableCell>
                        <MeetingDoneSwitch meeting={meeting} />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <MeetingLinkActions meetingUrl={meeting.meeting_url} />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditId(meeting.id);
                              setEditDateKey(meeting.event_date);
                              setScheduleOpen(true);
                            }}
                          >
                            Edit
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </ScrollableContentArea>

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
