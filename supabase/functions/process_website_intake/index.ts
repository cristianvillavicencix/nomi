import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { decode } from "npm:base64-arraybuffer";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { AuthMiddleware } from "../_shared/authentication.ts";
import { getUserOrganizationMember } from "../_shared/getUserOrganizationMember.ts";

type IntakeAttachment = {
  name: string;
  content: string;
  content_type?: string;
};

type WebsiteIntakeBody = {
  form_id: number;
  data: Record<string, unknown>;
  company_name?: string;
  contact_email?: string;
  contact_first_name?: string;
  contact_last_name?: string;
  contact_phone?: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  zipcode?: string;
  country?: string;
  attachments?: IntakeAttachment[];
};

type StoredAttachment = {
  title: string;
  type: string;
  path: string;
  src: string;
};

type ParsedIntake = {
  companyName: string;
  contactEmail?: string;
  contactFirstName: string;
  contactLastName: string;
  contactPhone?: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  zipcode?: string;
  country?: string;
  clientNotes?: string;
  businessEmail?: string;
  intakeData: Record<string, unknown>;
};

const readString = (...values: unknown[]) => {
  for (const value of values) {
    const normalized = String(value ?? "").trim();
    if (normalized) return normalized;
  }
  return "";
};

const splitFullName = (fullName: string) => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { firstName: "Website", lastName: "Lead" };
  }
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "Lead" };
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
};

const parseIntake = (body: WebsiteIntakeBody): ParsedIntake => {
  const data = body.data ?? {};
  const fullName = readString(
    body.contact_first_name && body.contact_last_name
      ? `${body.contact_first_name} ${body.contact_last_name}`
      : "",
    data.full_name,
    data.contact_full_name,
    data.name,
  );
  const splitName = splitFullName(fullName);

  return {
    companyName:
      readString(body.company_name, data.business_name, data.company_name) ||
      "New Client",
    contactEmail: readString(
      body.contact_email,
      data.contact_email,
      data.email,
    ).toLowerCase() || undefined,
    contactFirstName:
      readString(body.contact_first_name, data.first_name, data.contact_first_name) ||
      splitName.firstName,
    contactLastName:
      readString(body.contact_last_name, data.last_name, data.contact_last_name) ||
      splitName.lastName,
    contactPhone: readString(
      body.contact_phone,
      data.contact_phone,
      data.phone,
      data.phone_number,
    ) || undefined,
    website: readString(body.website, data.website, data.company_website) || undefined,
    address: readString(body.address, data.address, data.street) || undefined,
    city: readString(body.city, data.city) || undefined,
    state: readString(body.state, data.state, data.state_abbr) || undefined,
    zipcode: readString(body.zipcode, data.zipcode, data.postal_code) || undefined,
    country: readString(body.country, data.country) || undefined,
    clientNotes: readString(data.client_notes, data.notes, data.description) || undefined,
    businessEmail: readString(data.business_email, data.company_email) || undefined,
    intakeData: data,
  };
};

const uploadAttachments = async (
  attachments: IntakeAttachment[] | undefined,
): Promise<StoredAttachment[]> => {
  if (!attachments?.length) return [];

  const uploaded = await Promise.all(
    attachments.map(async (attachment) => {
      const { name, content, content_type: contentType } = attachment;
      if (!name || !content) return null;

      const decodedContent = decode(content);
      if (!decodedContent) return null;

      const fileParts = name.split(".");
      const fileExt = fileParts.length > 1 ? `.${fileParts.pop()}` : "";
      const fileName = `${Math.random()}${fileExt}`;
      const { error: uploadError } = await supabaseAdmin.storage
        .from("attachments")
        .upload(fileName, decodedContent, {
          contentType: contentType || "application/octet-stream",
        });

      if (uploadError) {
        console.error("process_website_intake.uploadError", uploadError);
        return null;
      }

      const { data } = supabaseAdmin.storage
        .from("attachments")
        .getPublicUrl(fileName);

      return {
        title: name,
        type: contentType || "application/octet-stream",
        path: fileName,
        src: data.publicUrl,
      };
    }),
  );

  return uploaded.filter(Boolean) as StoredAttachment[];
};

