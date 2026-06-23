from __future__ import annotations

from io import BytesIO
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from pypdf.generic import NameObject
from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import A4
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


DOCS = [
    {
        "path": Path("public/anamnesebogen-blanko.pdf"),
        "title": "Bestätigung & Unterschrift – Anamnesebogen",
        "document": "den Anamnesebogen",
        "legal": "§ 630e BGB und Art. 7 DSGVO",
        "checkbox": "Ich bestätige: Ich habe den Anamnesebogen vollständig gelesen, verstanden und nach bestem Wissen wahrheitsgemäß ausgefüllt.",
        "field_prefix": "clear_anamnese",
    },
    {
        "path": Path("public/datenschutz-einwilligung-blanko.pdf"),
        "title": "Bestätigung & Unterschrift – Datenschutz-Einwilligung",
        "document": "die Datenschutz-Einwilligung",
        "legal": "Art. 7 DSGVO",
        "checkbox": "Ich bestätige: Ich habe die Datenschutzinformationen und Einwilligung gelesen, verstanden und willige entsprechend ein.",
        "field_prefix": "clear_datenschutz",
    },
    {
        "path": Path("public/patientenvertrag-blanko.pdf"),
        "title": "Bestätigung & Unterschrift – Behandlungsvertrag",
        "document": "den Behandlungsvertrag",
        "legal": "§ 630a BGB / Behandlungsvertrag",
        "checkbox": "Ich bestätige: Ich habe den Behandlungsvertrag gelesen, verstanden und bin mit den Inhalten einverstanden.",
        "field_prefix": "clear_vertrag",
    },
]


def wrap(c: canvas.Canvas, text: str, x: float, y: float, width: float, size=10, leading=13, font="Helvetica") -> float:
    c.setFont(font, size)
    words = text.split()
    line = ""
    for word in words:
        candidate = f"{line} {word}".strip()
        if c.stringWidth(candidate, font, size) <= width:
            line = candidate
        else:
            c.drawString(x, y, line)
            y -= leading
            line = word
    if line:
        c.drawString(x, y, line)
        y -= leading
    return y


