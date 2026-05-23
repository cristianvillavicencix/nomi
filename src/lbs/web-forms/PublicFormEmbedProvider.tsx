import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import { cn } from "@/lib/utils";
import {
  isWebFormEmbedMode,
  NOMI_FORM_RESIZE_MESSAGE,
} from "@/lbs/web-forms/webFormEmbed";

type PublicFormEmbedContextValue = {
  embedded: boolean;
};

const PublicFormEmbedContext = createContext<PublicFormEmbedContextValue>({
  embedded: false,
});

export const usePublicFormEmbed = () => useContext(PublicFormEmbedContext);

const postEmbedHeight = () => {
  window.parent.postMessage(
    {
      type: NOMI_FORM_RESIZE_MESSAGE,
      height: document.documentElement.scrollHeight,
    },
    "*",
  );
};

export const PublicFormEmbedProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [searchParams] = useSearchParams();
  const embedded = isWebFormEmbedMode(searchParams);

  useEffect(() => {
    if (!embedded) return;

    document.documentElement.classList.add("nomi-form-embed");
    postEmbedHeight();

    const observer = new ResizeObserver(() => {
      postEmbedHeight();
    });
    observer.observe(document.body);

    return () => {
      document.documentElement.classList.remove("nomi-form-embed");
      observer.disconnect();
    };
  }, [embedded]);

  return (
    <PublicFormEmbedContext.Provider value={{ embedded }}>
      <div
        className={cn(
          embedded
            ? "min-h-0 bg-transparent px-4 py-3 text-foreground"
            : "min-h-screen bg-background",
        )}
      >
        {children}
      </div>
    </PublicFormEmbedContext.Provider>
  );
};

export const publicFormContentClassName = (embedded: boolean) =>
  cn(
    "mx-auto w-full",
    embedded ? "max-w-xl space-y-5" : "max-w-2xl space-y-6 p-6",
  );