const mergeBusinessEmailContextLinks = (
  businessEmail: string | undefined,
  existingLinks?: string[] | null,
) => {
  const links = (existingLinks ?? []).filter(
    (link) => !link.startsWith("lbs:business_email="),
  );
  if (businessEmail?.trim()) {
    links.push(`lbs:business_email=${businessEmail.trim()}`);
  }
  return links;
};

const upsertCompany = async ({
  orgId,
  memberId,
  intake,
}: {
  orgId: string;
  memberId: number;
  intake: ParsedIntake;
}) => {
  const { data: existing } = await supabaseAdmin
    .from("companies")
    .select("id, context_links")
    .eq("org_id", orgId)
    .ilike("name", intake.companyName)
    .limit(1)
    .maybeSingle();

  const contextLinks = mergeBusinessEmailContextLinks(
    intake.businessEmail,
    existing?.context_links as string[] | undefined,
  );

  const companyPatch = {
    name: intake.companyName,
    website: intake.website,
    phone_number: intake.contactPhone,
    address: intake.address,
    city: intake.city,
    state_abbr: intake.state,
    zipcode: intake.zipcode,
    country: intake.country,
    description: intake.clientNotes,
    sector: "information-technology",
    context_links: contextLinks,
  };

  if (existing?.id) {
    const { data: company, error } = await supabaseAdmin
      .from("companies")
      .update(
        Object.fromEntries(
          Object.entries(companyPatch).filter(([, value]) => value != null && value !== ""),
        ),
      )
      .eq("id", existing.id)
      .select("id")
      .single();

    if (error || !company) {
      throw new Error("Failed to update client");
    }

    return company;
  }

  const { data: company, error } = await supabaseAdmin
    .from("companies")
    .insert({
      org_id: orgId,
      organization_member_id: memberId,
      ...companyPatch,
    })
    .select("id")
    .single();

  if (error || !company) {
    throw new Error("Failed to create client");
  }

  return company;
};

const upsertContact = async ({
  orgId,
  memberId,
  companyId,
  intake,
}: {
  orgId: string;
  memberId: number;
  companyId: number;
  intake: ParsedIntake;
}) => {
  const contactPatch = {
    company_id: companyId,
    first_name: intake.contactFirstName,
    last_name: intake.contactLastName,
    status: "client",
    lead_source: "website-intake",
    interested_service: "website",
    email_jsonb: intake.contactEmail
      ? [{ email: intake.contactEmail, type: "Work" }]
      : [],
    phone_jsonb: intake.contactPhone
      ? [{ number: intake.contactPhone, type: "Work" }]
      : [],
  };

  if (intake.contactEmail) {
    const { data: existing } = await supabaseAdmin
      .from("contacts")
      .select("id, company_id, email_jsonb, phone_jsonb")
      .eq("org_id", orgId)
      .contains("email_jsonb", JSON.stringify([{ email: intake.contactEmail }]))
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      const updatePayload: Record<string, unknown> = {
        company_id: companyId,
        first_name: intake.contactFirstName,
        last_name: intake.contactLastName,
        status: "client",
        lead_source: "website-intake",
        interested_service: "website",
      };

      if (intake.contactEmail) {
        updatePayload.email_jsonb = [{ email: intake.contactEmail, type: "Work" }];
      }
      if (intake.contactPhone) {
        updatePayload.phone_jsonb = [{ number: intake.contactPhone, type: "Work" }];
      }

      const { data: contact, error } = await supabaseAdmin
        .from("contacts")
        .update(updatePayload)
        .eq("id", existing.id)
        .select("id")
        .single();

      if (error || !contact) {
        throw new Error("Failed to update contact");
      }

      return contact;
    }
  }

  const { data: contact, error } = await supabaseAdmin
    .from("contacts")
    .insert({
      org_id: orgId,
      organization_member_id: memberId,
      ...contactPatch,
    })
    .select("id")
    .single();

  if (error || !contact) {
    throw new Error("Failed to create contact");
  }

  return contact;
};

