import ReactMarkdown from "react-markdown";

const statusLabels = new Map<string, string>([
  ["reference", "Quelleneintrag"],
  ["draft", "Entwurf – noch nicht geprüft"],
  ["unreviewed", "Noch nicht geprüft"],
  ["unrated", "Noch nicht bewertet"],
  ["unverified", "Noch nicht geprüft"],
]);

export function readableWikiStatus(value: string | null | undefined): string {
  return value ? statusLabels.get(value) || value : "unbekannt";
}

/** Presentation only: retain the complete source; raw HTML is never executed. */
export function WikiSourceContent({ content }: { content: string }) {
  return <div className="prose prose-sm min-w-0 max-w-none [overflow-wrap:anywhere] text-muted-foreground prose-headings:text-foreground prose-pre:max-w-full prose-pre:overflow-x-auto dark:prose-invert">
    <ReactMarkdown components={{
      a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
      // An imported image URL should not contact another server merely by opening a result.
      img: ({ src, alt }) => <span>{alt || "Bild"}{src && <> · <a href={src} target="_blank" rel="noopener noreferrer">Bildquelle öffnen</a></>}</span>,
    }}>{content}</ReactMarkdown>
  </div>;
}
