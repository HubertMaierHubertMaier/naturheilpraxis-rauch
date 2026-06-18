# Parkinson-Hypnose – SSML-Dateien

Zwei Skripte für Patienten mit Tremor und stressabhängiger Symptomverstärkung.

## Dateien
- `parkinson-hypnose-lang.ssml` – ca. 20 Min (7 Phasen)
- `parkinson-hypnose-kurz.ssml` – ca. 10 Min (5 Phasen)

## Verbindlicher TTS-Standard (Hypnose)
- Engine: **Edge-TTS** (Microsoft Azure)
- Stimme: `de-DE-FlorianMultilingualNeural`
- Rate: `-50%`
- Pitch: `±0 Hz`

## Rendern via edge-tts CLI
```bash
pip install edge-tts

edge-tts --file parkinson-hypnose-lang.ssml \
  --voice de-DE-FlorianMultilingualNeural \
  --write-media parkinson-hypnose-lang.mp3

edge-tts --file parkinson-hypnose-kurz.ssml \
  --voice de-DE-FlorianMultilingualNeural \
  --write-media parkinson-hypnose-kurz.mp3
```

Rate/Pitch sind bereits im SSML als `<prosody>` gesetzt — keine zusätzlichen
CLI-Flags nötig.

## Metaphorik (bewusst gewählt)
- **„Festes Ufer"** statt „Ufer zurück" → Stabilität, Erdung
- **„Tiefer Grund"** statt „Bett weiten" → Selbstwirksamkeit, keine Passivität
- **Tremor als Oberflächenwelle** → Akzeptanz statt Bekämpfung
- **Anker: Daumen + Zeigefinger + langes Ausatmen** → jederzeit alltagstauglich
