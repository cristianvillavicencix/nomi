import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { extractFieldValue } from "./formV2Schema.ts";

type FormInstance = {
  id: number;
  org_id: number;
  name?: string | null;
  slug?: string | null;
  auto_create_contact?: boolean | null;
  auto_create_lead?: boolean | null;
  auto_create_task?: boolean | null;
  notify_member_ids?: number[] | null;
  task_assignee_member_id?: number | null;
  task_title_template?: string | null;
};

type Submission = {
  id: number;
  contact_id?: number | null;
  company_id?: number | null;
  deal_id?: number | null;
};

const buildTaskTitle = (
  instance: FormInstance,
  answers: Record<string, unknown>,
) => {
  const submitterName =
    extractFieldValue(answers, ["name", "full_name", "submitter_name"]) ??
    "Form lead";
  const submitterEmail =
    extractFieldValue(answers, ["email", "respondent_email", "submitter_email"]) ??
    "";
  const template =
    instance.task_title_template ??
    "Follow up on {form_name} from {submitter_name}";

  return template
    .replaceAll("{form_name}", instance.name ?? "Form")
    .replaceAll("{submitter_name}", submitterName)
    .replaceAll("{submitter_email}", submitterEmail);
};

export async function handlePostSubmitActions(
  supabase: SupabaseClient,
  instance: FormInstance,
  submission: Submission,
  answers: Record<string, unknown>,
) {
  let contactId = submission.contact_id ?? null;
  let dealId = submission.deal_id ?? null;
  const updates: Partial<Submission> = {};

  if (instance.auto_create_contact && !contactId) {
    const email = extractFieldValue(answers, ["email", "respondent_email"]);
    const phone = extractFieldValue(answers, ["phone", "submitter_phone"]);
    const name = extractFieldValue(answers, [
      "name",
      "full_name",
      "submitter_name",
    ]);

    if (email || phone) {
      if (email) {
        const { data: existingByEmail } = await supabase
          .from("contacts")
          .select("id")
          .eq("org_id", instance.org_id)
          .filter("email_jsonb", "cs", `[{"email":"${email}"}]`)
          .limit(1)
          .maybeSingle();
        contactId = existingByEmail?.id ?? null;
      }

      if (!contactId && phone) {
        const { data: existingByPhone } = await supabase
          .from("contacts")
          .select("id")
          .eq("org_id", instance.org_id)
          .filter("phone_jsonb", "cs", `[{"number":"${phone}"}]`)
          .limit(1)
          .maybeSingle();
        contactId = existingByPhone?.id ?? null;
      }

      if (!contactId) {
        const [firstName, ...lastNameParts] = name?.split(/\s+/) ?? [];
        const { data: newContact } = await supabase
          .from("contacts")
          .insert({
            org_id: instance.org_id,
            first_name: firstName || "Form",
            last_name: lastNameParts.join(" ") || "Submission",
            email_jsonb: email ? [{ email, type: "Work" }] : [],
            phone_jsonb: phone ? [{ number: phone, type: "Work" }] : [],
            status: "lead",
          })
          .select("id")
          .single();
        contactId = newContact?.id ?? null;
      }

      if (contactId) {
        updates.contact_id = contactId;
      }
    }
  }

  if (instance.auto_create_lead && contactId && !dealId) {
    const leadName = extractFieldValue(answers, [
      "name",
      "full_name",
      "business_description",
      "project_description",
    ]);
    const { data: newDeal } = await supabase
      .from("deals")
      .insert({
        org_id: instance.org_id,
        name: leadName || `Lead from ${instance.name ?? "form"}`,
        stage: "lead",
        contact_ids: [contactId],
        contact_id: contactId,
        company_id: submission.company_id ?? null,
        description: `Created from form submission: ${instance.name ?? instance.slug ?? "form"}`,
      })
      .select("id")
      .single();
    if (newDeal?.id) {
      dealId = newDeal.id;
      updates.deal_id = newDeal.id;
    }
  }

  if (instance.auto_create_task) {
    const assigneeId =
      instance.task_assignee_member_id ?? instance.notify_member_ids?.[0] ?? null;
    const dueDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await supabase.from("tasks").insert({
      org_id: instance.org_id,
      text: buildTaskTitle(instance, answers),
      type: "client-follow-up",
      contact_id: contactId,
      deal_id: dealId,
      organization_member_id: assigneeId,
      due_date: dueDate,
    });
  }

  if (Object.keys(updates).length > 0) {
    await supabase
      .from("form_submissions_v2")
      .update(updates)
      .eq("id", submission.id);
  }
}
