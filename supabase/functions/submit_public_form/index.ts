import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";

type PublicFormBody = {
  slug: string;
  company_id?: number;
  contact_id?: number;
  deal_id?: number;
  data?: Record<string, unknown>;
};

type CustomFormField = {
  key: string;
  label: string;
  required?: boolean;
};

const WEBSITE_INTAKE_SLUG = "website-intake";

const readString = (...values: unknown[]) => {
  for (const value of values) {
    const normalized = String(value ?? "").trim();
    if (normalized) return normalized;
  }
  return "";
};

const parseCustomFields = (
  schema: Record<string, unknown> | null | undefined,
): CustomFormField[] => {
  if (schema?.type === "custom" && Array.isArray(schema.fields)) {
    return schema.fields
      .filter((field): field is Record<string, unknown> =>
        Boolean(field && typeof field === "object"),
      )
      .map((field) => ({
        key: String(field.key ?? "").trim(),
        label: String(field.label ?? "").trim(),
        required: Boolean(field.required),
      }))
      .filter((field) => field.key && field.label);
  }

  return [{ key: "message", label: "Message", required: true }];
};

const normalizeCustomSubmission = (
  fields: CustomFormField[],
  rawData: Record<string, unknown>,
) => {
  const data: Record<string, string> = {};
  const missing: string[] = [];

  for (const field of fields) {
    const value = readString(rawData[field.key]);
    if (field.required && !value) {
      missing.push(field.label);
    }
    data[field.key] = value;
  }

  if (missing.length > 0) {
    throw new Error(`Required: ${missing.join(", ")}`);
  }

  return data;
};

const resolveOptionalLinks = async (
  form: { org_id: number },
  companyId: number,
  contactId: number,
  requestedDealId: number,
) => {
  let resolvedCompanyId: number | null = Number.isFinite(companyId)
    ? companyId
    : null;
  const resolvedContactId: number | null = Number.isFinite(contactId)
    ? contactId
    : null;
  const resolvedDealId: number | null = Number.isFinite(requestedDealId)
    ? requestedDealId
    : null;

  if (resolvedCompanyId) {
    const { data: companyRow, error: companyError } = await supabaseAdmin
      .from("companies")
      .select("id, org_id")
      .eq("id", resolvedCompanyId)
      .eq("org_id", form.org_id)
      .maybeSingle();

    if (companyError || !companyRow?.id) {
      throw new Error("Client not found");
    }
  }

  if (resolvedContactId) {
    const { data: contactRow, error: contactError } = await supabaseAdmin
      .from("contacts")
      .select("id, company_id, org_id")
      .eq("id", resolvedContactId)
      .eq("org_id", form.org_id)
      .maybeSingle();

    if (contactError || !contactRow?.id) {
      throw new Error("Contact not found");
    }

    if (
      resolvedCompanyId &&
      Number(contactRow.company_id) !== Number(resolvedCompanyId)
    ) {
      throw new Error("Contact does not belong to client");
    }

    if (!resolvedCompanyId && contactRow.company_id) {
      resolvedCompanyId = Number(contactRow.company_id);
    }
  }

  if (resolvedDealId) {
    const { data: dealRow, error: dealError } = await supabaseAdmin
      .from("deals")
      .select("id, company_id, org_id")
      .eq("id", resolvedDealId)
      .eq("org_id", form.org_id)
      .maybeSingle();

    if (dealError || !dealRow?.id) {
      throw new Error("Project not found");
    }

    if (
      resolvedCompanyId &&
      Number(dealRow.company_id) !== Number(resolvedCompanyId)
    ) {
      throw new Error("Project does not belong to this client");
    }

    if (!resolvedCompanyId && dealRow.company_id) {
      resolvedCompanyId = Number(dealRow.company_id);
    }
  }

  return {
    company_id: resolvedCompanyId,
    contact_id: resolvedContactId,
    deal_id: resolvedDealId,
  };
};

