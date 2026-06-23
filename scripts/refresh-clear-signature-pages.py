"""Append an interactive AcroForm signature page to each blanko PDF.

Patient fills in directly in Acrobat Reader (gratis) / Preview / Mail-Markup —
no print required. Includes a short, friendly 'so geht's' box for PC + Handy.
"""
from __future__ import annotations

from io import BytesIO
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

W, H = A4
M = 42
SAGE = HexColor("#5b8a72")
SAGE_DARK = HexColor("#3f6652")
SAGE_LIGHT = HexColor("#e8f0ea")
SAND = HexColor("#f5efe6")
TERRACOTTA = HexColor("#b96b4f")
INK = HexColor("#222222")
MUTED = HexColor("#666666")
BORDER = HexColor("#9aa89a")

FONT_DIR = Path("/nix/store/0hdgmcjy7q8zn7h3amz8nf96l9qh7wv0-liberation-fonts-2.1.5/share/fonts/truetype")
try:
    pdfmetrics.registerFont(TTFont("PraxisSans", str(FONT_DIR / "LiberationSans-Regular.ttf")))
    pdfmetrics.registerFont(TTFont("PraxisSans-Bold", str(FONT_DIR / "LiberationSans-Bold.ttf")))
    pdfmetrics.registerFont(TTFont("PraxisSans-Italic", str(FONT_DIR / "LiberationSans-Italic.ttf")))
except Exception:
    pass

FONT = "PraxisSans"
BOLD = "PraxisSans-Bold"
ITALIC = "PraxisSans-Italic"

BASE = Path("assets/protected-pdfs")

DOCS = [
    {
        "path": BASE / "anamnesebogen-blanko.pdf",
        "title": "Bestätigung & Unterschrift – Anamnesebogen",
        "document": "den Anamnesebogen",
        "legal": "§ 630e BGB und Art. 7 DSGVO",
        "checkbox": "Ich bestätige: Ich habe den Anamnesebogen vollständig gelesen, verstanden und nach bestem Wissen wahrheitsgemäß ausgefüllt.",
        "prefix": "anamnese",
    },
    {
        "path": BASE / "datenschutz-einwilligung-blanko.pdf",
        "title": "Bestätigung & Unterschrift – Datenschutz-Einwilligung",
        "document": "die Datenschutz-Einwilligung",
        "legal": "Art. 7 DSGVO",
        "checkbox": "Ich bestätige: Ich habe die Datenschutzinformationen gelesen, verstanden und willige entsprechend ein.",
        "prefix": "datenschutz",
    },
    {
        "path": BASE / "patientenvertrag-blanko.pdf",
        "title": "Bestätigung & Unterschrift – Behandlungsvertrag",
        "document": "den Behandlungsvertrag",
        "legal": "§ 630a BGB / Behandlungsvertrag",
        "checkbox": "Ich bestätige: Ich habe den Behandlungsvertrag gelesen, verstanden und bin mit den Inhalten einverstanden.",
        "prefix": "vertrag",
    },
    {
        "path": BASE / "patientenpaket-blanko.pdf",
        "title": "Bestätigung & Unterschrift – Patientenpaket",
        "document": "die Patientenunterlagen (Anamnese, Datenschutz, Behandlungsvertrag)",
        "legal": "§ 630a/e BGB und Art. 7 DSGVO",
        "checkbox": "Ich bestätige: Ich habe alle Patientenunterlagen gelesen, verstanden und bin einverstanden.",
        "prefix": "paket",
    },
]


def wrap(c, text, x, y, width, size=10, leading=13, font=FONT):
    c.setFont(font, size)
    line = ""
    for word in text.split():
        cand = f"{line} {word}".strip()
        if c.stringWidth(cand, font, size) <= width:
            line = cand
        else:
            c.drawString(x, y, line)
            y -= leading
            line = word
    if line:
        c.drawString(x, y, line)
        y -= leading
    return y