def create_signature_page(config: dict) -> PdfReader:
    packet = BytesIO()
    c = canvas.Canvas(packet, pagesize=A4)
    prefix = config["field_prefix"]

    c.setFillColor(SAGE)
    c.rect(0, H - 64, W, 64, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 15)
    c.drawString(M, H - 29, config["title"])
    c.setFont("Helvetica", 8.5)
    c.drawString(M, H - 47, "Naturheilpraxis Peter Rauch · bitte zusammen mit dem ausgefüllten Dokument zurückgeben")

    y = H - 92
    c.setFillColor(SAND)
    c.roundRect(M, y - 74, W - 2 * M, 74, 5, fill=1, stroke=0)
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 10.5)
    c.drawString(M + 12, y - 18, "Wir bitten um Verständnis für diesen letzten Schritt")
    c.setFont("Helvetica", 9.3)
    y = wrap(
        c,
        f"Damit die Unterlagen rechtlich sauber und für die Behandlung verwendbar sind, müssen Sie bestätigen, dass Sie {config['document']} nicht nur gelesen, sondern auch verstanden haben ({config['legal']}). Bitte setzen Sie das Häkchen und unterschreiben Sie unten.",
        M + 12,
        y - 35,
        W - 2 * M - 24,
        size=9.3,
        leading=12,
    )

    y = H - 195
    c.setFillColor(SAGE_LIGHT)
    c.roundRect(M, y - 96, W - 2 * M, 96, 5, fill=1, stroke=0)
    c.setFillColor(SAGE_DARK)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(M + 12, y - 18, "Einfachste Variante – bitte so machen")
    c.setFillColor(INK)
    steps = [
        "1. PDF vollständig ausfüllen.",
        "2. PDF ausdrucken.",
        "3. Unten mit Kugelschreiber unterschreiben.",
        "4. Zum Termin mitbringen oder unterschriebene Seiten einscannen/fotografieren und zurücksenden.",
    ]
    c.setFont("Helvetica", 10)
    for i, step in enumerate(steps):
        c.drawString(M + 18, y - 41 - i * 15, step)

    y = H - 318
    c.setFillColor(TERRACOTTA)
    c.roundRect(M, y - 50, W - 2 * M, 50, 5, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(M + 12, y - 17, "Digitale Unterschrift ist nur optional")
    c.setFont("Helvetica", 8.8)
    wrap(
        c,
        "Wenn Sie Adobe Reader sicher beherrschen: Werkzeug 'Ausfüllen und unterschreiben' öffnen, 'Unterschrift hinzufügen' wählen und die Signatur unten in das große Feld setzen. Wenn das unklar ist: einfach ausdrucken und handschriftlich unterschreiben.",
        M + 12,
        y - 32,
        W - 2 * M - 24,
        size=8.8,
        leading=11,
    )

    y = H - 405
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(M, y, "Pflicht-Bestätigung")
    c.acroForm.checkbox(
        name=f"{prefix}_verstanden",
        x=M,
        y=y - 35,
        size=16,
        borderColor=BORDER,
        fillColor=white,
        textColor=INK,
        buttonStyle="check",
    )
    c.setFillColor(INK)
    wrap(c, config["checkbox"], M + 24, y - 25, W - 2 * M - 24, size=9.4, leading=12)

    y = H - 480
    c.setFont("Helvetica-Bold", 8.5)
    c.drawString(M, y, "Ort")
    c.drawString(M + 180, y, "Datum")
    c.drawString(M + 310, y, "Name in Druckbuchstaben")
    c.acroForm.textfield(name=f"{prefix}_ort", x=M, y=y - 25, width=160, height=18, borderColor=BORDER, fillColor=white, textColor=INK, fontSize=9)
    c.acroForm.textfield(name=f"{prefix}_datum", x=M + 180, y=y - 25, width=110, height=18, borderColor=BORDER, fillColor=white, textColor=INK, fontSize=9)
    c.acroForm.textfield(name=f"{prefix}_name", x=M + 310, y=y - 25, width=W - M - (M + 310), height=18, borderColor=BORDER, fillColor=white, textColor=INK, fontSize=9)

    y = H - 550
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(M, y, "Unterschrift Patient/in bzw. Sorgeberechtigte/r")
    c.setStrokeColor(SAGE_DARK)
    c.setLineWidth(1.2)
    c.roundRect(M, y - 108, W - 2 * M, 92, 6, fill=0, stroke=1)
    c.setFillColor(MUTED)
    c.setFont("Helvetica-Oblique", 10.5)
    c.drawString(M + 14, y - 88, "Hier bitte handschriftlich unterschreiben – oder digitale Signatur genau hier platzieren")

    y = H - 705
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(M, y, "Nur bei Minderjährigen")
    c.setFont("Helvetica", 8.5)
    c.drawString(M, y - 16, "Name Sorgeberechtigte/r")
    c.drawString(M + 280, y - 16, "Optional zweite Unterschrift / weiterer Sorgeberechtigter")
    c.acroForm.textfield(name=f"{prefix}_sorgeberechtigt", x=M, y=y - 42, width=250, height=18, borderColor=BORDER, fillColor=white, textColor=INK, fontSize=9)
    c.roundRect(M + 280, y - 70, W - M - (M + 280), 46, 5, fill=0, stroke=1)

    c.setFillColor(MUTED)
    c.setFont("Helvetica", 7.5)
    c.drawRightString(W - M, 24, "Bestätigung & Unterschrift")
    c.save()
    packet.seek(0)
    return PdfReader(packet)


def refresh_pdf(config: dict) -> None:
    reader = PdfReader(str(config["path"]))
    writer = PdfWriter()
    pages = list(reader.pages)
    last_text = pages[-1].extract_text() or ""
    if "Bestätigung & Unterschrift" in last_text and "Wir bitten um Verständnis" in last_text:
        pages = pages[:-1]
    for page in pages:
        writer.add_page(page)
    sig_reader = create_signature_page(config)
    writer.add_page(sig_reader.pages[0])
    if "/AcroForm" in reader.trailer["/Root"]:
        writer._root_object.update({NameObject("/AcroForm"): reader.trailer["/Root"]["/AcroForm"]})
    with config["path"].open("wb") as handle:
        writer.write(handle)
    print(f"{config['path']}: {len(reader.pages)} -> {len(writer.pages)} Seiten")


for doc in DOCS:
    refresh_pdf(doc)