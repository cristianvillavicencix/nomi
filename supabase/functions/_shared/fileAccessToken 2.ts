import { supabaseAdmin } from "./supabaseAdmin.ts";
import { resolvePublicAppBaseUrl } from "./publicAppUrl.ts";

export type FileAccessPurpose =
  | "ticket_reply"
  | "ticket_delivery"
  | "client_portal"
  | "form_upload"
  | "project_resource"
  | "email_attachment";

export type CreateFileAccessTokenParams = {
  bucket: string;
  storagePath: string;
  filename: string;
  mimeType?: string | null;
  expiresInSec: number;
  purpose: FileAccessPurpose;
  orgId?: number | null;
  maxUses?: number | null;
};

export type FileAccessTokenRow = {
  bucket: string;
  storage_path: string;
  filename: string;
  mime_type: string | null;
  purpose: string;
  org_id: number | null;
  expires_at: string;
  max_uses: number | null;
  uses_count: number;
};

const TOKEN_BYTES = 24;

function generateToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function buildPublicFileUrl(token: string): string {
  return `${resolvePublicAppBaseUrl()}/files/${encodeURIComponent(token)}`;
}

export async function createFileAccessToken(
  params: CreateFileAccessTokenParams,
): Promise<{ token: string; url: string }> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + params.expiresInSec * 1000).toISOString();
  const safeName =
    params.filename.replace(/[\r\n"\\]/g, "_").replace(/\//g, "_").slice(0, 180) ||
    "file";

  const { error } = await supabaseAdmin.from("storage_file_access_tokens").insert({
    token,
    bucket: params.bucket,
    storage_path: params.storagePath,
    filename: safeName,
    mime_type: params.mimeType ?? null,
    purpose: params.purpose,
    org_id: params.orgId ?? null,
    expires_at: expiresAt,
    max_uses: params.maxUses ?? null,
  });

  if (error) {
    throw new Error(error.message);
  }

  return { token, url: buildPublicFileUrl(token) };
}

export async function consumeFileAccessToken(
  token: string,
): Promise<FileAccessTokenRow | null> {
  const normalized = token.trim();
  if (!normalized) return null;

  const { data, error } = await supabaseAdmin
    .from("storage_file_access_tokens")
    .select(
      "bucket, storage_path, filename, mime_type, purpose, org_id, expires_at, max_uses, uses_count",
    )
    .eq("token", normalized)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as FileAccessTokenRow;
  if (new Date(row.expires_at).getTime() <= Date.now()) return null;
  if (row.max_uses != null && row.uses_count >= row.max_uses) return null;

  const { error: updateError } = await supabaseAdmin
    .from("storage_file_access_tokens")
    .update({ uses_count: row.uses_count + 1 })
    .eq("token", normalized)
    .eq("uses_count", row.uses_count);

  if (updateError) return null;
  return row;
}

export async function createPublicFileLinksForStoragePaths(
  files: Array<{
    bucket: string;
    path: string;
    filename: string;
    mimeType?: string | null;
  }>,
  options: {
    expiresInSec: number;
    purpose: FileAccessPurpose;
    orgId?: number | null;
    maxUses?: number | null;
  },
): Promise<Array<{ name: string; url: string }>> {
  const links: Array<{ name: string; url: string }> = [];
  for (const file of files) {
    const path = file.path?.trim();
    const name = file.filename?.trim() || path?.split("/").pop() || "file";
    if (!path) {
      throw new Error(`Could not create a download link for "${name}" (missing storage path).`);
    }
    const { url } = await createFileAccessToken({
      bucket: file.bucket,
      storagePath: path,
      filename: name,
      mimeType: file.mimeType,
      expiresInSec: options.expiresInSec,
      purpose: options.purpose,
      orgId: options.orgId,
      maxUses: options.maxUses,
    });
    links.push({ name, url });
  }
  return links;
}
