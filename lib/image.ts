// Client-side photo compression: downscale + JPEG so uploads stay small enough
// to store as a data URL (~<500 KB) instead of needing a file-storage service.
const MAX_CHARS = 600_000;

async function drawToDataUrl(source: CanvasImageSource, width: number, height: number, quality: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(source, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}

async function loadImage(file: File): Promise<{ source: CanvasImageSource; width: number; height: number }> {
  try {
    const bitmap = await createImageBitmap(file);
    return { source: bitmap, width: bitmap.width, height: bitmap.height };
  } catch {
    // Fallback for engines without createImageBitmap.
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = reject;
        el.src = url;
      });
      return { source: img, width: img.naturalWidth, height: img.naturalHeight };
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

export async function compressImage(file: File): Promise<string> {
  const { source, width, height } = await loadImage(file);
  if (!width || !height) throw new Error("unreadable");
  for (const [maxDim, quality] of [
    [1280, 0.75],
    [900, 0.6],
    [640, 0.5],
  ]) {
    const scale = Math.min(1, maxDim / Math.max(width, height));
    const url = await drawToDataUrl(source, Math.round(width * scale), Math.round(height * scale), quality);
    if (url.length <= MAX_CHARS) return url;
  }
  throw new Error("too-large");
}
