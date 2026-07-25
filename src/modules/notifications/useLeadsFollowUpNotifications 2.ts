import { useEffect, useRef } from "react";
import { useGetIdentity } from "ra-core";

import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import { LBS_LEAD_STATUSES } from "@/modules/constants/contactStatus";
import { getLeadDisplayName } from "@/modules/leads/leadCardUtils";
import type { Contact } from "@/components/atomic-crm/types";
import { useNotificationPrefsContext } from "@/modules/notifications/NotificationPrefsContext";

const POLL_MS = 5 * 60 * 1000;
const STALE_DAYS = 4;

const todayKey = () => new Date().toISOString().slice(0, 10);

const storageKey = (prefix: string, leadId: string | number) =>
  `nomi.notify.${prefix}.${leadId}.${todayKey()}`;

const wasNotifiedToday = (prefix: string, leadId: string | number) => {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(storageKey(prefix, leadId)) === "1";
};

const markNotifiedToday = (prefix: string, leadId: string | number) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(prefix, leadId), "1");
};

const isAssignedToMember = (lead: Contact, memberId: string | number) => {
  const ids = lead.assigned_member_ids ?? [];
  if (ids.some((id) => String(id) === String(memberId))) return true;
  return String(lead.organization_member_id ?? "") === String(memberId);
};

export const useLeadsFollowUpNotifications = () => {
  const { identity } = useGetIdentity();
  const { pushNotification } = useNotificationPrefsContext();
  const runningRef = useRef(false);

  useEffect(() => {
    if (!identity?.id) return;

    const run = async () => {
      if (runningRef.current) return;
      runningRef.current = true;

      try {
        const staleCutoff = new Date(
          Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000,
        ).toISOString();

        const { data: leads, error } = await supabase
          .from("contacts_summary")
          .select(
            "id, first_name, last_name, company_name, lead_stage, next_followup_at, last_contacted_at, last_seen, assigned_member_ids, organization_member_id, status",
          )
          .in("status", [...LBS_LEAD_STATUSES]);

        if (error || !leads?.length) return;

        for (const lead of leads as Contact[]) {
          if (lead.lead_stage === "won" || lead.lead_stage === "lost") continue;
          if (!isAssignedToMember(lead, identity.id)) continue;

          if (
            lead.next_followup_at &&
            new Date(lead.next_followup_at).getTime() <= Date.now() &&
            !wasNotifiedToday("followup", lead.id)
          ) {
            markNotifiedToday("followup", lead.id);
            pushNotification({
              category: "leads_followup_due",
              title: "Lead follow-up due",
              body: getLeadDisplayName(lead),
              tag: `lead-followup-${lead.id}-${todayKey()}`,
              href: `/leads/${lead.id}/show`,
              desktop: true,
            });
            continue;
          }

          const activityAt = lead.last_contacted_at ?? lead.last_seen ?? null;
          if (
            activityAt &&
            new Date(activityAt).toISOString() <= staleCutoff &&
            !wasNotifiedToday("stale", lead.id)
          ) {
            markNotifiedToday("stale", lead.id);
            pushNotification({
              category: "leads_stale",
              title: "Lead needs attention",
              body: `${getLeadDisplayName(lead)} — no activity in ${STALE_DAYS}+ days`,
              tag: `lead-stale-${lead.id}-${todayKey()}`,
              href: `/leads/${lead.id}/show`,
              desktop: true,
            });
          }
        }
      } finally {
        runningRef.current = false;
      }
    };

    void run();
    const timer = window.setInterval(() => void run(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [identity?.id, pushNotification]);
};