const findOrCreateDeal = async ({
  orgId,
  memberId,
  companyId,
  contactId,
  companyName,
  intake,
}: {
  orgId: string;
  memberId: number;
  companyId: number;
  contactId: number;
  companyName: string;
  intake: ParsedIntake;
}) => {
  const dealName = `${companyName} Website`;

  const { data: existing } = await supabaseAdmin
    .from("deals")
    .select("id")
    .eq("org_id", orgId)
    .eq("company_id", companyId)
    .eq("category", "website")
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    const { data: deal, error } = await supabaseAdmin
      .from("deals")
      .update({
        contact_id: contactId,
        contact_ids: [contactId],
        website_brief: intake.intakeData,
        description: intake.clientNotes ?? "",
      })
      .eq("id", existing.id)
      .select("id")
      .single();

    if (error || !deal) {
      throw new Error("Failed to update project");
    }

    return { deal, created: false };
  }

  const { data: deal, error } = await supabaseAdmin
    .from("deals")
    .insert({
      org_id: orgId,
      organization_member_id: memberId,
      name: dealName,
      company_id: companyId,
      contact_id: contactId,
      contact_ids: [contactId],
      stage: "lead",
      amount: 0,
      category: "website",
      website_brief: intake.intakeData,
      description: intake.clientNotes ?? "",
    })
    .select("id")
    .single();

  if (error || !deal) {
    throw new Error("Failed to create project");
  }

  return { deal, created: true };
};

Deno.serve(
  OptionsMiddleware(async (req) => {
    try {
      const user = await AuthMiddleware(req);
      const member = await getUserOrganizationMember(user.id);
      if (!member?.id) {
        return createErrorResponse("Unauthorized", 401);
      }

      const body = (await req.json()) as WebsiteIntakeBody;
      const formId = Number(body.form_id);
      if (!Number.isFinite(formId)) {
        return createErrorResponse("Invalid form_id", 400);
      }

      const intake = parseIntake(body);
      const uploadedAttachments = await uploadAttachments(body.attachments);

      const company = await upsertCompany({
        orgId: member.org_id,
        memberId: member.id,
        intake,
      });

      const contact = await upsertContact({
        orgId: member.org_id,
        memberId: member.id,
        companyId: company.id,
        intake,
      });

      await supabaseAdmin
        .from("companies")
        .update({ primary_contact_id: contact.id })
        .eq("id", company.id)
        .is("primary_contact_id", null);

      const { deal, created: dealCreated } = await findOrCreateDeal({
        orgId: member.org_id,
        memberId: member.id,
        companyId: company.id,
        contactId: contact.id,
        companyName: intake.companyName,
        intake,
      });

      await supabaseAdmin.from("form_submissions").insert({
        org_id: member.org_id,
        form_id: formId,
        company_id: company.id,
        contact_id: contact.id,
        deal_id: deal.id,
        data: intake.intakeData,
      });

      await supabaseAdmin.from("deal_notes").insert({
        org_id: member.org_id,
        deal_id: deal.id,
        organization_member_id: member.id,
        text: dealCreated
          ? "Website intake form submitted."
          : "Website intake form updated.",
        date: new Date().toISOString(),
        attachments: uploadedAttachments.length ? uploadedAttachments : undefined,
      });

      if (dealCreated) {
        const checklist = [
          "Review brand assets",
          "Review website copy",
          "Confirm domain and hosting",
          "Schedule kickoff call",
        ];
        for (const text of checklist) {
          await supabaseAdmin.from("tasks").insert({
            org_id: member.org_id,
            contact_id: contact.id,
            deal_id: deal.id,
            organization_member_id: member.id,
            type: "follow-up",
            text,
            due_date: new Date().toISOString(),
          });
        }
      }

      return new Response(
        JSON.stringify({
          company_id: company.id,
          contact_id: contact.id,
          deal_id: deal.id,
          created: dealCreated,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } catch (error) {
      console.error("process_website_intake.error", error);
      return createErrorResponse(
        error instanceof Error ? error.message : "Unexpected error",
        500,
      );
    }
  }),
);
