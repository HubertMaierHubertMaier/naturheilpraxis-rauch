"""
Generiert Selbsthypnose-MP3s (Florian + Seraphina) und das Wortlaut-PDF
für die Schilddrüsen-Hypnose. Hypnose-Standard: Rate -50%, Pitch ±0Hz.
"""
import asyncio
from pathlib import Path
import edge_tts

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak

OUT = Path("public/therapie/schilddruese")
OUT.mkdir(parents=True, exist_ok=True)

VOICE_M = "de-DE-FlorianMultilingualNeural"
VOICE_F = "de-DE-SeraphinaMultilingualNeural"
RATE = "-50%"
PITCH = "+0Hz"

KURZ = """
Setz dich oder leg dich bequem hin... so, dass dein Hals... ganz frei ist.
Leg eine Hand... locker auf den Halsbereich... unterhalb des Kehlkopfs...
dort, wo deine Schilddrüse liegt... die kleine, schmetterlingsförmige Drüse...
die deinen Stoffwechsel... deine Wärme... und deine Energie reguliert.

Schließ die Augen... und atme ein paar Mal ganz natürlich... ein und aus.

Jetzt atme tief ein... durch die Nase... und lang aus... durch den Mund...
viel länger als das Einatmen. Noch einmal... ein... und lang... ruhig... aus.

Mit jedem Ausatmen... sendest du ein Signal an deinen Körper:
Ruhe. Sicherheit. Es ist alles in Ordnung.

Spür unter deiner Hand... wie sich der Halsbereich... entspannt.
Die kleinen Muskeln rund um den Kehlkopf... dürfen weich werden.
Der Bereich am vorderen Hals... wird warm... weit... durchlässig.

Stell dir vor... eine sanfte, goldene Wärme... fließt um deine Schilddrüse herum.
Sie umarmt diese kleine Drüse... wie ein warmes Tuch... wie weiches Sonnenlicht.
Deine Schilddrüse darf jetzt loslassen. Sie muss nichts mehr überproduzieren...
sie muss nichts mehr zurückhalten. Sie kehrt zurück... in ihren natürlichen Rhythmus.

Dein Stoffwechsel... findet sein eigenes, ruhiges Maß.
Deine Körpertemperatur... wird gleichmäßig und angenehm.
Dein Herzschlag... wird ruhig und klar.

Sag dir innerlich:
Meine Schilddrüse arbeitet im Einklang mit meinem Körper.
Mein Stoffwechsel ist ruhig und stabil.
Ich darf weich werden. Ich darf hier sein. Ich bin sicher.

Atme noch einmal tief in den warmen Halsbereich ein...
und lang... ruhig... wieder aus.

Wenn du gleich die Augen öffnest...
nimmst du diese Wärme und Ruhe mit in deinen Tag.

Zähl in Gedanken mit mir... von eins bis fünf.
Eins... du wirst wacher.
Zwei... spürst deinen Körper.
Drei... atme tiefer.
Vier... beweg sanft die Finger... die Zehen.
Fünf... öffne die Augen... ruhig... klar... ganz hier.
"""

