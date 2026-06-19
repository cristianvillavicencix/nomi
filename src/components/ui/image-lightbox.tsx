import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, XIcon, ZoomIn, ZoomOut } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type LightboxImage = {
  src: string;
  alt?: string;
  title?: string;
};

const MIN_SCALE = 1;
const MAX_SCALE = 6;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

type ImageLightboxProps = {
  images: LightboxImage[];
  open: boolean;
  index: number;
  onOpenChange: (open: boolean) => void;
  onIndexChange: (index: number) => void;
};

export const ImageLightbox = ({
  images,
  open,
  index,
  onOpenChange,
  onIndexChange,
}: ImageLightboxProps) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(
    null,
  );

  const current = images[index];
  const hasMultiple = images.length > 1;

  const resetView = useCallback(() => {
    setScale(1);
    setPan({ x: 0, y: 0 });
    dragRef.current = null;
  }, []);

  useEffect(() => {
    if (!open) {
      resetView();
    }
  }, [open, resetView]);

  useEffect(() => {
    resetView();
  }, [index, resetView]);

  const goPrev = useCallback(() => {
    if (!hasMultiple) return;
    onIndexChange((index - 1 + images.length) % images.length);
  }, [hasMultiple, images.length, index, onIndexChange]);

  const goNext = useCallback(() => {
    if (!hasMultiple) return;
    onIndexChange((index + 1) % images.length);
  }, [hasMultiple, images.length, index, onIndexChange]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goPrev();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        goNext();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, goPrev, goNext]);

  useEffect(() => {
    const node = viewportRef.current;
    if (!open || !node) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const direction = event.deltaY < 0 ? 1 : -1;
      const step = event.ctrlKey ? 0.08 : 0.14;
      setScale((currentScale) => {
        const next = clamp(currentScale + direction * step, MIN_SCALE, MAX_SCALE);
        if (next <= 1) {
          setPan({ x: 0, y: 0 });
        }
        return next;
      });
    };

    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [open, index]);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (scale <= 1) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      panX: pan.x,
      panY: pan.y,
    };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    setPan({
      x: dragRef.current.panX + (event.clientX - dragRef.current.x),
      y: dragRef.current.panY + (event.clientY - dragRef.current.y),
    });
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current) {
      event.currentTarget.releasePointerCapture(event.pointerId);
      dragRef.current = null;
    }
  };

  const zoomIn = () =>
    setScale((currentScale) => clamp(currentScale + 0.35, MIN_SCALE, MAX_SCALE));
  const zoomOut = () =>
    setScale((currentScale) => {
      const next = clamp(currentScale - 0.35, MIN_SCALE, MAX_SCALE);
      if (next <= 1) setPan({ x: 0, y: 0 });
      return next;
    });

  if (!current) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="bg-black/75 backdrop-blur-md" />
        <DialogPrimitive.Content
          className={cn(
            "fixed inset-0 z-50 flex flex-col outline-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          )}
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <DialogTitle className="sr-only">
            {current.title || current.alt || "Image preview"}
          </DialogTitle>

          <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3 text-white">
            <div className="min-w-0 flex-1">
              {current.title ? (
                <p className="truncate text-sm font-medium">{current.title}</p>
              ) : null}
              {hasMultiple ? (
                <p className="text-xs text-white/70">
                  {index + 1} of {images.length}
                </p>
              ) : null}
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/10 hover:text-white"
                onClick={zoomOut}
                aria-label="Zoom out"
              >
                <ZoomOut className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/10 hover:text-white"
                onClick={zoomIn}
                aria-label="Zoom in"
              >
                <ZoomIn className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/10 hover:text-white"
                onClick={() => onOpenChange(false)}
                aria-label="Close"
              >
                <XIcon className="size-4" />
              </Button>
            </div>
          </div>

          <div className="relative flex min-h-0 flex-1 items-center justify-center px-14 pb-6">
            {hasMultiple ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute left-3 top-1/2 z-10 size-10 -translate-y-1/2 rounded-full text-white hover:bg-white/10 hover:text-white"
                onClick={goPrev}
                aria-label="Previous image"
              >
                <ChevronLeft className="size-7" />
              </Button>
            ) : null}

            <div
              ref={viewportRef}
              className={cn(
                "flex h-full w-full touch-none items-center justify-center overflow-hidden",
                scale > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in",
              )}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onDoubleClick={resetView}
            >
              <img
                key={current.src}
                src={current.src}
                alt={current.alt || current.title || "Attachment"}
                draggable={false}
                className="max-h-full max-w-full select-none object-contain transition-transform duration-75 ease-out"
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                }}
              />
            </div>

            {hasMultiple ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-3 top-1/2 z-10 size-10 -translate-y-1/2 rounded-full text-white hover:bg-white/10 hover:text-white"
                onClick={goNext}
                aria-label="Next image"
              >
                <ChevronRight className="size-7" />
              </Button>
            ) : null}
          </div>

          <p className="pointer-events-none shrink-0 pb-4 text-center text-xs text-white/60">
            Scroll to zoom · Drag to pan · Arrow keys to browse · Double-click to reset
          </p>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
};

export const useImageLightbox = (images: LightboxImage[]) => {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  const openAt = (nextIndex: number) => {
    setIndex(nextIndex);
    setOpen(true);
  };

  return {
    open,
    index,
    setOpen,
    setIndex,
    openAt,
    lightbox: (
      <ImageLightbox
        images={images}
        open={open}
        index={index}
        onOpenChange={setOpen}
        onIndexChange={setIndex}
      />
    ),
  };
};
