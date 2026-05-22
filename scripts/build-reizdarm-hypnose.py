"""
Generiert die Selbsthypnose-MP3s und PDFs für die Reizdarm-/spastischer-Darm-Hypnose.
Edge-TTS, Stimme de-DE-FlorianMultilingualNeural, Rate -50%, Pitch ±0 Hz (Hypnose-Standard).
"""
import asyncio
from pathlib import Path
import edge_tts

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER

OUT = Path("public/therapie/reizdarm")
OUT.mkdir(parents=True, exist_ok=True)

VOICE = "de-DE-FlorianMultilingualNeural"
RATE = "-50%"
PITCH = "+0Hz"

# ---------------------------------------------------------------------------
# SKRIPT 1 – Kurzversion (tägliche Anwendung, ca. 5 Minuten bei -50%)
# Fokus: Vagus-Aktivierung, Bauchatmung, Beckenboden lösen, Darm-Wärme
# ---------------------------------------------------------------------------
KURZ = """
Setz dich oder leg dich bequem hin... so, dass dein Körper ganz getragen wird... von der Unterlage.
Lass deine Hände... locker auf den Bauch sinken... unterhalb des Nabels... dort, wo dein Darm wohnt.

Schließ deine Augen... und atme ein paar Mal... ganz natürlich... ein und aus.

Jetzt... wirst du tiefer atmen... in deinen Bauch hinein.
Atme ein... durch die Nase... lass den Bauch sich heben... gegen deine Hände.
Und atme aus... lang... ruhig... durch den Mund... viel länger als das Einatmen.
Noch einmal... ein... der Bauch wird weit... und aus... lang... langsam... lass los.

Mit jedem Ausatmen... schickst du ein Signal an deinen Körper... an deinen Vagusnerv...
das Signal heißt... Ruhe. Sicherheit. Es ist alles gut.

Spür, wie sich dein Herzschlag... langsam... beruhigt.
Mit jedem Atemzug... ein wenig langsamer... ein wenig sanfter.

Und jetzt... richte deine Aufmerksamkeit... auf deinen Bauch.
Stell dir vor... unter deinen Händen... beginnt es... warm zu werden.
Eine sanfte... goldene Wärme... breitet sich aus... durch deinen ganzen Bauchraum.
Sie fließt durch deinen Magen... durch deinen Dünndarm... und ganz besonders... durch deinen Dickdarm.

Dein Darm darf jetzt... weich werden.
Alle Muskeln... die sich verkrampft hatten... dürfen jetzt... loslassen.
Stell dir vor... wie sich die Darmwand... weitet... wie ein gelöstes Tuch... das ruhig... in seiner Wellenbewegung schwingt.

Dein Darm... arbeitet in seinem eigenen Rhythmus.
Ruhig... gleichmäßig... ohne Hetze... ohne Druck.
Er weiß genau... wann er sich bewegen soll... und wann er ruhen darf.

Und auch dein Beckenboden... darf jetzt... weich werden.
Spür, wie der gesamte Bereich... zwischen den Sitzbeinen... locker wird... breit wird... entspannt.
Du bist sicher. Hier... in diesem Moment... gibt es nichts zu halten... und nichts zu drücken.

Sag dir innerlich... ganz ruhig:
Mein Darm ist ruhig.
Mein Bauch ist warm und weich.
Ich entscheide... wann ich gehe... mein Körper drängt mich nicht.
Ich bin sicher.

Atme noch einmal tief... in den warmen Bauch... ein.
Und lang... ruhig... wieder aus.

In dem Moment, in dem du gleich die Augen wieder öffnest...
nimmst du diese Ruhe... diese Wärme... und dieses Vertrauen... mit dir in deinen Tag.
Dein Darm bleibt entspannt... dein Atem bleibt ruhig... dein Becken bleibt weich.

Zähl in Gedanken mit mir... von eins... bis fünf.
Eins... du wirst wacher.
Zwei... spürst deinen Körper auf der Unterlage.
Drei... atme tiefer.
Vier... beweg sanft die Finger... die Zehen.
Fünf... öffne die Augen... ruhig und entspannt... ganz hier.
"""

