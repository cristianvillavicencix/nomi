import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";

export const MAX_TICKET_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_TICKET_ATTACHMENTS = 10;

export type TicketReplyAttachment = {
  title: string;
  type: string;
  path: string;
  src: string;
};

export async function uploadTicketAttachment(
  file: File,
): Promise<TicketReplyAttachment> {
  if (file.size > MAX_TICKET_ATTACHMENT_BYTES) {
    throw new Error(`"${file.name}" exceeds the 10 MB limit`);
  }

  const ext = file.name.includes(".")
    ? file.name.slice(file.name.lastIndexOf("."))
    : "";
  const path = `${Math.random()}${ext}`;
  const { error } = await supabase.storage.from("attachments").upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });

  if (error) {
    throw new Error(error.message || "Failed to upload attachment");
  }

  const { data } = supabase.storage.from("attachments").getPublicUrl(path);

  return {
    title: file.name,
    type: file.type || "application/octet-stream",
    path,
    src: data.publicUrl,
  };
}
