"""
Generiert Selbsthypnose-MP3s (Florian + Seraphina) und Wortlaut-PDF
für die Raucherentwöhnung (E-Zigarette/Dampfen). Rate -50%, Pitch ±0Hz.
Überschreibt die alten Tiefenentspannung/Zielarbeit-Dateien NICHT –
neue Dateinamen, damit die UI sauber umstellt.
"""
import asyncio
from pathlib import Path
import edge_tts

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak

OUT = Path("public/therapie/raucherentwoehnung")
OUT.mkdir(parents=True, exist_ok=True)

VOICE_M = "de-DE-FlorianMultilingualNeural"
VOICE_F = "de-DE-SeraphinaMultilingualNeural"
RATE = "-50%"
PITCH = "+0Hz"

KURZ = """
Setz dich oder leg dich bequem hin... so, dass dein Körper getragen wird... von der Unterlage.
Leg eine Hand... locker auf deine Brust... über deinem Herzen.

Schließ die Augen... und atme ein paar Mal ganz natürlich... ein und aus.

Jetzt atme tief ein... durch die Nase... lass die Brust sich heben.
Und atme aus... lang... ruhig... durch den Mund... viel länger als das Einatmen.
Noch einmal... ein... und lang... ruhig... wieder aus.

Spür, wie deine Lunge sich mit jedem Atemzug... weiter öffnet.
Sauberer, frischer Sauerstoff... fließt bis in die feinsten Verästelungen.
Mit jedem Ausatmen... gibst du etwas ab, das du nicht mehr brauchst.

Sag dir innerlich, ganz ruhig:
Ich atme frei. Ich atme rein. Ich bin frei.

Stell dir vor... über deiner Brust... schwebt ein warmes, klares Licht.
Es fließt langsam in deine Lunge hinein... reinigt sie... weitet sie... heilt sie.
Mit jedem Atemzug wird dieses Licht heller... und du wirst klarer.

Du bist Nichtdampfer. So einfach ist das.
Die E-Zigarette gehört nicht mehr zu dir. Sie war ein Gast, der zu lange geblieben ist...
heute verabschiedest du sie freundlich.

Geschmack und Geruch kehren zu dir zurück.
Du riechst den Kaffee, das Brot, den Regen.
Die Welt wird wieder reich an Sinneserfahrungen.

Wenn du gleich die Augen öffnest...
nimmst du diese Klarheit und Freiheit mit in deinen Tag.

Zähl mit mir... von eins bis fünf.
Eins... du wirst wacher.
Zwei... spürst deinen Körper.
Drei... atme tiefer.
Vier... beweg sanft Finger und Zehen.
Fünf... öffne die Augen... ruhig... klar... frei.
"""

TIEF = """
Leg dich bequem auf den Rücken... mit etwas Unterstützung unter den Knien... wenn du magst.
Leg eine Hand auf die Brust... und die andere auf den Bauch.

Schließ die Augen... und nimm zunächst nur wahr... wie du daliegst.
Wie schwer dein Körper auf der Unterlage ruht.

Atme jetzt bewusst ein... vier Sekunden... durch die Nase... in den Bauch.
Und atme aus... acht Sekunden... durch den Mund.
Noch einmal... ein... und lang... lang... lang... aus.

Mit jedem Ausatmen... sinkt dein Körper tiefer in die Unterlage.
Dein Hinterkopf wird schwer. Deine Schultern werden schwer.
Deine Arme, deine Hände... schwer und warm.
Dein Becken... wird schwer. Deine Beine... werden schwer.
Deine Füße... werden warm und schwer.

Reise jetzt mit mir... an deinen sicheren Ort.
Vielleicht ein warmer Strand... vielleicht eine sonnige Lichtung im Wald...
vielleicht ein vertrauter Raum mit weichem Licht.
Sieh die Farben... höre die Geräusche... rieche die Luft.
Hier bist du sicher. Hier darfst du frei sein.

Stell dir vor... vor dir steht eine schwere Tür.
Hinter dieser Tür liegt alles, was du hinter dir lässt:
der Griff zur E-Zigarette... der reflexhafte Zug... der bittere Geschmack...
das schlechte Gefühl danach.
Du legst deine Hand auf das warme Holz. Du hörst, wie das Schloss leise einrastet.
Du drehst den Schlüssel um... und du gehst. Ohne zurückzuschauen.
Was hinter dieser Tür liegt, gehört nicht mehr zu dir.

Vor dir öffnet sich ein weiter Weg... ein neuer Morgen... ein klarer Horizont.
Du gehst weiter... und mit jedem Schritt wirst du leichter.

Und jetzt richte deine Aufmerksamkeit... auf deine Lunge.
Stell dir vor... über deinem Brustkorb schwebt eine sanfte, goldene Sonne.
Sie strahlt eine reinigende Wärme aus... die langsam in deine Lunge hineinfließt.
Sie berührt jede kleine Verästelung... löst alles, was nicht mehr gebraucht wird...
und führt es sanft hinaus... mit jedem Ausatmen.

Deine Lunge wird heller. Reiner. Lebendiger.
Mit jedem Tag, mit jedem Atemzug... regeneriert sich dein Gewebe.
Dein Körper weiß genau, wie er heilt. Er hat Jahrtausende Erfahrung.

Spür, wie sich dein Geschmack zurückmeldet. Deine Geruchsnerven erwachen.
Die Welt wird wieder vielfältig, wieder reich.
Das ist ein Geschenk, das du dir selbst zurückgibst.

Sprich jetzt innerlich diese Sätze... mir nach... ganz langsam:

Ich atme tief und frei.
Mein Körper dankt mir mit jedem Tag.
Ich bin stärker als jede Gewohnheit.
Ich entscheide... nicht das Verlangen.
Ich bin Nichtdampfer. Klar. Ruhig. Frei.
Mein Atem ist mein Anker.

Und immer, wenn in den nächsten Wochen ein Verlangen kommt...
denk daran: Ein Verlangen ist wie eine Welle.
Sie baut sich auf... sie erreicht ihren Höhepunkt... und sie ebbt wieder ab.
Niemals länger als wenige Minuten.

Du kannst diese Welle reiten, ohne ihr nachzugeben.
Drei Schritte: Stop. Atmen. Anker.
Stop – du sagst innerlich: ich bemerke dich.
Atmen – drei tiefe Atemzüge: 1 Sekunde ein, 4 Sekunden halten, 2 Sekunden aus.
Anker – Daumen und Zeigefinger zusammendrücken und denken: Ich bin frei.

Jede Welle, die du reitest, macht dich zu einem besseren Surfer.
Und mit jeder gemeisterten Welle wird die nächste leichter.

Bleib noch einen Moment an deinem sicheren Ort.
Spür die frische Luft in deiner Lunge.
Spür den ruhigen Schlag deines Herzens.
Spür die Klarheit, die in dir entsteht.

Und jetzt beginn ganz langsam zurückzukehren.
Du nimmst alles mit, was du hier gespürt hast.
Die Klarheit. Die Freiheit. Den Atem, der dir gehört.

Ich zähle dich zurück... von zehn bis eins.
Zehn... die ersten Geräusche kehren zurück.
Neun... du spürst die Unterlage unter dir.
Acht... dein Atem wird tiefer.
Sieben... deine Lunge bleibt frei und klar... das nimmst du mit.
Sechs... du bleibst Nichtdampfer... das nimmst du mit.
Fünf... beweg sanft die Finger.
Vier... beweg die Zehen.
Drei... räkel dich.
Zwei... atme einmal tief durch.
Eins... öffne die Augen... ruhig... wach... klar... frei.
"""

