import { AvatarImage } from "@/components/ui/avatar";
import { useStorageSignedUrl } from "@/hooks/useStorageSignedUrl";
import {
  resolveAvatarUrl,
  type AvatarBearingRecord,
} from "@/components/avatar/resolveAvatar";

export function SignedMemberAvatarImage({
  member,
  size = 64,
  alt = "",
  className,
}: {
  member: AvatarBearingRecord | null | undefined;
  size?: number;
  alt?: string;
  className?: string;
}) {
  const reference = resolveAvatarUrl(member, size);
  const src = useStorageSignedUrl(reference, { defaultBucket: "avatars" });
  if (!src) return null;
  return <AvatarImage src={src} alt={alt} className={className} />;
}
