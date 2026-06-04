import { useEffect, useMemo, useState } from "react";
import { AvatarImage } from "@/components/ui/avatar";

type FaviconAvatarImageProps = {
  sources: string[];
  alt: string;
  className?: string;
};

/** Tries favicon sources in order; shows initials fallback when all fail (via Radix Avatar). */
export const FaviconAvatarImage = ({
  sources,
  alt,
  className,
}: FaviconAvatarImageProps) => {
  const stableSources = useMemo(() => sources.filter(Boolean), [sources]);
  const [sourceIndex, setSourceIndex] = useState(0);

  useEffect(() => {
    setSourceIndex(0);
  }, [stableSources.join("|")]);

  const src = stableSources[sourceIndex];
  if (!src) return null;

  const handleError = () => {
    setSourceIndex((current) =>
      current + 1 < stableSources.length ? current + 1 : current,
    );
  };

  return (
    <AvatarImage
      src={src}
      alt={alt}
      className={className}
      onError={handleError}
      referrerPolicy="no-referrer"
    />
  );
};
