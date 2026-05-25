import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";

const FORM_UPLOADS_BUCKET = "form-uploads";
const MAX_SIZE_BYTES = 20 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/gif",
  "image/svg+xml",
  "video/mp4",
  "video/quicktime",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/vnd.adobe.photoshop",
  "application/postscript",
  "application/illustrator",
  "application/octet-stream",
]);

const sanitizeSegment = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-|-$/g, "") || "file";

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(
  OptionsMiddleware(async (req) => {
    if (req.method !== "POST") {
      return createErrorResponse(405, "Method not allowed");
    }

    try {
      const formData = await req.formData();
      const token = String(formData.get("token") ?? "").trim();
      const fieldKey = sanitizeSegment(String(formData.get("field_key") ?? "file"));
      const groupKeyRaw = String(formData.get("group_key") ?? "").trim();
      const groupKey = groupKeyRaw ? sanitizeSegment(groupKeyRaw) : "";
      const file = formData.get("file");

      if (!token) {
        return jsonResponse({ error: "Missing form token" }, 400);
      }
      if (!(file instanceof File)) {
        return jsonResponse({ error: "Missing file" }, 400);
      }
      if (file.size > MAX_SIZE_BYTES) {
        return jsonResponse({ error: "File exceeds 20MB limit" }, 400);
      }

      const mime = file.type || "application/octet-stream";
      if (!ALLOWED_MIME_TYPES.has(mime)) {
        return jsonResponse({ error: "File type not allowed" }, 400);
      }

      const { data: tokenData, error: tokenError } = await supabaseAdmin
        .from("public_form_tokens")
        .select("token, org_id, deal_id, expires_at, form_instance:form_instances(id, is_active)")
        .eq("token", token)
        .single();

      if (tokenError || !tokenData) {
        return jsonResponse({ error: "Invalid or expired form link" }, 404);
      }

      if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
        return jsonResponse({ error: "This form link has expired" }, 410);
      }

      const formInstance = tokenData.form_instance as {
        id: number;
        is_active?: boolean | null;
      } | null;

      if (!formInstance || formInstance.is_active === false) {
        return jsonResponse({ error: "This form is not available" }, 404);
      }

      const ext = file.name.includes(".")
        ? file.name.slice(file.name.lastIndexOf("."))
        : "";
      const orgId = Number(tokenData.org_id);
      const pathParts = [
        "submissions",
        String(orgId),
        token.slice(0, 16),
        fieldKey,
      ];
      if (groupKey) pathParts.push(groupKey);
      pathParts.push(`${crypto.randomUUID()}${ext}`);
      const storagePath = pathParts.join("/");

      const fileBuffer = await file.arrayBuffer();
      const { error: uploadError } = await supabaseAdmin.storage
        .from(FORM_UPLOADS_BUCKET)
        .upload(storagePath, fileBuffer, {
          contentType: mime,
          upsert: false,
        });

      if (uploadError) {
        console.error("[upload_form_file] upload failed", uploadError);
        return jsonResponse({ error: "Failed to upload file" }, 500);
      }

      const { data: signed } = await supabaseAdmin.storage
        .from(FORM_UPLOADS_BUCKET)
        .createSignedUrl(storagePath, 60 * 60 * 24 * 7);

      return jsonResponse({
        name: file.name,
        original_name: file.name,
        url: signed?.signedUrl ?? "",
        path: storagePath,
        bucket: FORM_UPLOADS_BUCKET,
        size: file.size,
        type: mime,
        mime_type: mime,
      });
    } catch (error) {
      console.error("[upload_form_file] unexpected error", error);
      return jsonResponse({ error: "Upload failed" }, 500);
    }
  }),
);
