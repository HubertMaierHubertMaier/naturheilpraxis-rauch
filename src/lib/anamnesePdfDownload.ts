import { supabase } from "@/integrations/supabase/client";

type DownloadResponse = {
  signedUrl?: string;
  error?: string;
};

export async function downloadAnamnesePackagePdf() {
  const { data, error } = await supabase.functions.invoke<DownloadResponse>(
    "download-anamnesis-pdf",
    { body: { document: "patientenpaket" } }
  );

  if (error || data?.error || !data?.signedUrl) {
    throw new Error(data?.error || error?.message || "PDF-Download nicht freigeschaltet");
  }

  const link = document.createElement("a");
  link.href = data.signedUrl;
  link.download = "patientenpaket-blanko.pdf";
  link.rel = "noopener noreferrer";
  document.body.appendChild(link);
  link.click();
  link.remove();
}
