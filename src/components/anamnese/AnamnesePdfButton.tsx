import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import { downloadAnamneseBlankoPdf } from "@/lib/anamnesePdfDownload";

type AnamnesePdfButtonProps = Omit<ButtonProps, "onClick"> & {
  label?: string;
};

export function AnamnesePdfButton({ label = "Anamnesebogen-PDF herunterladen", disabled, children, ...props }: AnamnesePdfButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      await downloadAnamneseBlankoPdf();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "PDF-Download nicht freigeschaltet");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button type="button" onClick={handleDownload} disabled={disabled || loading} {...props}>
      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
      {children ?? label}
    </Button>
  );
}