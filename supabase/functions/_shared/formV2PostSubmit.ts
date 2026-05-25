import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { extractFieldValue } from "./formV2Schema.ts";

type FormInstance = {
  id: number;
  org_id: number;
  auto_create_contact?: boolean | null;
  auto_create_lead?: boolean | null;
  auto_create_task?: boolean | null;
  notify_member_ids?: number[] | null;
};

type Submission = {
  id: number;
  contact_id?: number | null;
  company_id?: number | null;
  deal_id?: number | null;
};

export async function handlePostSubmitActions(
  supabase: SupabaseClient,
  instance: FormInstance,
  submission: Submission,
  answers: Record<string, unknown>,
) {
  let contactId = submission.contact_id ?? null;

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
          })
          .select("id")
          .single();
        contactId = newContact?.id ?? null;
      }

      if (contactId) {
        await supabase
          .from("form_submissions_v2")
          .update({ contact_id: contactId })
          .eq("id", submission.id);
      }
    }
  }

  if (instance.auto_create_lead && contactId) {
    const leadName = extractFieldValue(answers, [
      "name",
      "full_name",
      "business_description",
      "project_description",
    ]);
    await supabase.from("deals").insert({
      org_id: instance.org_id,
      name: leadName || "New form lead",
      stage: "lead",
      contact_ids: [contactId],
      contact_id: contactId,
      company_id: submission.company_id ?? null,
    });
  }

  if (instance.auto_create_task) {
    const assigneeId = instance.notify_member_ids?.[0] ?? null;
    const taskName = extractFieldValue(answers, [
      "name",
      "full_name",
      "message",
      "project_description",
    ]);
    await supabase.from("tasks").insert({
      org_id: instance.org_id,
      text: `Review form submission${taskName ? `: ${taskName}` : ""}`,
      type: "forms",
      contact_id: contactId,
      deal_id: submission.deal_id ?? null,
      organization_member_id: assigneeId,
    });
  }
}
