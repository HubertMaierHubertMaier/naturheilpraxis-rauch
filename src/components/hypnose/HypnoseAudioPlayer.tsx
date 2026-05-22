import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  Play, Pause, Download, Clock, Volume2, VolumeX,
  Waves, Trees, Music2, CircleSlash, Mic, User,
} from "lucide-react";

export type VoiceOption = "male" | "female";

export interface HypnoseAudioPlayerProps {
  title: string;
  description?: string;
  duration?: string;
  /** Hauptdatei männliche Stimme (Florian) */
  fileMale: string;
  /** Hauptdatei weibliche Stimme (Seraphina) – optional, falls noch nicht produziert */
  fileFemale?: string;
}

type Ambient = "none" | "ocean" | "forest" | "music";

const AMBIENTS: Record<Exclude<Ambient, "none">, { label: string; file: string; icon: any }> = {
  ocean:  { label: "Meeresrauschen", file: "/audio/ambient/meeresrauschen.mp3", icon: Waves },
  forest: { label: "Waldgeräusche",  file: "/audio/ambient/waldgeraeusche.mp3", icon: Trees },
  music:  { label: "Sanfte Musik",   file: "/audio/ambient/sanfte-musik.mp3",   icon: Music2 },
};

export const HypnoseAudioPlayer = ({
  title, description, duration, fileMale, fileFemale,
}: HypnoseAudioPlayerProps) => {
  const [voice, setVoice] = useState<VoiceOption>("male");
  const [ambient, setAmbient] = useState<Ambient>("none");
  const [voiceVol, setVoiceVol] = useState(0.9);
  const [ambientVol, setAmbientVol] = useState(0.25);
  const [playing, setPlaying] = useState(false);

  const voiceRef = useRef<HTMLAudioElement | null>(null);
  const ambientRef = useRef<HTMLAudioElement | null>(null);

  const currentFile = voice === "female" && fileFemale ? fileFemale : fileMale;

  // Volume binding
  useEffect(() => { if (voiceRef.current) voiceRef.current.volume = voiceVol; }, [voiceVol]);
  useEffect(() => { if (ambientRef.current) ambientRef.current.volume = ambientVol; }, [ambientVol]);

  // Wenn Stimme gewechselt wird, Position übernehmen
  useEffect(() => {
    const a = voiceRef.current;
    if (!a) return;
    const wasPlaying = !a.paused;
    const t = a.currentTime;
    a.src = currentFile;
    a.load();
    a.currentTime = t || 0;
    if (wasPlaying) a.play().catch(() => {});
  }, [currentFile]);

  // Ambient steuern
  useEffect(() => {
    const a = ambientRef.current;
    if (!a) return;
    if (ambient === "none") { a.pause(); return; }
    a.src = AMBIENTS[ambient].file;
    a.loop = true;
    a.volume = ambientVol;
    if (playing) a.play().catch(() => {});
  }, [ambient]);

  // Wenn Hauptstimme pausiert/spielt → Ambient mitziehen
  const togglePlay = async () => {
    const v = voiceRef.current;
    const am = ambientRef.current;
    if (!v) return;
    if (v.paused) {
      try { await v.play(); } catch { return; }
      if (ambient !== "none" && am) am.play().catch(() => {});
      setPlaying(true);
    } else {
      v.pause();
      if (am) am.pause();
      setPlaying(false);
    }
  };

  return (
    <Card className="shadow-card">
      <CardContent className="p-5 md:p-6 space-y-4">
        {/* Header */}
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
          {duration && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
              <Clock className="h-3 w-3" />
              {duration}
            </div>
          )}
        </div>

        {/* Stimme wählen */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-foreground/80">Stimme:</span>
          <Button
            size="sm"
            variant={voice === "male" ? "default" : "outline"}
            onClick={() => setVoice("male")}
            className="h-7 gap-1.5 text-xs"
          >
            <Mic className="h-3.5 w-3.5" /> Männlich
          </Button>
          <Button
            size="sm"
            variant={voice === "female" ? "default" : "outline"}
            onClick={() => fileFemale && setVoice("female")}
            disabled={!fileFemale}
            className="h-7 gap-1.5 text-xs"
            title={fileFemale ? "Weibliche Stimme" : "Weibliche Version in Produktion"}
          >
            <User className="h-3.5 w-3.5" /> Weiblich
            {!fileFemale && <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">bald</Badge>}
          </Button>
        </div>

        {/* Hintergrund wählen */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-foreground/80">Hintergrund:</span>
            <Button
              size="sm"
              variant={ambient === "none" ? "default" : "outline"}
              onClick={() => setAmbient("none")}
              className="h-7 gap-1.5 text-xs"
            >
              <CircleSlash className="h-3.5 w-3.5" /> Aus
            </Button>
            {(Object.keys(AMBIENTS) as Array<keyof typeof AMBIENTS>).map((k) => {
              const A = AMBIENTS[k];
              const Icon = A.icon;
              return (
                <Button
                  key={k}
                  size="sm"
                  variant={ambient === k ? "default" : "outline"}
                  onClick={() => setAmbient(k)}
                  className="h-7 gap-1.5 text-xs"
                >
                  <Icon className="h-3.5 w-3.5" /> {A.label}
                </Button>
              );
            })}
          </div>
          {ambient !== "none" && (
            <div className="flex items-center gap-3 pl-1">
              <Volume2 className="h-3.5 w-3.5 text-muted-foreground" />
              <Slider
                value={[Math.round(ambientVol * 100)]}
                onValueChange={(v) => setAmbientVol(v[0] / 100)}
                min={0} max={60} step={1}
                className="max-w-[180px]"
              />
              <span className="text-[11px] text-muted-foreground w-9">
                {Math.round(ambientVol * 100)}%
              </span>
            </div>
          )}
        </div>

        {/* Player */}
        <div className="space-y-2">
          <audio
            ref={voiceRef}
            controls
            preload="none"
            className="w-full"
            src={currentFile}
            onPlay={() => {
              setPlaying(true);
              if (ambient !== "none") ambientRef.current?.play().catch(() => {});
            }}
            onPause={() => { setPlaying(false); ambientRef.current?.pause(); }}
            onEnded={() => { setPlaying(false); ambientRef.current?.pause(); }}
          >
            Ihr Browser unterstützt kein Audio-Element.
          </audio>
          {/* hidden ambient audio */}
          <audio ref={ambientRef} preload="none" />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={togglePlay} className="gap-2">
            {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {playing ? "Pause" : "Wiedergabe"}
          </Button>
          <a href={currentFile} download>
            <Button variant="outline" size="sm" className="gap-2">
              <Download className="h-3.5 w-3.5" /> Stimme herunterladen
            </Button>
          </a>
        </div>
      </CardContent>
    </Card>
  );
};
