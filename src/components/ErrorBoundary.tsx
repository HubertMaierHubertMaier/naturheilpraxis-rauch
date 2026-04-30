import React from "react";

interface Props {
  children: React.ReactNode;
  /** Kontext-Label fürs Logging, z.B. "TherapyRecommendation" */
  label?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  info: string | null;
}

/**
 * Lokaler ErrorBoundary, der den Fehler sichtbar macht statt die App leise
 * zurückzusetzen. Nutzt der Diagnose, falls die KI-Therapieansicht „rausspringt".
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null, info: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, info: null };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Bewusst NICHT in console.error mit Patientendaten (DSGVO)
    console.error(
      `[ErrorBoundary:${this.props.label || "unknown"}] ${error.name}: ${error.message}`,
      info?.componentStack?.split("\n").slice(0, 6).join("\n")
    );
    this.setState({ info: info?.componentStack || null });
  }

  reset = () => this.setState({ hasError: false, error: null, info: null });

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="m-4 rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm">
        <p className="font-semibold text-destructive">
          Anzeigefehler in „{this.props.label || "Komponente"}"
        </p>
        <p className="mt-1 text-muted-foreground">
          Die Eingaben sind erhalten. Bitte oben das Bild reload-frei prüfen oder
          „Zurücksetzen" klicken. Details stehen im Browser-Console-Log.
        </p>
        {this.state.error && (
          <pre className="mt-2 max-h-40 overflow-auto rounded bg-background p-2 text-xs">
            {this.state.error.name}: {this.state.error.message}
          </pre>
        )}
        <button
          type="button"
          onClick={this.reset}
          className="mt-3 inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
        >
          Zurücksetzen
        </button>
      </div>
    );
  }
}