# ---------------------------------------------------------------------------
# SKRIPT 2 – Tiefe Sitzung (ca. 9–10 Minuten bei -50%)
# Fokus: Vollständige Tiefenentspannung, sicherer Ort, Konditionierung umlernen
# (imperativer Drang → Entspannungsanker), Beckenboden-Kontrolle, Affirmationen
# ---------------------------------------------------------------------------
TIEF = """
Leg dich bequem hin... auf den Rücken... mit etwas Unterstützung unter den Knien... wenn du magst.
Leg eine Hand auf die Brust... und die andere... auf den Bauch... unterhalb des Nabels.

Schließ deine Augen... und nimm zunächst nur wahr... wie du daliegst.
Wie schwer dein Körper auf der Unterlage ruht.
Wie sich dein Atem... ganz von selbst... bewegt.

Atme jetzt bewusst ein... durch die Nase... in den Bauch.
Und atme aus... durch den Mund... doppelt so lang... wie das Einatmen war.
Einatmen... vier Sekunden... der Bauch wird weit.
Ausatmen... acht Sekunden... lang... ruhig... lass los.
Noch einmal... ein... und aus... lang... lang... lang.

Mit jedem Ausatmen... sinkt dein Körper ein wenig tiefer... in die Unterlage hinein.
Dein Hinterkopf... wird schwer.
Deine Schultern... werden schwer.
Deine Arme... deine Hände... werden schwer und warm.
Dein Rücken... wird breit und schwer.
Dein Becken... wird schwer.
Deine Beine... werden schwer.
Deine Füße... werden warm... und schwer.

Und jetzt... reisen wir gemeinsam... zu deinem sicheren Ort.
Ein Ort... an dem du ganz du selbst sein kannst.
Vielleicht ist es ein warmer Strand... vielleicht eine sonnige Lichtung im Wald...
vielleicht ein gemütlicher Raum mit einem knisternden Feuer.
Wähle einen Ort... an dem du... sicher bist. Geborgen bist. Ungestört bist.

Sieh dich um... an deinem Ort.
Welche Farben... siehst du?
Welche Geräusche... hörst du?
Welcher Duft... liegt in der Luft?
Welche Temperatur... spürst du auf der Haut?

An diesem Ort... bist du in Sicherheit.
Hier muss nichts geleistet werden. Hier wird nichts erwartet. Hier... darf alles weich werden.

Stell dir nun vor... über deinem Bauch... schwebt eine sanfte, goldene Sonne.
Sie strahlt eine wohlige Wärme aus... die langsam... in deinen Bauchraum hineinfließt.
Diese Wärme... berührt zuerst deinen Magen... und löst dort... jede Anspannung.
Dann fließt sie... weiter nach unten... in deinen Dünndarm... wie warmer Honig.
Und schließlich... erreicht sie deinen Dickdarm... den großen Bogen... der deinen Bauchraum umrahmt.

Spür, wie sich dein Dickdarm... in dieser Wärme entspannt.
Jede einzelne Faser... der Darmmuskulatur... darf jetzt... weich werden.
Die Krämpfe... die sich dort eingebrannt hatten... lösen sich auf... wie Eis in der Sonne.
Dein Darm... arbeitet in seinem natürlichen Rhythmus... ruhig... gleichmäßig... ohne Hektik.
Er weiß genau... was zu tun ist.

Und jetzt... wende deine Aufmerksamkeit... auf deinen Beckenboden.
Dieser Muskel... hat lange... sehr viel halten müssen.
Er war wachsam. Angespannt. Bereit.
Jetzt darf er sich ausruhen.
Spür den Raum zwischen deinen Sitzbeinen... wie er sich weitet.
Spür den Bereich... zwischen Schambein und Steißbein... wie er sich öffnet.
Dein Beckenboden... ist breit. Locker. Sicher gehalten... von deinem ganzen Becken.

Du bist hier sicher.
Dein Körper weiß... wann du eine Toilette brauchst.
Und dein Körper weiß auch... dass er warten kann.
Du hast die Kontrolle... auf eine entspannte Art... nicht durch Verkrampfung... sondern durch Ruhe.

Sprich jetzt innerlich diese Sätze... mir nach... ganz langsam:

Mein Darm ist mein Freund.
Er arbeitet in seinem eigenen, ruhigen Rhythmus.
Stress hat keine Macht mehr... über meinen Bauch.
Mein Beckenboden ist stark... und gleichzeitig entspannt.
Ich entscheide... wann ich auf die Toilette gehe.
Mein Körper drängt mich nicht. Mein Körper trägt mich.
Ich kann das Haus verlassen. Ich bin sicher. Wo immer ich bin.
Ich atme... mein Darm atmet mit. Tief. Ruhig. Weich.

Und immer... wenn du zukünftig einen plötzlichen Drang spürst...
wirst du... drei tiefe Atemzüge nehmen... in den warmen Bauch.
Eine Hand auf den Bauch legen... wenn möglich.
Und du wirst spüren... wie der Drang... mit jedem Ausatmen... weicher wird... wie er nachlässt... weil dein Darm... sich entspannt.
Drei tiefe Atemzüge... sind dein Anker... zurück in die Ruhe.

Bleib noch einen Moment... an deinem sicheren Ort.
Genieße die Wärme im Bauch.
Spür dein ruhiges Herz... den langsamen, gleichmäßigen Schlag.
Spür deinen weichen Beckenboden.
Spür deinen freien, entspannten Atem.

Und jetzt... beginn ganz langsam... zurückzukehren.
Du nimmst alles mit... was du hier gespürt hast.
Die Ruhe. Die Wärme. Das Vertrauen. Die Kontrolle ohne Verkrampfung.

Ich zähle dich gleich zurück... von zehn bis eins.
Mit jeder Zahl... wirst du ein wenig wacher... und nimmst diese Tiefenentspannung mit.

Zehn... die ersten Geräusche des Raumes kehren zurück.
Neun... du spürst die Unterlage unter dir... ganz deutlich.
Acht... dein Atem wird ein wenig tiefer.
Sieben... dein Bauch bleibt warm und weich... das nimmst du mit.
Sechs... dein Beckenboden bleibt entspannt... das nimmst du mit.
Fünf... beweg ganz sanft... deine Finger.
Vier... beweg deine Zehen.
Drei... räkel dich... wenn dir danach ist.
Zwei... atme einmal tief durch.
Eins... öffne die Augen... ruhig... wach... klar... und ganz... entspannt.
"""