Deno.serve(
  OptionsMiddleware(async (req) => {
    try {
      const body = (await req.json()) as PublicFormBody;
      const slug = readString(body.slug);
      if (!slug) {
        return createErrorResponse("Missing slug", 400);
      }

      const { data: form, error: formError } = await supabaseAdmin
        .from("forms")
        .select("id, org_id, slug, schema, active")
        .eq("slug", slug)
        .eq("active", true)
        .limit(1)
        .maybeSingle();

      if (formError || !form?.id) {
        return createErrorResponse("Form not found", 404);
      }

      const intakeData = body.data ?? {};

      if (slug !== WEBSITE_INTAKE_SLUG) {
        const fields = parseCustomFields(
          form.schema as Record<string, unknown> | null | undefined,
        );
        const data = normalizeCustomSubmission(fields, intakeData);
        const links = await resolveOptionalLinks(
          form,
          Number(body.company_id),
          Number(body.contact_id),
          Number(body.deal_id),
        );

        const { data: submission, error: submissionError } = await supabaseAdmin
          .from("form_submissions")
          .insert({
            org_id: form.org_id,
            form_id: form.id,
            company_id: links.company_id,
            contact_id: links.contact_id,
            deal_id: links.deal_id,
            data,
          })
          .select("id")
          .single();

        if (submissionError || !submission) {
          throw new Error("Failed to save submission");
        }

        return new Response(
          JSON.stringify({
            submission_id: submission.id,
            company_id: links.company_id,
            contact_id: links.contact_id,
            deal_id: links.deal_id,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const companyId = Number(body.company_id);
      const contactId = Number(body.contact_id);
      const requestedDealId = Number(body.deal_id);

      let company: {
        id: number;
        name: string;
        organization_member_id: number | null;
      } | null = null;
      let contact: { id: number } | null = null;
      let memberId: number | null = null;

      if (Number.isFinite(companyId)) {
        const { data: companyRow, error: companyError } = await supabaseAdmin
          .from("companies")
          .select("id, name, organization_member_id, org_id")
          .eq("id", companyId)
          .eq("org_id", form.org_id)
          .maybeSingle();

        if (companyError || !companyRow?.id) {
          return createErrorResponse("Client not found", 404);
        }

        company = companyRow;
        memberId = company.organization_member_id;
      }

      if (Number.isFinite(contactId)) {
        const { data: contactRow, error: contactError } = await supabaseAdmin
          .from("contacts")
          .select("id, company_id, org_id")
          .eq("id", contactId)
          .eq("org_id", form.org_id)
          .maybeSingle();

        if (contactError || !contactRow?.id) {
          return createErrorResponse("Contact not found", 404);
        }

        if (company && Number(contactRow.company_id) !== Number(company.id)) {
          return createErrorResponse("Contact does not belong to client", 400);
        }

        contact = { id: contactRow.id };
        if (!company && contactRow.company_id) {
          const { data: companyRow } = await supabaseAdmin
            .from("companies")
            .select("id, name, organization_member_id")
            .eq("id", contactRow.company_id)
            .maybeSingle();
          if (companyRow?.id) {
            company = companyRow;
            memberId = company.organization_member_id;
          }
        }
      }

      if (!memberId) {
        const { data: fallbackMember } = await supabaseAdmin
          .from("organization_members")
          .select("id")
          .eq("org_id", form.org_id)
          .limit(1)
          .maybeSingle();
        memberId = fallbackMember?.id ?? null;
      }

      if (!memberId) {
        return createErrorResponse("Organization member not found", 500);
      }

      const companyName =
        company?.name ??
        (readString(intakeData.business_name, intakeData.company_name) ||
          "New Client");
      const resolvedCompanyId = company?.id;
      const resolvedContactId = contact?.id;

      if (!resolvedCompanyId || !resolvedContactId) {
        return createErrorResponse(
          "This form link must include a valid client and contact.",
          400,
        );
      }

      const dealName = `${companyName} Website`;
      const clientNotes = readString(intakeData.client_notes, intakeData.notes);

      let dealId: number;
      let created = false;

      if (Number.isFinite(requestedDealId)) {
        const { data: linkedDeal, error: linkedDealError } = await supabaseAdmin
          .from("deals")
          .select("id, company_id, org_id")
          .eq("id", requestedDealId)
          .eq("org_id", form.org_id)
          .maybeSingle();

        if (linkedDealError || !linkedDeal?.id) {
          return createErrorResponse("Project not found", 404);
        }

        if (
          resolvedCompanyId &&
          Number(linkedDeal.company_id) !== Number(resolvedCompanyId)
        ) {
          return createErrorResponse(
            "Project does not belong to this client",
            400,
          );
        }

        const { data: updatedDeal, error: updateDealError } =
          await supabaseAdmin
            .from("deals")
            .update({
              contact_id: resolvedContactId,
              contact_ids: [resolvedContactId],
              website_brief: intakeData,
              description: clientNotes,
            })
            .eq("id", linkedDeal.id)
            .select("id")
            .single();

        if (updateDealError || !updatedDeal) {
          throw new Error("Failed to update project");
        }
        dealId = updatedDeal.id;
      } else {
        const { data: existingDeal } = await supabaseAdmin
          .from("deals")
          .select("id")
          .eq("org_id", form.org_id)
          .eq("company_id", resolvedCompanyId)
          .eq("category", "website")
          .limit(1)
          .maybeSingle();

        if (existingDeal?.id) {
          const { data: updatedDeal, error: updateDealError } =
            await supabaseAdmin
              .from("deals")
              .update({
                contact_id: resolvedContactId,
                contact_ids: [resolvedContactId],
                website_brief: intakeData,
                description: clientNotes,
              })
              .eq("id", existingDeal.id)
              .select("id")
              .single();

          if (updateDealError || !updatedDeal) {
            throw new Error("Failed to update project");
          }
          dealId = updatedDeal.id;
        } else {
          const { data: newDeal, error: createDealError } = await supabaseAdmin
            .from("deals")
            .insert({
              org_id: form.org_id,
              organization_member_id: memberId,
              name: dealName,
              company_id: resolvedCompanyId,
              contact_id: resolvedContactId,
              contact_ids: [resolvedContactId],
              stage: "lead",
              amount: 0,
              category: "website",
              website_brief: intakeData,
              description: clientNotes,
            })
            .select("id")
            .single();

          if (createDealError || !newDeal) {
            throw new Error("Failed to create project");
          }
          dealId = newDeal.id;
          created = true;
        }
      }

      await supabaseAdmin.from("form_submissions").insert({
        org_id: form.org_id,
        form_id: form.id,
        company_id: resolvedCompanyId,
        contact_id: resolvedContactId,
        deal_id: dealId,
        data: intakeData,
      });

      await supabaseAdmin.from("deal_notes").insert({
        org_id: form.org_id,
        deal_id: dealId,
        organization_member_id: memberId,
        text: created
          ? "Website intake form submitted by client."
          : "Website intake form updated by client.",
        date: new Date().toISOString(),
      });

      return new Response(
        JSON.stringify({
          company_id: resolvedCompanyId,
          contact_id: resolvedContactId,
          deal_id: dealId,
          created,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } catch (error) {
      console.error("submit_public_form.error", error);
      return createErrorResponse(
        error instanceof Error ? error.message : "Unexpected error",
        500,
      );
    }
  }),
);
