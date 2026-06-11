# Calendar + Meetings

## 1. Purpose

**Calendar** (`/calendar`): month/week views of `calendar_events` and task due dates; reminder scheduling. **Meetings** (`/meetings`): list of events with `meeting_url`; quick meeting creation, send link, mark done.

## 2. Files & components

| Kind | Path |
|------|------|
| Routes | `/calendar`, `/meetings` in `src/lbs/LbsCustomRoutes.tsx` |
| Calendar | `src/lbs/calendar/` — `CalendarPage`, grids, `useCalendarEvents`, `CalendarReminderDialog` |
| Meetings | `src/lbs/meetings/` — `MeetingsPage`, `QuickMeetingDialog`, `MeetingLinkActions`, `MeetingDoneSwitch` |
| Write helper | `calendarEventWriteData.ts`, `calendarReminderOptions.ts` |
| DataProvider | `prepareCalendarEventWriteData` lifecycle; `notifyFollowUp`, `sendMeetingLink` |

## 3. Database

| Table / view | Usage |
|--------------|--------|
| `calendar_events` | CRUD; meetings = rows where `meeting_url` is set |
| `tasks` | Due dates merged into calendar grid |
| `deals`, `contacts`, `organization_members` | Display / references |

Filters use PostgREST operators: `@gte`, `@lte`, `@eq`, `@is`, `@not.is` (via `useCalendarEvents.ts`).

## 4. External services

- **SMS/email for reminders:** `notify_follow_up` edge function (Twilio/Postmark depending on org config).
- **Meeting links:** `send_meeting_link` edge function.

## 5. Connections to other modules

| Direction | Module | Link |
|-----------|--------|------|
| Shares data | Tasks | Task due dates on calendar |
| Links to | Deals / Contacts | Event associations |
| Links to | Messages | SMS path for meeting links / reminders |
| Settings | Messaging / email | Twilio/Postmark credentials |

## 6. Edge functions used by this module

| Function | Invoked from | Purpose |
|----------|--------------|---------|
| `send_meeting_link` | `dataProvider.sendMeetingLink()` (~2609) | SMS meeting URL to contact |
| `notify_follow_up` | `dataProvider.notifyFollowUp()` (~2845) | Calendar reminder / follow-up SMS |

**Not scheduled in production DB:** `send_calendar_reminders` — **DORMANT** (approved: do not wire pg_cron yet). Manual `notifyFollowUp` still works from UI.

## 7. Status: WORKING (desktop)

Calendar and meetings work on desktop when messaging is configured. **Desktop only** — not in `MobileAdmin` custom routes.

## 8. Issues found

| Severity | Location | User impact | Root cause |
|----------|----------|-------------|------------|
| MEDIUM | `LbsCustomRoutes.tsx` | Wrong users may access calendar | Routes guarded with `resource="tasks" action="list"` instead of `calendar.view` / `meetings.view` capabilities |
| HIGH | Ops | Reminder SMS may never fire on schedule | `send_calendar_reminders` not wired to pg_cron (verified live `cron.job` — absent) |
| LOW | `calendarEventWriteData.ts` | Legacy field stripping | Documents dropped B3 columns — OK but adds maintenance burden |

## 9. Broken connections

- Reminder cron path: UI can trigger `notifyFollowUp` manually; automated batch reminders depend on unwired `send_calendar_reminders`.
- Capability catalog lists `calendar.view` / `meetings.view` but route guards do not enforce them.
