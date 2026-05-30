// Based on https://github.com/supabase/supabase/blob/master/examples/edge-functions/supabase/functions/_shared/jwt/default.ts
import * as jose from "jsr:@panva/jose@6";
import { type User } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "./cors.ts";
import { createErrorResponse } from "./utils.ts";
import { supabaseAdmin } from "./supabaseAdmin.ts";

/**
 * Must match the `iss` claim on Supabase Auth access tokens (always the project's API origin).
 * Do NOT use `SB_JWT_ISSUER` here: that value is often set to http://127.0.0.1:54321/auth/v1 for
 * local tooling and, if copied into hosted Edge secrets, breaks JWT verification with 401.
 */
const SUPABASE_JWT_ISSUER = `${(Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "")}/auth/v1`;

const SUPABASE_JWT_KEYS = jose.createRemoteJWKSet(
  new URL(Deno.env.get("SUPABASE_URL")! + "/auth/v1/.well-known/jwks.json"),
);

function getAuthToken(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    throw new Error("Missing authorization header");
  }
  const [bearer, token] = authHeader.split(" ");
  if (bearer !== "Bearer") {
    throw new Error(`Auth header is not 'Bearer {token}'`);
  }

  return token;
}

function verifySupabaseJWT(jwt: string) {
  return jose.jwtVerify(jwt, SUPABASE_JWT_KEYS, {
    issuer: SUPABASE_JWT_ISSUER,
  });
}

/**
 * Validates the Authorization header to ensure that a user is authenticated.
 */
export const AuthMiddleware = async (
  req: Request,
  next: (req: Request) => Promise<Response>,
) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const token = getAuthToken(req);
    const isValidJWT = await verifySupabaseJWT(token);

    if (isValidJWT) return await next(req);

    return createErrorResponse(401, "Invalid authentication");
  } catch (e) {
    return createErrorResponse(401, e?.toString() || "Unauthorized");
  }
};

/**
 * Get the authenticated user using the authorization header.
 * User will be undefined for OPTIONS requests.
 */
export const UserMiddleware = async (
  req: Request,
  next: (req: Request, user?: User) => Promise<Response>,
) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return createErrorResponse(401, "Unauthorized");
    }

    const token = authHeader.slice("Bearer ".length);
    const { data, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (!data?.user || authError) {
      return createErrorResponse(401, "Unauthorized");
    }

    return next(req, data.user);
  } catch (err) {
    return createErrorResponse(401, err?.toString() || "Unauthorized");
  }
};
