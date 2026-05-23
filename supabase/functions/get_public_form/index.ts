import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";

type GetPublicFormBody = {
  slug?: string;
};

const DEFAULT_FIELDS = [
  {
    key: "message",
    label: "Message",
    multiline: true,
    required: true,
    placeholder: "Tell us what you need…",
  },
];

const parseCustomSchema = (
  schema: Record<string, unknown> | null | undefined,
) => {
  if (schema?.type === "custom" && Array.isArray(schema.fields)) {
    const fields = schema.fields
      .filter((field): field is Record<string, unknown> =>
        Boolean(field && typeof field === "object"),
      )
      .map((field) => ({
        key: String(field.key ?? "").trim(),
        label: String(field.label ?? "").trim(),
        multiline: Boolean(field.multiline),
        required: Boolean(field.required),
        placeholder: String(field.placeholder ?? "").trim() || undefined,
      }))
      .filter((field) => field.key && field.label);

    if (fields.length > 0) {
      return { type: "custom" as const, fields };
    }
  }

  return { type: "custom" as const, fields: DEFAULT_FIELDS };
};

Deno.serve(
  OptionsMiddleware(async (req) => {
    try {
      const body = (await req.json()) as GetPublicFormBody;
      const slug = String(body.slug ?? "").trim();
      if (!slug) {
        return createErrorResponse(400, "Missing slug");
      }

      const { data: form, error } = await supabaseAdmin
        .from("forms")
        .select("name, description, slug, schema, active")
        .eq("slug", slug)
        .eq("active", true)
        .limit(1)
        .maybeSingle();

      if (error || !form?.slug) {
        return createErrorResponse(404, "Form not found");
      }

      return new Response(
        JSON.stringify({
          name: form.name,
          description: form.description,
          slug: form.slug,
          schema: parseCustomSchema(
            form.schema as Record<string, unknown> | null,
          ),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } catch (error) {
      console.error("get_public_form.error", error);
      return createErrorResponse(
        500,
        error instanceof Error ? error.message : "Unexpected error",
      );
    }
  }),
);
