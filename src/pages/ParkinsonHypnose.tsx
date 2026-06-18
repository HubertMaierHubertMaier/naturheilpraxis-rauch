import { Layout } from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Headphones, Download, Clock, AlertTriangle, Play, Pause } from "lucide-react";
import SEOHead from "@/components/seo/SEOHead";
import { useContentProtection } from "@/hooks/useContentProtection";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const AudioPlayer = ({ title, duration, objectPath, filename }: { title: string; duration: string; objectPath: string; filename: string }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [src, setSrc] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.storage
        .from("patient-library")
        .createSignedUrl(objectPath, 60 * 60);
      if (cancelled) return;
      if (error || !data?.signedUrl) {
        toast.error("Audio konnte nicht geladen werden");
        setLoading(false);
        return;
      }
      setSrc(data.signedUrl);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [objectPath]);

  const togglePlay = async () => {
    if (!audioRef.current || !src) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      try {
        await audioRef.current.play();
        setIsPlaying(true);
      } catch {
        toast.error("Abspielen fehlgeschlagen");
      }
    }
  };

  const handleEnded = () => setIsPlaying(false);

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!src) return;
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      window.open(src, "_blank");
    }
  };

  return (
    <Card className="border-primary/20">
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              disabled={loading || !src}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              aria-label={isPlaying ? "Pause" : "Abspielen"}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
            </button>
            <div>
              <p className="font-medium text-foreground">{title}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" /> {duration}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleDownload} disabled={loading || !src}>
            <Download className="mr-1.5 h-3.5 w-3.5" /> MP3
          </Button>
        </div>
        <audio
          ref={audioRef}
          src={src}
          onEnded={handleEnded}
          className="w-full h-8"
          controls
          preload="none"
        />
      </CardContent>
    </Card>
  );
};

const ParkinsonHypnose = () => {
  useContentProtection();

  return (
    <Layout>
      <SEOHead
        title="Parkinson-Hypnose – Festes Ufer, ruhiger Atem"
        description="Begleitende Hypnose-Materialien bei Parkinson und stressabhängigem Tremor – ausschließlich über die geschützte Patienten-Bibliothek erreichbar."
      />
      <div className="bg-gradient-to-b from-sage-50 via-background to-background py-14 md:py-20">
        <div className="container">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="outline" className="mb-4 border-primary/30 text-primary">
              <ShieldCheck className="mr-1.5 h-3.5 w-3.5" /> Nur für Patienten
            </Badge>
            <h1 className="mb-4 font-serif text-3xl font-semibold text-foreground md:text-5xl leading-tight">
              Parkinson-Hypnose
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground leading-relaxed">
              „Festes Ufer, ruhiger Atem" – begleitende Hypnose bei Parkinson und stressabhängigem Tremor.
              Stabilisierung statt Bekämpfung, mit einem alltagstauglichen Stress-Anker.
            </p>
          </div>
        </div>
      </div>

      <div className="container py-10 md:py-16">
        <div className="mx-auto max-w-3xl space-y-8">
          <Card className="border-primary/30 shadow-card">
            <CardContent className="p-6 md:p-8 space-y-6">
              <div className="flex items-start gap-3">
                <Headphones className="mt-1 h-6 w-6 text-primary shrink-0" />
                <div>
                  <h2 className="font-serif text-xl font-semibold text-foreground">
                    Deine Hypnose-Audios
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Beide Versionen mit Florian (de-DE-FlorianMultilingualNeural) bei −50 % Geschwindigkeit gerendert.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <AudioPlayer
                  title="Lange Version – Festes Ufer, ruhiger Atem"
                  duration="~20 Minuten"
                  objectPath="hypnose/parkinson-hypnose-lang.mp3"
                  filename="parkinson-hypnose-lang.mp3"
                />
                <AudioPlayer
                  title="Kurze Version – Alltags-Anker"
                  duration="~10 Minuten"
                  objectPath="hypnose/parkinson-hypnose-kurz.mp3"
                  filename="parkinson-hypnose-kurz.mp3"
                />
              </div>

              <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground leading-relaxed">
                <p className="font-medium text-foreground mb-1">So nutzt du die Audios</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li><strong>Lange Version:</strong> Für tiefe Entspannung zu Hause – Treppen-Induktion, Strom-Metapher, Anker-Installation, Identitätsstärkung.</li>
                  <li><strong>Kurze Version:</strong> Für unterwegs oder als Auffrischung – komprimiert auf die Kernelemente.</li>
                  <li>Beide Versionen enthalten den <strong>Stress-Anker</strong> (sanftes Berühren von Daumen + Zeigefinger).</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card className="border-accent/30 bg-accent/5">
            <CardContent className="p-5 md:p-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                <div className="space-y-2 text-sm text-foreground leading-relaxed">
                  <p className="font-semibold">Wichtiger Hinweis</p>
                  <p className="text-muted-foreground">
                    Die Hypnose ist eine <strong>begleitende</strong> Maßnahme – sie ersetzt keine
                    neurologische Behandlung und keine verordnete Medikation. Änderungen an
                    Medikamenten (z. B. L-Dopa) bitte ausschließlich mit deinem Heilpraktiker oder Arzt
                    besprechen. Bei plötzlicher Verschlechterung, Stürzen oder neuen Symptomen
                    bitte zeitnah Rücksprache halten.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default ParkinsonHypnose;
