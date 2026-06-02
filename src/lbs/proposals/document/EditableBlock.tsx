import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export const EditableBlock = ({
  value,
  onChange,
  editable,
  className,
  placeholder,
  as: Tag = "div",
}: {
  value: string;
  onChange: (value: string) => void;
  editable: boolean;
  className?: string;
  placeholder?: string;
  as?: "div" | "h2" | "p";
}) => {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || document.activeElement === element) return;
    element.textContent = value || "";
  }, [value]);

  if (!editable) {
    const StaticTag = Tag;
    return (
      <StaticTag
        className={cn(
          "whitespace-pre-wrap leading-relaxed",
          Tag === "h2" ? "text-2xl font-semibold tracking-tight" : "text-sm text-muted-foreground",
          className,
        )}
      >
        {value || placeholder}
      </StaticTag>
    );
  }

  return (
    <Tag
      ref={ref as never}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      data-placeholder={placeholder}
      className={cn(
        "whitespace-pre-wrap rounded-md outline-none transition-colors",
        "empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]",
        "hover:bg-muted/40 focus:bg-muted/50 focus:ring-1 focus:ring-ring",
        Tag === "h2" && "text-2xl font-semibold tracking-tight",
        Tag !== "h2" && "text-sm leading-relaxed",
        className,
      )}
      onBlur={(event) => onChange(event.currentTarget.innerText.trim())}
    />
  );
};
