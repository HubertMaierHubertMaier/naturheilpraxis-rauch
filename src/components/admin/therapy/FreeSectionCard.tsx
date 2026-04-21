import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import type { FreeSection } from "@/lib/therapyParser";

const VARIANT_STYLES: Record<FreeSection["variant"], { card: string; header: string; title: string }> = {
  info: { card: "border-border", header: "", title: "text-foreground" },
  warning: {
    card: "border-amber-500/40 bg-amber-500/[0.04]",
    header: "bg-amber-500/10 border-b border-amber-500/30",
    title: "text-amber-700 dark:text-amber-400",
  },
  danger: {
    card: "border-destructive/40 bg-destructive/[0.04]",
    header: "bg-destructive/10 border-b border-destructive/30",
    title: "text-destructive",
  },
  success: {
    card: "border-primary/30 bg-primary/[0.03]",
    header: "bg-primary/10 border-b border-primary/20",
    title: "text-primary",
  },
  muted: {
    card: "border-border bg-muted/30",
    header: "bg-muted/50 border-b border-border",
    title: "text-foreground",
  },
};

export function FreeSectionCard({ section }: { section: FreeSection }) {
  const styles = VARIANT_STYLES[section.variant];
  return (
    <Card className={cn("overflow-hidden", styles.card)}>
      <CardHeader className={cn("py-2.5 px-4", styles.header)}>
        <CardTitle className={cn("text-sm font-serif flex items-center gap-2", styles.title)}>
          <span className="text-lg leading-none" aria-hidden>{section.emoji}</span>
          {section.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-ul:my-2 prose-li:my-0.5">
          <ReactMarkdown>{section.content}</ReactMarkdown>
        </div>
      </CardContent>
    </Card>
  );
}