async def synth(text: str, out_file: Path):
    print(f"  → {out_file.name}")
    communicate = edge_tts.Communicate(
        text=text.strip(),
        voice=VOICE,
        rate=RATE,
        pitch=PITCH,
    )
    await communicate.save(str(out_file))

async def main_tts():
    print("TTS: Kurzversion ...")
    await synth(KURZ, OUT / "Selbsthypnose-Reizdarm-Taeglich.mp3")
    print("TTS: Tiefe Sitzung ...")
    await synth(TIEF, OUT / "Selbsthypnose-Reizdarm-Tief.mp3")
    print("OK")

# ---------------------------------------------------------------------------
# PDF 1 – Begleitskript
# ---------------------------------------------------------------------------
def build_begleitskript():
    styles = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=styles["Heading1"], fontName="Helvetica-Bold",
                        fontSize=18, textColor=colors.HexColor("#3a5a40"), spaceAfter=10)
    h2 = ParagraphStyle("h2", parent=styles["Heading2"], fontName="Helvetica-Bold",
                        fontSize=13, textColor=colors.HexColor("#3a5a40"), spaceBefore=14, spaceAfter=6)
    body = ParagraphStyle("body", parent=styles["BodyText"], fontName="Helvetica",
                          fontSize=10.5, leading=15, spaceAfter=6)
    bullet = ParagraphStyle("bul", parent=body, leftIndent=14, bulletIndent=2)
    small = ParagraphStyle("small", parent=body, fontSize=9, textColor=colors.HexColor("#666"))

    doc = SimpleDocTemplate(
        str(OUT / "Begleitskript-Reizdarm.pdf"),
        pagesize=A4,
        leftMargin=2*cm, rightMargin=2*cm, topMargin=1.8*cm, bottomMargin=1.8*cm,
        title="Begleitskript Reizdarm-Hypnose",
        author="Naturheilpraxis Peter Rauch",
    )
    s = []
    s.append(Paragraph("Begleitskript zur Reizdarm-Hypnose", h1))
    s.append(Paragraph("Selbsthypnose, Atemanker und Alltagshinweise bei spastischem Darm und imperativem Stuhldrang", small))

    s.append(Paragraph("Worum es geht", h2))
    s.append(Paragraph(
        "Ein spastischer Darm reagiert empfindlich auf Stress. Das vegetative Nervensystem steht "
        "dauerhaft unter Sympathikus-Spannung – der Darm wird unruhig, krampft, der Stuhldrang "
        "kommt plötzlich und imperativ, oft ohne tatsächliche Entleerung. Die Hypnose arbeitet "
        "genau dort: sie aktiviert den Vagusnerv (Ruhenerv), entspannt die glatte Darmmuskulatur "
        "und löst die antrainierte Anspannung im Beckenboden. Sie <b>kann</b> Beschwerden "
        "deutlich reduzieren und das Sicherheitsgefühl im Alltag zurückbringen.", body))

    s.append(Paragraph("Anwendung der Audios", h2))
    s.append(Paragraph("<b>Tägliche Kurzversion</b> (ca. 5 Min.) – morgens nach dem Aufwachen oder "
                       "abends vor dem Einschlafen. Auch tagsüber als Mini-Pause nutzbar.", bullet))
    s.append(Paragraph("<b>Tiefe Sitzung</b> (ca. 9–10 Min.) – 2–3 × pro Woche in ungestörter "
                       "Umgebung. Kopfhörer empfohlen. Nicht beim Autofahren oder bei Tätigkeiten, "
                       "die deine volle Aufmerksamkeit erfordern.", bullet))
    s.append(Paragraph("Lege eine Hand sanft auf den Bauch – das verstärkt die Wirkung deutlich, "
                       "weil dein Gehirn Berührung als Sicherheitssignal interpretiert.", body))

    s.append(Paragraph("Der 3-Atemzüge-Anker für den Alltag", h2))
    s.append(Paragraph(
        "Sobald in den nächsten Wochen ein plötzlicher Stuhldrang auftaucht – im Supermarkt, "
        "im Auto, unterwegs – nutze den in der Hypnose verankerten Atem-Reflex:", body))
    s.append(Paragraph("1. Hand auf den Bauch (wenn möglich, unauffällig).", bullet))
    s.append(Paragraph("2. Drei tiefe Atemzüge: <b>4 Sekunden ein</b> durch die Nase, "
                       "<b>8 Sekunden aus</b> durch den Mund.", bullet))
    s.append(Paragraph("3. Innerlich sagen: „Mein Darm ist ruhig. Ich entscheide.\u201c", bullet))
    s.append(Paragraph(
        "Die lange Ausatmung aktiviert den Vagusnerv. Der Krampf lässt in über 70 % der Fälle "
        "innerhalb von 30–60 Sekunden spürbar nach – und du kannst entspannter entscheiden, "
        "ob du wirklich gehen musst.", body))

    s.append(Paragraph("Beckenboden-Hinweis", h2))
    s.append(Paragraph(
        "Viele Reizdarm-Betroffene halten den Beckenboden tagsüber unbewusst dauerhaft angespannt. "
        "Das verstärkt den Drang und kann paradoxerweise eine vollständige Entleerung verhindern. "
        "Lege dir am Smartphone 3–4 stille Erinnerungen pro Tag: <i>„Beckenboden weich, "
        "Sitzbeine breit, Atem in den Bauch.\u201c</i> – jeweils 3 Atemzüge lang.", body))

    s.append(Paragraph("Begleitende Empfehlungen", h2))
    s.append(Paragraph("<b>Verlaufstagebuch</b> mindestens 4 Wochen führen – damit sehen wir, wie "
                       "sich Stuhlfrequenz, Konsistenz, Drang-Episoden und Stresspegel verändern.", bullet))
    s.append(Paragraph("<b>Ruhepuls</b> morgens vor dem Aufstehen messen – ein erster Indikator "
                       "für die vegetative Erholung.", bullet))
    s.append(Paragraph("<b>Koffein, Alkohol, scharfe Speisen</b> für 4 Wochen reduzieren – sie "
                       "verstärken den Sympathikotonus zusätzlich.", bullet))
    s.append(Paragraph("<b>Wärme</b> (Wärmflasche, warmes Bad) ist deine beste Freundin – sie "
                       "wirkt direkt entkrampfend auf die Darmmuskulatur.", bullet))

    s.append(Paragraph("Wann meldest du dich in der Praxis?", h2))
    s.append(Paragraph("Bitte melde dich kurzfristig bei Peter Rauch oder einem Arzt, wenn "
                       "Folgendes auftritt:", body))
    s.append(Paragraph("Blut im Stuhl, schwarzer Teerstuhl oder neue starke Bauchschmerzen.", bullet))
    s.append(Paragraph("Ungewollter Gewichtsverlust oder anhaltendes Fieber.", bullet))
    s.append(Paragraph("Plötzliche Änderung der Stuhlgewohnheiten ohne erkennbaren Anlass, die "
                       "länger als 2 Wochen anhält.", bullet))
    s.append(Paragraph("Nächtlicher Durchfall, der dich aus dem Schlaf reißt.", bullet))
    s.append(Spacer(1, 12))
    s.append(Paragraph("Naturheilpraxis Peter Rauch · Heilpraktiker, Physiotherapeut, Hypnotherapeut · "
                       "Dieses Material ist Teil deiner Therapie und nicht für die Weitergabe bestimmt.", small))

    doc.build(s)
    print("PDF: Begleitskript-Reizdarm.pdf")

