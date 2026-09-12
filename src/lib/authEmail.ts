export const normalizeEmail = (value: string) => value
  .normalize("NFKC")
  .replace(/[\u200B-\u200D\uFEFF]/g, "")
  .trim()
  .toLowerCase();