TIEF = """
Leg dich bequem auf den Rücken... mit etwas Unterstützung unter den Knien... wenn du magst.
Leg eine Hand auf die Brust... und die andere... ganz sanft... auf den vorderen Hals,
unterhalb des Kehlkopfs... über deiner Schilddrüse.

Schließ die Augen... und nimm zunächst nur wahr... wie du daliegst.
Wie schwer dein Körper auf der Unterlage ruht. Wie sich dein Atem... ganz von selbst... bewegt.

Atme jetzt bewusst ein... vier Sekunden lang... durch die Nase... in den Bauch.
Und atme aus... acht Sekunden lang... durch den Mund.
Noch einmal... ein... und lang... lang... lang... aus.

Mit jedem Ausatmen sinkt dein Körper tiefer in die Unterlage.
Dein Hinterkopf wird schwer. Deine Schultern werden schwer.
Deine Arme, deine Hände... werden schwer und warm.
Dein Becken... wird schwer. Deine Beine... werden schwer.
Deine Füße... werden warm und schwer.

Und jetzt reisen wir gemeinsam... an deinen sicheren Ort.
Ein Ort, an dem du ganz du selbst sein darfst.
Vielleicht eine sonnige Lichtung... vielleicht ein warmer Strand...
vielleicht ein vertrauter Raum mit weichem Licht.
Sieh dich um... welche Farben siehst du... welche Geräusche hörst du...
welcher Duft liegt in der Luft... welche Temperatur spürst du auf der Haut?

Hier bist du sicher. Hier wird nichts erwartet. Hier darf alles weich werden.

Stell dir nun vor... über deinem vorderen Hals... schwebt eine sanfte, goldene Sonne.
Sie strahlt eine wohlige Wärme aus... die langsam in deinen Halsbereich hineinfließt.
Die Wärme umschließt deine Schilddrüse... diese kleine, schmetterlingsförmige Drüse...
sie wird umhüllt von Licht... von Geborgenheit.

Spür, wie sich jede einzelne Faser... rund um die Schilddrüse... entspannt.
Wie sich die Halsmuskeln lösen. Wie sich der Druck... der vielleicht lange dort war...
ganz langsam auflöst.

Deine Schilddrüse darf jetzt... in ihrem natürlichen Rhythmus arbeiten.
Sie weiß genau, was sie zu tun hat. Sie braucht keinen Druck. Sie braucht keine Angst.
Sie darf einfach... ihre Aufgabe erfüllen... ruhig... stetig... im Einklang mit deinem ganzen Körper.

Und während sich der Hals entspannt... darfst du auch deinem Kehlkopf erlauben...
weich zu werden. Vielleicht hast du oft Dinge geschluckt, die du eigentlich sagen wolltest.
Vielleicht hast du dich klein gemacht... wo du groß hättest sein dürfen.
Heute, in diesem Moment... darfst du wissen:
Deine Stimme zählt. Was du fühlst, ist wichtig. Du darfst Raum einnehmen.

Sprich jetzt innerlich diese Sätze... mir nach... ganz langsam:

Meine Schilddrüse arbeitet in ihrem natürlichen Rhythmus.
Mein Stoffwechsel ist stabil und gesund.
Mein Hals ist offen, weich und warm.
Meine Stimme darf gehört werden.
Ich darf so groß sein, wie ich bin.
Stress hat keine Macht mehr über meinen Hals.
Ich bin im Einklang mit mir selbst.

Und immer, wenn du in den nächsten Wochen einen Moment der Anspannung im Hals spürst...
wirst du eine Hand auflegen... drei tiefe Atemzüge nehmen... in den warmen Halsbereich.
Und du wirst spüren... wie sich dein Hals mit jedem Ausatmen... weiter öffnet...
wie die Wärme zurückkehrt... wie deine Schilddrüse... wieder Ruhe findet.
Drei Atemzüge sind dein Anker zurück in die Ruhe.

Bleib noch einen Moment an deinem sicheren Ort.
Genieße die Wärme im Hals.
Spür den ruhigen, gleichmäßigen Schlag deines Herzens.
Spür deinen freien, entspannten Atem.

Und jetzt beginn ganz langsam zurückzukehren.
Du nimmst alles mit, was du hier gespürt hast.
Die Ruhe. Die Wärme. Das Vertrauen in deinen Körper.

Ich zähle dich zurück... von zehn bis eins.
Zehn... die ersten Geräusche des Raumes kehren zurück.
Neun... du spürst die Unterlage unter dir.
Acht... dein Atem wird tiefer.
Sieben... dein Hals bleibt warm und weich, das nimmst du mit.
Sechs... deine Schilddrüse bleibt in Ruhe, das nimmst du mit.
Fünf... beweg sanft die Finger.
Vier... beweg die Zehen.
Drei... räkel dich, wenn dir danach ist.
Zwei... atme einmal tief durch.
Eins... öffne die Augen... ruhig... wach... klar... und ganz... entspannt.
"""

async def synth(text, out_file, voice):
    print(f"  → {out_file.name} ({voice.split('-')[-1]})")
    c = edge_tts.Communicate(text=text.strip(), voice=voice, rate=RATE, pitch=PITCH)
    await c.save(str(out_file))

async def main_tts():
    await synth(KURZ, OUT / "Selbsthypnose-Schilddruese-Taeglich.mp3", VOICE_M)
    await synth(TIEF, OUT / "Selbsthypnose-Schilddruese-Tief.mp3", VOICE_M)
    await synth(KURZ, OUT / "Selbsthypnose-Schilddruese-Taeglich-Frau.mp3", VOICE_F)
    await synth(TIEF, OUT / "Selbsthypnose-Schilddruese-Tief-Frau.mp3", VOICE_F)

def build_wortlaut():
    styles = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=styles["Heading1"], fontName="Helvetica-Bold",
                        fontSize=18, textColor=colors.HexColor("#3a5a40"), spaceAfter=10)
    h2 = ParagraphStyle("h2", parent=styles["Heading2"], fontName="Helvetica-Bold",
                        fontSize=13, textColor=colors.HexColor("#3a5a40"), spaceBefore=14, spaceAfter=6)
    body = ParagraphStyle("body", parent=styles["BodyText"], fontName="Helvetica",
                          fontSize=10.5, leading=15, spaceAfter=6)
    small = ParagraphStyle("small", parent=body, fontSize=9, textColor=colors.HexColor("#666"))

    doc = SimpleDocTemplate(str(OUT / "Selbsthypnose-Skript-Wortlaut.pdf"),
        pagesize=A4, leftMargin=2*cm, rightMargin=2*cm, topMargin=1.8*cm, bottomMargin=1.8*cm,
        title="Wortlaut Schilddrüsen-Hypnose", author="Naturheilpraxis Peter Rauch")
    s = [Paragraph("Selbsthypnose Schilddrüse · Wortlaut", h1),
         Paragraph("Zum Mitlesen oder als Lese-Hypnose anstelle des Audios.", small),
         Paragraph("Sprich die Worte langsam, mit Pausen. Eine Hand am vorderen Hals verstärkt die Wirkung.", body),
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
    print("PDF: Selbsthypnose-Skript-Wortlaut.pdf")

if __name__ == "__main__":
    build_wortlaut()
    asyncio.run(main_tts())
    print("Fertig.")