# ---------------------------------------------------------------------------
# PDF 2 – Verlaufstagebuch (Bristol, Frequenz, Drang, Stress, Puls)
# ---------------------------------------------------------------------------
def build_verlaufstagebuch():
    styles = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=styles["Heading1"], fontName="Helvetica-Bold",
                        fontSize=16, textColor=colors.HexColor("#3a5a40"), spaceAfter=6, alignment=TA_CENTER)
    h2 = ParagraphStyle("h2", parent=styles["Heading2"], fontName="Helvetica-Bold",
                        fontSize=11, textColor=colors.HexColor("#3a5a40"), spaceBefore=8, spaceAfter=4)
    body = ParagraphStyle("body", parent=styles["BodyText"], fontName="Helvetica",
                          fontSize=9.5, leading=13, spaceAfter=4)
    small = ParagraphStyle("small", parent=body, fontSize=8.5, textColor=colors.HexColor("#555"))

    doc = SimpleDocTemplate(
        str(OUT / "Verlaufstagebuch-Reizdarm.pdf"),
        pagesize=A4,
        leftMargin=1.5*cm, rightMargin=1.5*cm, topMargin=1.2*cm, bottomMargin=1.2*cm,
        title="Verlaufstagebuch Reizdarm",
        author="Naturheilpraxis Peter Rauch",
    )
    s = []
    s.append(Paragraph("Verlaufstagebuch – Reizdarm / spastischer Darm", h1))
    s.append(Paragraph("Bitte täglich ausfüllen und zum nächsten Termin mitbringen. "
                       "Name: __________________________   Therapiebeginn: __________", small))

    # Erklärung Bristol
    s.append(Paragraph("Bristol-Stuhlskala (Konsistenz)", h2))
    bristol = [
        ["Typ", "Beschreibung"],
        ["1", "Einzelne harte Klumpen (wie Nüsse) – sehr starke Verstopfung"],
        ["2", "Wurstartig, klumpig – Verstopfung"],
        ["3", "Wurstartig mit Rissen – normal, leicht trocken"],
        ["4", "Wurstartig, glatt, weich – ideal"],
        ["5", "Weiche Klümpchen mit klaren Rändern – tendenziell zu weich"],
        ["6", "Breiig, unförmig – leichter Durchfall"],
        ["7", "Flüssig, ohne feste Anteile – Durchfall"],
    ]
    t = Table(bristol, colWidths=[1.2*cm, 14*cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#dde5d4")),
        ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
        ("FONTSIZE", (0,0), (-1,-1), 9),
        ("GRID", (0,0), (-1,-1), 0.3, colors.HexColor("#888")),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ("LEFTPADDING", (0,0), (-1,-1), 4),
        ("RIGHTPADDING", (0,0), (-1,-1), 4),
    ]))
    s.append(t)
    s.append(Spacer(1, 6))
    s.append(Paragraph("<b>Drang-Skala:</b> 0 = kein Drang · 5 = mittel · 10 = imperativ, kaum kontrollierbar &nbsp;&nbsp;|&nbsp;&nbsp; "
                       "<b>Stress:</b> 0 = entspannt · 10 = überfordert &nbsp;&nbsp;|&nbsp;&nbsp; "
                       "<b>Puls:</b> Ruhepuls morgens, vor dem Aufstehen", small))
    s.append(Spacer(1, 8))

    # Tagestabelle
    header = ["Datum", "Wochentag", "Stuhl­frequenz", "Bristol-Typ (1–7)", "Drang-Episoden (0–10)",
              "Inkonti­nenz? (j/n)", "Stress (0–10)", "Ruhe­puls", "Hypnose? (k/t)", "Notiz / Auslöser"]

    rows = [header] + [[""] * len(header) for _ in range(14)]
    col_widths = [1.7*cm, 1.5*cm, 1.6*cm, 1.5*cm, 1.6*cm, 1.4*cm, 1.4*cm, 1.3*cm, 1.5*cm, 4.5*cm]
    tbl = Table(rows, colWidths=col_widths, rowHeights=[1.1*cm] + [1.0*cm]*14)
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#dde5d4")),
        ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
        ("FONTSIZE", (0,0), (-1,0), 7.5),
        ("FONTSIZE", (0,1), (-1,-1), 9),
        ("ALIGN", (0,0), (-1,0), "CENTER"),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ("GRID", (0,0), (-1,-1), 0.3, colors.HexColor("#777")),
        ("LEFTPADDING", (0,0), (-1,-1), 2),
        ("RIGHTPADDING", (0,0), (-1,-1), 2),
    ]))
    s.append(tbl)
    s.append(Spacer(1, 4))
    s.append(Paragraph("Hypnose-Spalte: <b>k</b> = Kurzversion gehört · <b>t</b> = Tiefe Sitzung gehört · <b>–</b> = keine", small))

    # zweite Seite – Wochenrückblick
    s.append(PageBreak())
    s.append(Paragraph("Wochenrückblick", h1))
    s.append(Spacer(1, 8))
    rk = [
        ["Woche von – bis", ""],
        ["Wie viele Tage Hypnose gehört?", ""],
        ["Anzahl ungewollter Stuhlabgänge / Woche", ""],
        ["Anzahl „falscher Alarm\u201c-Toilettengänge / Woche", ""],
        ["Konnte ich Termine / Ausflüge wahrnehmen, die ich vorher gemieden hätte?", ""],
        ["Wie hat sich mein Ruhepuls im Wochenmittel verändert?", ""],
        ["Was hat besonders geholfen?", ""],
        ["Was hat besonders belastet?", ""],
    ]
    rt = Table(rk, colWidths=[8*cm, 10*cm], rowHeights=[1.5*cm]*len(rk))
    rt.setStyle(TableStyle([
        ("FONTNAME", (0,0), (0,-1), "Helvetica-Bold"),
        ("FONTSIZE", (0,0), (-1,-1), 10),
        ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("GRID", (0,0), (-1,-1), 0.3, colors.HexColor("#777")),
        ("LEFTPADDING", (0,0), (-1,-1), 6),
        ("TOPPADDING", (0,0), (-1,-1), 6),
    ]))
    s.append(rt)
    s.append(Spacer(1, 10))
    s.append(Paragraph("Naturheilpraxis Peter Rauch · Heilpraktiker, Physiotherapeut, Hypnotherapeut", small))

    doc.build(s)
    print("PDF: Verlaufstagebuch-Reizdarm.pdf")

if __name__ == "__main__":
    build_begleitskript()
    build_verlaufstagebuch()
    asyncio.run(main_tts())
    print("Fertig.")
