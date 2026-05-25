import { useEffect } from "react";
import { CheckCircle2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

export const PROJECT_BRIEF_THANK_YOU_REDIRECT = "https://www.lbs.bz";

export const ProjectBriefThankYou = ({
  embedded,
  className,
  preview,
}: {
  embedded?: boolean;
  className?: string;
  preview?: boolean;
}) => {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.location.href = PROJECT_BRIEF_THANK_YOU_REDIRECT;
    }, 4000);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className={`${className ?? ""} flex flex-col items-center px-4 py-10 text-center`}>
      {preview ? (
        <p className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-900 dark:text-amber-100">
          Preview mode — submission was not saved.
        </p>
      ) : null}
      <div className="mb-6 flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
        <CheckCircle2 className="size-9" />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">Thank you!</h1>
      <p className="mt-3 max-w-md text-sm text-muted-foreground">
        We received your project brief. Our team will review your information and
        reach out if we need anything else.
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        Redirecting to lbs.bz in a few seconds…
      </p>
      <Button asChild className="mt-8 min-h-11 gap-2" size="lg">
        <a
          href={PROJECT_BRIEF_THANK_YOU_REDIRECT}
          target={embedded ? "_blank" : undefined}
          rel={embedded ? "noreferrer" : undefined}
        >
          Visit lbs.bz
          <ExternalLink className="size-4" />
        </a>
      </Button>
    </div>
  );
};
