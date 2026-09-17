export type ManualPdfRedaction = { x: number; y: number; width: number; height: number };

export function validateManualPdfRedactions(value: unknown, width: number, height: number): ManualPdfRedaction[] {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0 || width * height > 10_000_000
    || !Array.isArray(value) || value.length < 1 || value.length > 200) {
    throw new Error("Lokale PDF-Schwärzung benötigt gültige, geprüfte Bereiche.");
  }
  return value.map((rect: ManualPdfRedaction) => {
    if (!rect || ![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite)
      || rect.x < 0 || rect.y < 0 || rect.width <= 0 || rect.height <= 0
      || rect.x + rect.width > width || rect.y + rect.height > height) {
      throw new Error("Schwärzungsbereich liegt außerhalb der PDF-Seite.");
    }
    const x = Math.floor(rect.x), y = Math.floor(rect.y);
    return { x, y, width: Math.ceil(rect.x + rect.width) - x, height: Math.ceil(rect.y + rect.height) - y };
  });
}

export function applyManualPdfRedactions(context: CanvasRenderingContext2D, rectangles: readonly ManualPdfRedaction[], width: number, height: number) {
  const checked = validateManualPdfRedactions(rectangles, width, height);
  context.save();
  try {
    context.globalAlpha = 1;
    context.globalCompositeOperation = "source-over";
    context.fillStyle = "#000";
    for (const rect of checked) context.fillRect(rect.x, rect.y, rect.width, rect.height);
  } finally { context.restore(); }
}
