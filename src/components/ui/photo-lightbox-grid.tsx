import { useMemo, useState } from "react"
import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { IconButton } from "@/components/ui/icon-button"
import {
  ImageLightbox,
  type LightboxImage,
} from "@/components/ui/image-lightbox"
import { cn } from "@/lib/utils"

export type PhotoLightboxGridItem = {
  id: string
  src: string
  alt?: string
  title?: string
}

type PhotoLightboxGridProps = {
  items: PhotoLightboxGridItem[]
  /** Compact = message bubbles; gallery = ticket attachments */
  variant?: "compact" | "gallery"
  showCaption?: boolean
  className?: string
  onDownloadItem?: (item: PhotoLightboxGridItem) => void
}

const compactGridClass = (count: number) => {
  if (count <= 1) return "grid-cols-1"
  if (count === 2) return "grid-cols-2"
  if (count === 3) return "grid-cols-3"
  if (count === 4) return "grid-cols-2"
  return "grid-cols-3"
}

export const PhotoLightboxGrid = ({
  items,
  variant = "gallery",
  showCaption = false,
  className,
  onDownloadItem,
}: PhotoLightboxGridProps) => {
  const lightboxImages = useMemo<LightboxImage[]>(
    () =>
      items.map((item) => ({
        src: item.src,
        alt: item.alt,
        title: item.title ?? item.alt,
      })),
    [items]
  )
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)

  if (!items.length) return null

  const downloadCurrent = onDownloadItem
    ? () => {
        const item = items[lightboxIndex]
        if (item) onDownloadItem(item)
      }
    : undefined

  return (
    <>
      <div
        className={cn(
          variant === "compact"
            ? cn("grid gap-1.5", compactGridClass(items.length))
            : "grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4",
          className
        )}
      >
        {items.map((item, index) => (
          <div
            key={item.id}
            className={cn(
              "group relative overflow-hidden",
              variant === "gallery"
                ? "rounded-md border bg-background"
                : "rounded-sm"
            )}
          >
            <button
              type="button"
              title={item.title ?? item.alt}
              className="block w-full text-left"
              onClick={(event) => {
                event.stopPropagation()
                setLightboxIndex(index)
                setLightboxOpen(true)
              }}
            >
              <img
                src={item.src}
                alt={item.alt ?? item.title ?? "Photo"}
                className={cn(
                  "w-full object-cover transition-opacity group-hover:opacity-90",
                  variant === "gallery"
                    ? "aspect-[4/3]"
                    : items.length === 1
                      ? "max-h-56 rounded-sm"
                      : "aspect-square rounded-sm"
                )}
                loading="lazy"
              />
            </button>
            {onDownloadItem ? (
              <IconButton
                variant="secondary"
                className={cn(
                  "absolute bottom-1.5 right-1.5 size-7 rounded-full bg-background/90 shadow-sm hover:bg-background",
                  variant === "gallery" &&
                    "sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:focus:opacity-100",
                )}
                aria-label={`Download ${item.title ?? item.alt ?? "image"}`}
                onClick={(event) => {
                  event.stopPropagation()
                  onDownloadItem(item)
                }}
              >
                <Download className="size-3.5" />
              </IconButton>
            ) : null}
            {showCaption && (item.title ?? item.alt) ? (
              <p className="truncate px-2 py-1.5 text-[11px] text-muted-foreground">
                {item.title ?? item.alt}
              </p>
            ) : null}
          </div>
        ))}
      </div>
      <ImageLightbox
        images={lightboxImages}
        open={lightboxOpen}
        index={lightboxIndex}
        onOpenChange={setLightboxOpen}
        onIndexChange={setLightboxIndex}
        onDownload={downloadCurrent}
      />
    </>
  )
}
