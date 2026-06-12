const WEBP_QUALITY = 0.85;
const MAX_WEBP_DIMENSION = 2560;

const loadImage = (file: File | string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read image"));
    if (typeof file === "string") {
      img.crossOrigin = "anonymous";
      img.src = file;
      return;
    }
    img.src = URL.createObjectURL(file);
  });

const canvasToBlob = (
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Conversion failed"))),
      type,
      quality,
    );
  });

const scaleDimensions = (width: number, height: number) => {
  const longest = Math.max(width, height);
  if (longest <= MAX_WEBP_DIMENSION) {
    return { width, height };
  }
  const ratio = MAX_WEBP_DIMENSION / longest;
  return {
    width: Math.round(width * ratio),
    height: Math.round(height * ratio),
  };
};

/** Convert raster uploads to WebP in the browser (skips SVG and already-WebP). */
export async function optimizeImageForUpload(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  if (file.type === "image/webp" || file.type === "image/svg+xml") return file;

  try {
    const img = await loadImage(file);
    const { width, height } = scaleDimensions(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, width, height);
    const blob = await canvasToBlob(canvas, "image/webp", WEBP_QUALITY);
    const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
    return new File([blob], `${baseName}.webp`, {
      type: "image/webp",
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const drawSquareIcon = async (sourceUrl: string, size: number) => {
  const img = await loadImage(sourceUrl);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not prepare favicon");
  const scale = Math.min(size / img.naturalWidth, size / img.naturalHeight);
  const width = img.naturalWidth * scale;
  const height = img.naturalHeight * scale;
  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(img, (size - width) / 2, (size - height) / 2, width, height);
  return canvasToBlob(canvas, "image/png");
};

/** Logo tab: export common web favicon PNG sizes. */
export async function exportFaviconPack(sourceUrl: string, baseName: string) {
  const safeBase = baseName.replace(/[^\w.-]+/g, "-") || "favicon";
  const sizes = [
    { size: 16, suffix: "16x16" },
    { size: 32, suffix: "32x32" },
    { size: 180, suffix: "apple-touch" },
  ];
  for (const entry of sizes) {
    const blob = await drawSquareIcon(sourceUrl, entry.size);
    downloadBlob(blob, `${safeBase}-${entry.suffix}.png`);
  }
}
