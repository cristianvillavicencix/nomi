import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Globe } from "lucide-react";
import { getWebsiteFaviconSrc } from "@/lbs/website-monitor/websiteMonitorUtils";
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
  const faviconSrc = getWebsiteFaviconSrc(url);
  const sizeClass =
    size === "sm" ? "size-8" : size === "lg" ? "size-16" : "size-10";
  const initials = (label ?? url ?? "?").slice(0, 2).toUpperCase();

  return (
    <Avatar className={cn(sizeClass, className)}>
      {faviconSrc ? (
        <AvatarImage
          src={faviconSrc}
          alt={label ?? url ?? "Sitio web"}
          className="object-contain"
        />
      ) : null}
      <AvatarFallback className="text-xs">
        {faviconSrc ? initials : <Globe className="size-4" />}
      </AvatarFallback>
    </Avatar>
  );
};
