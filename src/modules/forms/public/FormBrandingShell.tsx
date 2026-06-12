import { useEffect, type CSSProperties, type ReactNode } from "react";
import { sanitizeCustomCss } from "@/lib/forms-v2/sanitizeCustomCss";
import { cn } from "@/lib/utils";

type FormBrandingShellProps = {
  primaryColor?: string | null;
  backgroundImageUrl?: string | null;
  customFontUrl?: string | null;
  customCss?: string | null;
  embedded?: boolean;
  className?: string;
  children: ReactNode;
};

export const FormBrandingShell = ({
  primaryColor,
  backgroundImageUrl,
  customFontUrl,
  customCss,
  embedded,
  className,
  children,
}: FormBrandingShellProps) => {
  const sanitizedCss = sanitizeCustomCss(customCss);

  useEffect(() => {
    if (!customFontUrl?.trim()) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = customFontUrl.trim();
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, [customFontUrl]);

  const style: CSSProperties = {
    ...(primaryColor
      ? { ["--form-primary-color" as string]: primaryColor }
      : {}),
    ...(backgroundImageUrl
      ? {
          backgroundImage: `url(${backgroundImageUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }
      : {}),
  };

  return (
    <>
      {sanitizedCss ? (
        <style>{`.nomi-public-form { ${sanitizedCss} }`}</style>
      ) : null}
      <div
        className={cn(
          "nomi-public-form",
          embedded ? "min-h-0" : "min-h-full",
          backgroundImageUrl ? "bg-background/90 backdrop-blur-sm" : "",
          className,
        )}
        style={style}
      >
        {children}
      </div>
    </>
  );
};
