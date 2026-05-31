import { useEffect, useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Globe } from "lucide-react";
import { getWebsiteFaviconSources } from "@/lbs/website-monitor/websiteMonitorUtils";
import { cn } from "@/lib/utils";

export const WebsiteMonitorFavicon = ({
  url,
  label,
  className,
  size = "md",
}: {
  url?: string | null;
  label?: string | null;
  className?: string;
  size?: "sm" | "md" | "lg";
}) => {
  const sources = useMemo(() => getWebsiteFaviconSources(url), [url]);
  const [sourceIndex, setSourceIndex] = useState(0);

  useEffect(() => {
    setSourceIndex(0);
  }, [url]);

  const faviconSrc = sources[sourceIndex];
  const sizeClass =
    size === "sm" ? "size-8" : size === "lg" ? "size-16" : "size-10";
  const initials = (label ?? url ?? "?").slice(0, 2).toUpperCase();

  const handleError = () => {
    setSourceIndex((current) =>
      current + 1 < sources.length ? current + 1 : current,
    );
  };

  return (
    <Avatar className={cn(sizeClass, className)}>
      {faviconSrc ? (
        <AvatarImage
          src={faviconSrc}
          alt={label ?? url ?? "Sitio web"}
          className="object-contain"
          onError={handleError}
        />
      ) : null}
      <AvatarFallback className="text-xs">
        {faviconSrc ? initials : <Globe className="size-4" />}
      </AvatarFallback>
    </Avatar>
  );
};