async def synth(text, out_file, voice):
    print(f"  → {out_file.name} ({voice.split('-')[-1]})")
    c = edge_tts.Communicate(text=text.strip(), voice=voice, rate=RATE, pitch=PITCH)
    await c.save(str(out_file))

async def main_tts():
    await synth(KURZ, OUT / "Selbsthypnose-Freiheit-Taeglich.mp3", VOICE_M)
    await synth(TIEF, OUT / "Selbsthypnose-Freiheit-Tief.mp3", VOICE_M)
    await synth(KURZ, OUT / "Selbsthypnose-Freiheit-Taeglich-Frau.mp3", VOICE_F)
    await synth(TIEF, OUT / "Selbsthypnose-Freiheit-Tief-Frau.mp3", VOICE_F)

def build_wortlaut():
    styles = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=styles["Heading1"], fontName="Helvetica-Bold",
                        fontSize=18, textColor=colors.HexColor("#3a5a40"), spaceAfter=10)
    h2 = ParagraphStyle("h2", parent=styles["Heading2"], fontName="Helvetica-Bold",
                        fontSize=13, textColor=colors.HexColor("#3a5a40"), spaceBefore=14, spaceAfter=6)
    body = ParagraphStyle("body", parent=styles["BodyText"], fontName="Helvetica",
                          fontSize=10.5, leading=15, spaceAfter=6)
    small = ParagraphStyle("small", parent=body, fontSize=9, textColor=colors.HexColor("#666"))

    doc = SimpleDocTemplate(str(OUT / "Selbsthypnose-Wortlaut-Audio.pdf"),
        pagesize=A4, leftMargin=2*cm, rightMargin=2*cm, topMargin=1.8*cm, bottomMargin=1.8*cm,
        title="Wortlaut Raucherentwöhnung-Hypnose", author="Naturheilpraxis Peter Rauch")
    s = [Paragraph("Selbsthypnose Frei atmen · Wortlaut", h1),
         Paragraph("Identischer Text wie in den Audios – zum Mitlesen oder als reine Lese-Hypnose.", small),
         Paragraph("Sprich die Worte langsam, mit Pausen. Eine Hand auf der Brust verstärkt die Wirkung.", body),
         Paragraph("Tägliche Kurzversion (≈ 5 Minuten)", h2)]
    for line in [l.strip() for l in KURZ.strip().split("\n\n")]:
        s.append(Paragraph(line.replace("\n", " "), body))
    s.append(PageBreak())
    s.append(Paragraph("Tiefe Sitzung (≈ 9–10 Minuten)", h2))
    for line in [l.strip() for l in TIEF.strip().split("\n\n")]:
        s.append(Paragraph(line.replace("\n", " "), body))
    s.append(Spacer(1, 14))
    s.append(Paragraph("Naturheilpraxis Peter Rauch · Heilpraktiker · Nur für Patientinnen und Patienten der Praxis.", small))
    doc.build(s)
    print("PDF: Selbsthypnose-Wortlaut-Audio.pdf")

if __name__ == "__main__":
    build_wortlaut()
    asyncio.run(main_tts())
    print("Fertig.")
