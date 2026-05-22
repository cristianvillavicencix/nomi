import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { decode } from "npm:base64-arraybuffer";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";

type ResourceUploadItem = {
  category: string;
  label?: string;
  name: string;
  content: string;
  content_type?: string;
};

type SubmitProjectResourcesBody = {
  deal_id?: number;
  company_id?: number;
  contact_id?: number;
  items?: ResourceUploadItem[];
};

const ALLOWED_CATEGORIES = new Set([
  "logo",
  "service-photo",
  "team",
  "location",
  "brand",
  "document",
  "other",
]);

const uploadResourceFile = async (
  dealId: number,
  attachment: ResourceUploadItem,
) => {
  const { name, content, content_type: contentType } = attachment;
  if (!name || !content) return null;

  const decodedContent = decode(content);
  if (!decodedContent) return null;

  const fileParts = name.split(".");
  const fileExt = fileParts.length > 1 ? `.${fileParts.pop()}` : "";
  const fileName = `project-resources/${dealId}/${crypto.randomUUID()}${fileExt}`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from("attachments")
    .upload(fileName, decodedContent, {
      contentType: contentType || "application/octet-stream",
    });

  if (uploadError) {
    console.error("submit_project_resources.uploadError", uploadError);
    return null;
  }

  const { data } = supabaseAdmin.storage.from("attachments").getPublicUrl(fileName);

  return {
    title: name,
    type: contentType || "application/octet-stream",
    path: fileName,
    src: data.publicUrl,
  };
};

Deno.serve(
  OptionsMiddleware(async (req) => {
    try {
      const body = (await req.json()) as SubmitProjectResourcesBody;
      const dealId = Number(body.deal_id);
      if (!Number.isFinite(dealId)) {
        return createErrorResponse("Missing deal_id", 400);
      }

      const items = Array.isArray(body.items) ? body.items : [];
      if (items.length === 0) {
        return createErrorResponse("No files to upload", 400);
      }

      const { data: deal, error: dealError } = await supabaseAdmin
        .from("deals")
        .select("id, org_id, company_id, contact_id, organization_member_id, contact_ids")
        .eq("id", dealId)
        .maybeSingle();

      if (dealError || !deal?.id) {
        return createErrorResponse("Project not found", 404);
      }

      const companyId = Number(body.company_id);
      const contactId = Number(body.contact_id);

      if (Number.isFinite(companyId) && Number(deal.company_id) !== companyId) {
        return createErrorResponse("Client does not match project", 400);
      }

      if (Number.isFinite(contactId)) {
        const dealContactIds = [
          Number(deal.contact_id),
          ...(Array.isArray(deal.contact_ids) ? deal.contact_ids.map(Number) : []),
        ].filter(Number.isFinite);

        if (!dealContactIds.includes(contactId)) {
          return createErrorResponse("Contact does not match project", 400);
        }
      }

      const rows: Array<Record<string, unknown>> = [];

      for (const item of items) {
        const category = String(item.category ?? "").trim();
        if (!ALLOWED_CATEGORIES.has(category)) {
          continue;
        }

        const file = await uploadResourceFile(dealId, item);
        if (!file) continue;

        rows.push({
          org_id: deal.org_id,
          deal_id: dealId,
          category,
          label: String(item.label ?? "").trim() || null,
          file,
          source: "client",
          organization_member_id: deal.organization_member_id,
        });
      }

      if (rows.length === 0) {
        return createErrorResponse("No valid files were uploaded", 400);
      }

      const { data: inserted, error: insertError } = await supabaseAdmin
        .from("deal_resources")
        .insert(rows)
        .select("id");

      if (insertError) {
        console.error("submit_project_resources.insertError", insertError);
        throw new Error("Failed to save project resources");
      }

      await supabaseAdmin.from("deal_notes").insert({
        org_id: deal.org_id,
        deal_id: dealId,
        organization_member_id: deal.organization_member_id,
        text: `Client uploaded ${inserted?.length ?? rows.length} project resource(s).`,
        date: new Date().toISOString(),
      });

      return new Response(
        JSON.stringify({
          deal_id: dealId,
          count: inserted?.length ?? rows.length,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } catch (error) {
      console.error("submit_project_resources.error", error);
      return createErrorResponse(
        error instanceof Error ? error.message : "Unexpected error",
        500,
      );
    }
  }),
);
