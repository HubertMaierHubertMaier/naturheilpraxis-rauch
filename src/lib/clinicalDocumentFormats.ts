export const CLINICAL_DOCUMENT_ACCEPT = ".pdf,.docx,.xlsx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export const isSupportedClinicalDocument = (file: { name: string; type: string }): boolean => /\.(pdf|docx|xlsx)$/i.test(file.name) || file.type === "application/pdf";
