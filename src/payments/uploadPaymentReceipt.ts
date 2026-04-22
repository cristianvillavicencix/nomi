import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";

/** Uploads an image to the attachments bucket; returns public URL. */
export async function uploadPaymentReceiptImage(
  file: File,
  kind: "approved" | "paid",
  paymentId: string | number,
): Promise<string> {
  const ext = file.name.includes(".")
    ? file.name.slice(file.name.lastIndexOf("."))
    : ".jpg";
  const path = `payment-proofs/${kind}/${paymentId}/${crypto.randomUUID()}${ext}`;
  const { error } = await supabase.storage
    .from("attachments")
    .upload(path, file, {
      contentType: file.type || "image/jpeg",
      upsert: false,
    });
  if (error) throw error;
  const { data } = supabase.storage.from("attachments").getPublicUrl(path);
  return data.publicUrl;
}
