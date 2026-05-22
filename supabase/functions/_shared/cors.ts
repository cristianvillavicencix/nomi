export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, PATCH, DELETE, OPTIONS",
};

type RequestHandler = (req: Request) => Promise<Response> | Response;

/**
 * Handle OPTIONS requests for CORS preflight.
 *
 * Supports both:
 * - OptionsMiddleware(req, handler)
 * - Deno.serve(OptionsMiddleware(handler))
 */
export function OptionsMiddleware(handler: RequestHandler): RequestHandler;
export function OptionsMiddleware(
  req: Request,
  next: RequestHandler,
): Promise<Response> | Response;
export function OptionsMiddleware(
  reqOrHandler: Request | RequestHandler,
  next?: RequestHandler,
): Promise<Response> | Response | RequestHandler {
  if (typeof reqOrHandler === "function") {
    const handler = reqOrHandler;
    return (req: Request) => OptionsMiddleware(req, handler);
  }

  const req = reqOrHandler;
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  return next!(req);
}
