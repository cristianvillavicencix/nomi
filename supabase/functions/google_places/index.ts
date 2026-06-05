import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { UserMiddleware } from "../_shared/authentication.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import {
  getGooglePlacesServerApiKey,
  serverPlaceDetails,
  serverPlacesAutocomplete,
  type GooglePlacesAutocompleteMode,
} from "../_shared/googlePlacesProxy.ts";

type RequestBody = {
  action?: "autocomplete" | "details";
  input?: string;
  mode?: GooglePlacesAutocompleteMode;
  placeId?: string;
};

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

Deno.serve((req: Request) =>
  OptionsMiddleware(req, async (req) => {
    if (req.method !== "POST") {
      return createErrorResponse(405, "Method not allowed");
    }

    return UserMiddleware(req, async (req, user) => {
      if (!user) {
        return createErrorResponse(401, "Unauthorized");
      }

      if (!getGooglePlacesServerApiKey()) {
        return createErrorResponse(
          503,
          "Google Places API key is not configured on the server",
        );
      }

      try {
        const body = (await req.json().catch(() => ({}))) as RequestBody;
        const action = body.action;

        if (action === "autocomplete") {
          const input = body.input?.trim() ?? "";
          const mode = body.mode === "address" ? "address" : "business";
          if (input.length < 3) {
            return json({ suggestions: [] });
          }
          const suggestions = await serverPlacesAutocomplete(input, mode);
          return json({ suggestions });
        }

        if (action === "details") {
          const placeId = body.placeId?.trim() ?? "";
          if (!placeId) {
            return createErrorResponse(400, "placeId is required");
          }
          const details = await serverPlaceDetails(placeId);
          return json({ details });
        }

        return createErrorResponse(400, "Unknown action");
      } catch (error) {
        console.error("google_places.error", error);
        return createErrorResponse(
          500,
          error instanceof Error ? error.message : "Google Places request failed",
        );
      }
    });
  }),
);
