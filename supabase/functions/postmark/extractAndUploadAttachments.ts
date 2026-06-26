import { decode } from "npm:base64-arraybuffer";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { buildStorageObjectReference } from "../_shared/storageObjectUrl.ts";
import {
  assertInboundAttachmentCount,
  assertInboundAttachmentSize,
  MAX_INBOUND_ATTACHMENTS,
} from "../_shared/inboundAttachmentLimits.ts";

export type Attachment = {
  title: string;
  type: string;
  path: string;
  src: string;
  /** Postmark inline image Content-ID (cid:…) */
  contentId?: string | null;
};

/**
 * Extracts the attachments from the email and upload them to Supabase Storage.
 *
 * Example:
 *   "Attachments": [
 *      {
 *          "Name": "test.txt",
 *          "Content": "VGhpcyBpcyBhdHRhY2htZW50IGNvbnRlbnRzLCBiYXNlLTY0IGVuY29kZWQu",
 *          "ContentType": "text/plain",
 *          "ContentLength": 45
 *      }
 *   ]
 *
 * Return Value:
 * [{
 *    title: "test.txt",
 *    type: "text/plain",
 *    "path": "0.8262106278726917.txt",
 *    "src": "http://127.0.0.1:54321/storage/v1/object/public/attachments/0.8262106278726917.txt",
 * }]
 *
 */
export const extractAndUploadAttachments = async (
  Attachments: {
    Name: string;
    Content: string;
    ContentType: string;
    ContentLength: number;
    ContentID?: string | null;
  }[],
): Promise<Attachment[]> => {
  const list = Attachments || [];
  assertInboundAttachmentCount(list.length);

  return (
    await Promise.all(
      list.slice(0, MAX_INBOUND_ATTACHMENTS).map(async (attachment) => {
        const { Name, Content, ContentType, ContentID } = attachment;
        if (!Name || !Content || !ContentType) {
          console.warn("Attachment is missing required fields, skipping", {
            attachment,
          });
          return null;
        }

        const decodedContent = decode(Content);
        if (!decodedContent) {
          console.error("Failed to decode attachment content, skipping", {
            attachment,
          });
          return null;
        }

        assertInboundAttachmentSize(decodedContent.byteLength, Name);

        const fileParts = Name.split(".");
        const fileExt = fileParts.length > 1 ? `.${Name.split(".").pop()}` : "";
        const fileName = `${Math.random()}${fileExt}`;
        const { error: uploadError } = await supabaseAdmin.storage
          .from("attachments")
          .upload(fileName, decodedContent);

        if (uploadError) {
          console.error("uploadError", uploadError);
          throw new Error("Failed to upload attachment");
        }

        const { data: signed } = await supabaseAdmin.storage
          .from("attachments")
          .createSignedUrl(fileName, 60 * 60 * 24 * 7);

        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
        const reference = buildStorageObjectReference(
          supabaseUrl,
          "attachments",
          fileName,
        );

        return {
          title: Name,
          type: ContentType,
          path: fileName,
          src: fixPublicUrl(signed?.signedUrl ?? reference),
          contentId: ContentID?.trim() || null,
        };
      }),
    )
  ).filter(Boolean) as Attachment[];
};

/*
 * Workaround fix for public URL not working on local environment
 * See https://github.com/orgs/supabase/discussions/37271
 *
 * Replaces http://kong:8000/storage/v1/object/public/attachments/0.08968261048718773.txt with http://127.0.0.1:54321/storage/v1/object/public/attachments/0.08968261048718773.txt, using the SB_JWT_ISSUER env var (value http://127.0.0.1:54321/auth/v1) to get the external/public URL of the Supabase instance.
 */
const fixPublicUrl = (url: string) => {
  const jwtIssuer = Deno.env.get("SB_JWT_ISSUER") ?? "";
  const localUrl = jwtIssuer.replace("/auth/v1", "");
  return url.replace("http://kong:8000", localUrl);
};