def create_signature_page(cfg: dict) -> PdfReader:
    packet = BytesIO()
    c = canvas.Canvas(packet, pagesize=A4)
    form = c.acroForm
    p = cfg["prefix"]

    # Header
    c.setFillColor(SAGE)
    c.rect(0, H - 60, W, 60, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont(BOLD, 14.5)
    c.drawString(M, H - 27, cfg["title"])
    c.setFont(FONT, 8.5)
    c.drawString(M, H - 44, "Naturheilpraxis Peter Rauch · direkt am PC oder Handy ausfüllen und unterschreiben")

    # Verständnis-Box
    y = H - 80
    c.setFillColor(SAND)
    c.roundRect(M, y - 70, W - 2 * M, 70, 5, fill=1, stroke=0)
    c.setFillColor(INK)
    c.setFont(BOLD, 10.5)
    c.drawString(M + 12, y - 17, "Warum diese Bestätigung?")
    wrap(
        c,
        f"Damit die Unterlagen rechtlich verbindlich sind, müssen Sie bestätigen, dass Sie {cfg['document']} "
        f"nicht nur gelesen, sondern auch verstanden haben ({cfg['legal']}). Bitte das Häkchen setzen und unten unterschreiben.",
        M + 12, y - 33, W - 2 * M - 24, size=9.3, leading=12,
    )

    # "So geht's" – freundlicher 3-Wege-Hinweis
    y = H - 165
    c.setFillColor(SAGE_LIGHT)
    c.roundRect(M, y - 132, W - 2 * M, 132, 5, fill=1, stroke=0)
    c.setFillColor(SAGE_DARK)
    c.setFont(BOLD, 11.5)
    c.drawString(M + 12, y - 17, "So unterschreiben Sie – kostenlos, ohne Ausdrucken")
    c.setFillColor(INK)
    c.setFont(BOLD, 9.5)
    c.drawString(M + 12, y - 36, "PC / Mac (Adobe Acrobat Reader, gratis):")
    c.setFont(FONT, 9.3)
    c.drawString(M + 22, y - 50,
                 "Rechts in der Werkzeugleiste „Ausfüllen und Unterschreiben“ → „Selbst signieren“ →")
    c.drawString(M + 22, y - 63,
                 "Unterschrift mit Maus/Trackpad zeichnen → ins Unterschriftsfeld unten ziehen → speichern.")

    c.setFont(BOLD, 9.5)
    c.drawString(M + 12, y - 82, "iPhone / iPad (Bordmittel, nichts installieren):")
    c.setFont(FONT, 9.3)
    c.drawString(M + 22, y - 96,
                 "PDF in Mail oder Dateien öffnen → Markierungs-Symbol (Stift) → „+“ → „Unterschrift“ →")
    c.drawString(M + 22, y - 109,
                 "mit dem Finger malen → an die richtige Stelle ziehen → fertig.")

    c.setFont(BOLD, 9.5)
    c.drawString(M + 12, y - 124, "Android: gratis-App „Adobe Acrobat Reader“ → gleiche Schritte wie am PC.")

    # Pflicht-Bestätigung mit echtem AcroForm-Checkbox
    y = H - 320
    c.setFillColor(INK)
    c.setFont(BOLD, 10.5)
    c.drawString(M, y, "Pflicht-Bestätigung (bitte anklicken)")
    form.checkbox(
        name=f"{p}_verstanden", x=M, y=y - 36, size=16,
        borderColor=SAGE_DARK, fillColor=white, textColor=INK,
        buttonStyle="check", borderStyle="solid", borderWidth=1,
        forceBorder=True,
    )
    wrap(c, cfg["checkbox"], M + 26, y - 25, W - 2 * M - 26, size=9.5, leading=12)

    # Ort / Datum / Name – AcroForm-Textfelder
    y = H - 410
    c.setFillColor(INK)
    c.setFont(BOLD, 9)
    c.drawString(M, y, "Ort")
    c.drawString(M + 200, y, "Datum")
    c.drawString(M + 340, y, "Name in Druckbuchstaben")
    form.textfield(name=f"{p}_ort", x=M, y=y - 28, width=180, height=22,
                   borderColor=BORDER, fillColor=white, textColor=INK,
                   borderWidth=0.8, fontSize=11, fieldFlags="")
    form.textfield(name=f"{p}_datum", x=M + 200, y=y - 28, width=120, height=22,
                   borderColor=BORDER, fillColor=white, textColor=INK,
                   borderWidth=0.8, fontSize=11, fieldFlags="",
                   tooltip="z. B. 23.06.2026")
    form.textfield(name=f"{p}_name", x=M + 340, y=y - 28, width=W - M - (M + 340),
                   height=22, borderColor=BORDER, fillColor=white, textColor=INK,
                   borderWidth=0.8, fontSize=11, fieldFlags="")

    # Unterschriftsbereich – großes Rechteck als visuelles Ziel für „Fill & Sign“
    y = H - 480
    c.setFillColor(INK)
    c.setFont(BOLD, 11)
    c.drawString(M, y, "Unterschrift Patient/in bzw. Sorgeberechtigte/r")
    c.setStrokeColor(SAGE_DARK)
    c.setLineWidth(1.3)
    c.setFillColor(white)
    c.roundRect(M, y - 110, W - 2 * M, 95, 6, fill=1, stroke=1)
    c.setFillColor(MUTED)
    c.setFont(ITALIC, 10)
    c.drawString(M + 14, y - 30, "Hier Signatur platzieren (Acrobat „Ausfüllen und Unterschreiben“ /")
    c.drawString(M + 14, y - 45, "iPhone Markup) – oder ausgedruckt handschriftlich unterschreiben.")

    # Minderjährige
    y = H - 640
    c.setFillColor(INK)
    c.setFont(BOLD, 9.5)
    c.drawString(M, y, "Nur bei Minderjährigen – Sorgeberechtigte/r")
    c.setFont(FONT, 8.5)
    c.drawString(M, y - 16, "Name Sorgeberechtigte/r")
    form.textfield(name=f"{p}_guardian_name", x=M, y=y - 44, width=270, height=20,
                   borderColor=BORDER, fillColor=white, textColor=INK, borderWidth=0.8, fontSize=10)
    c.setFillColor(INK)
    c.drawString(M + 290, y - 16, "Unterschrift Sorgeberechtigte/r")
    c.setStrokeColor(BORDER)
    c.setFillColor(white)
    c.roundRect(M + 290, y - 68, W - M - (M + 290), 50, 5, fill=1, stroke=1)

    # Footer
    c.setFillColor(MUTED)
    c.setFont(FONT, 7.5)
    c.drawRightString(W - M, 22, "Bestätigung & Unterschrift · interaktiv ausfüllbar")

    c.save()
    packet.seek(0)
    return PdfReader(packet)


def refresh_pdf(cfg: dict) -> None:
    path: Path = cfg["path"]
    if not path.exists():
        print(f"SKIP (missing): {path}")
        return
    reader = PdfReader(str(path))
    writer = PdfWriter()
    pages = list(reader.pages)
    last_text = pages[-1].extract_text() or ""
    if "Bestätigung & Unterschrift" in last_text:
        pages = pages[:-1]
    for page in pages:
        writer.add_page(page)
    sig = create_signature_page(cfg)
    writer.append(sig)
    with path.open("wb") as fh:
        writer.write(fh)
    print(f"{path}: {len(reader.pages)} -> {len(writer.pages)} Seiten")


for doc in DOCS:
    refresh_pdf(doc)
