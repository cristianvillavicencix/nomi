import { Paperclip } from "lucide-react";

import { useStorageSignedUrl } from "@/hooks/useStorageSignedUrl";
import type { AttachmentNote, ContactNote, DealNote } from "../types";

const NoteAttachmentImage = ({
  attachment,
}: {
  attachment: AttachmentNote;
}) => {
  const href = useStorageSignedUrl(attachment.src, {
    path: attachment.path,
    defaultBucket: "attachments",
  });

  if (!href) return null;

  return (
    <a
      href={href}
      title={attachment.title}
      target="_blank"
      rel="noopener noreferrer"
      className="block"
      onClick={(e) => e.stopPropagation()}
    >
      <img
        src={href}
        alt={attachment.title}
        className="w-[200px] h-[100px] object-cover cursor-pointer object-left border border-border"
      />
    </a>
  );
};

const NoteAttachmentLink = ({ attachment }: { attachment: AttachmentNote }) => {
  const href = useStorageSignedUrl(attachment.src, {
    path: attachment.path,
    defaultBucket: "attachments",
  });

  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="underline hover:no-underline"
      onClick={(e) => e.stopPropagation()}
    >
      {attachment.title}
    </a>
  );
};

/**
 * Displays persisted note attachments in note show/list views.
 */
export const NoteAttachments = ({ note }: { note: ContactNote | DealNote }) => {
  if (!note.attachments || note.attachments.length === 0) {
    return null;
  }

  const imageAttachments = note.attachments.filter(
    (attachment: AttachmentNote) => isImageMimeType(attachment.type),
  );
  const otherAttachments = note.attachments.filter(
    (attachment: AttachmentNote) => !isImageMimeType(attachment.type),
  );

  return (
    <div className="mt-2 flex flex-col gap-2">
      {imageAttachments.length > 0 && (
        <div className="grid grid-cols-4 gap-8">
          {imageAttachments.map((attachment: AttachmentNote, index: number) => (
            <div key={index}>
              <NoteAttachmentImage attachment={attachment} />
            </div>
          ))}
        </div>
      )}
      {otherAttachments.length > 0 &&
        otherAttachments.map((attachment: AttachmentNote, index: number) => (
          <div key={index} className="flex items-center gap-2">
            <Paperclip className="w-4 h-4" />
            <NoteAttachmentLink attachment={attachment} />
          </div>
        ))}
    </div>
  );
};

const isImageMimeType = (mimeType?: string): boolean => {
  if (!mimeType) {
    return false;
  }
  return mimeType.startsWith("image/");
};
