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
      h1: ({ node: _node, ...props }) => <h1 {...props} className="mb-3 mt-6 text-2xl font-semibold text-foreground" />,
      h2: ({ node: _node, ...props }) => <h2 {...props} className="mb-2 mt-5 text-xl font-semibold text-foreground" />,
      h3: ({ node: _node, ...props }) => <h3 {...props} className="mb-2 mt-4 text-lg font-semibold text-foreground" />,
      h4: ({ node: _node, ...props }) => <h4 {...props} className="mb-2 mt-4 text-base font-semibold text-foreground" />,
      h5: ({ node: _node, ...props }) => <h5 {...props} className="mb-2 mt-3 text-base font-semibold text-foreground" />,
      h6: ({ node: _node, ...props }) => <h6 {...props} className="mb-2 mt-3 text-sm font-semibold text-foreground" />,
      p: ({ node: _node, ...props }) => <p {...props} className="my-3 leading-relaxed" />,
      ul: ({ node: _node, ...props }) => <ul {...props} className="my-3 list-disc space-y-1 pl-6" />,
      ol: ({ node: _node, ...props }) => <ol {...props} className="my-3 list-decimal space-y-1 pl-6" />,
      blockquote: ({ node: _node, ...props }) => <blockquote {...props} className="my-3 border-l-2 border-primary/40 pl-4" />,
      pre: ({ node: _node, ...props }) => <pre {...props} className="my-3 max-w-full overflow-x-auto rounded bg-muted p-3 text-sm" />,
      a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
      // An imported image URL should not contact another server merely by opening a result.
      img: ({ src, alt }) => <span>{alt || "Bild"}{src && <> · <a href={src} target="_blank" rel="noopener noreferrer">Bildquelle öffnen</a></>}</span>,
    }}>{content}</ReactMarkdown>
  </div>;
}
