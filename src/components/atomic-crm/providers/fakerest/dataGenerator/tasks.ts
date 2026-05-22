import { datatype, lorem, random } from "faker/locale/en_US";

import { configuredTaskTypes } from "../../../root/defaultConfiguration";
import type { Task } from "../../../types";
import type { Db } from "./types";
import { randomDate } from "./utils";

export const type: string[] = [
  "email",
  "email",
  "email",
  "email",
  "email",
  "email",
  "call",
  "call",
  "call",
  "call",
  "call",
  "call",
  "call",
  "call",
  "call",
  "call",
  "call",
  "demo",
  "lunch",
  "meeting",
  "follow-up",
  "follow-up",
  "thank-you",
  "ship",
  "none",
];

export const generateTasks = (db: Db) => {
  return Array.from(Array(400).keys()).map<Task>((id) => {
    const contact = random.arrayElement(db.contacts);
    const deal = db.deals.length > 0 ? random.arrayElement(db.deals) : null;
    contact.nb_tasks++;
    return {
      id,
      contact_id: contact.id,
      deal_id: deal && datatype.boolean() ? deal.id : null,
      type: random.arrayElement(configuredTaskTypes).value,
      text: lorem.sentence(),
      due_date: randomDate(
        datatype.boolean() ? new Date() : new Date(contact.first_seen),
        new Date(Date.now() + 100 * 24 * 60 * 60 * 1000),
      ).toISOString(),
      done_date: undefined,
      organization_member_id: random.arrayElement(db.organizationMembers).id,
      assignee_person_ids: [],
      collaborator_person_ids: [],
      priority: random.arrayElement(["low", "normal", "high"]),
      internal: datatype.boolean(),
    };
  });
};
