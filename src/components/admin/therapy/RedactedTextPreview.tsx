import { Fragment } from "react";

const redactionMarkerPattern = /(\[[^\]\n]*(?:entfernt|geschwaerzt|geschwärzt)\])/giu;
const redactionMarkerPartPattern = /^\[[^\]\n]*(?:entfernt|geschwaerzt|geschwärzt)\]$/iu;

type Props = {
  text: string;
  className?: string;
};

export function RedactedTextPreview({ text, className = "" }: Props) {
  return (
    <pre className={`whitespace-pre-wrap break-words ${className}`}>
      {text.split(redactionMarkerPattern).map((part, index) => redactionMarkerPartPattern.test(part) ? (
        <span
          key={`${index}-${part}`}
          aria-label="Automatisch geschwaerzte personenbezogene Angabe"
          title="Automatisch lokal entfernt"
          className="mx-0.5 inline-block select-none rounded-sm bg-black px-2 text-black"
        >
          Geschwaerzt
        </span>
      ) : <Fragment key={`${index}-${part}`}>{part}</Fragment>)}
    </pre>
  );
}
