"""
Erzeugt den vollständigen ausfüllbaren Blanko-Anamnesebogen als AcroForm-PDF.
Quelle ist die aktuelle Online-Struktur: XXV Sektionen inkl. IAA und Unterschrift.
Patienten können das PDF in Adobe Reader / Fill & Sign oder kompatiblen PDF-Apps ausfüllen,
speichern, digital unterschreiben oder alternativ ausdrucken und handschriftlich unterschreiben.
"""
from __future__ import annotations

import re
import textwrap
from pathlib import Path
from typing import Iterable

from reportlab.lib.colors import HexColor, black, white
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from pypdf import PdfReader

OUT = Path("public/anamnesebogen-blanko.pdf")
IAA_SOURCE = Path("src/lib/iaaQuestions.ts")
W, H = A4
M = 36

SAGE = HexColor("#5b8a72")
SAGE_DARK = HexColor("#3f6652")
SAGE_LIGHT = HexColor("#e8f0ea")
SAND = HexColor("#f5efe6")
TERRACOTTA = HexColor("#b96b4f")
INK = HexColor("#222222")
MUTED = HexColor("#666666")
BORDER = HexColor("#8a8a8a")
PALE = HexColor("#faf8f4")

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


def sanitize_name(value: str) -> str:
    value = re.sub(r"[^A-Za-z0-9_äöüÄÖÜß.-]+", "_", value.strip())
    return value[:90]


def parse_iaa_categories() -> list[dict]:
    """Liest die IAA-Fragen direkt aus src/lib/iaaQuestions.ts."""
    if not IAA_SOURCE.exists():
        return []
    txt = IAA_SOURCE.read_text(encoding="utf-8")
    txt = txt.split("// Therapist-only section", 1)[0]
    cats: list[dict] = []
    cat_re = re.compile(
        r"\{\s*id:\s*\"([^\"]+)\",\s*titleDe:\s*\"([^\"]+)\",\s*titleEn:\s*\"[^\"]+\",\s*questions:\s*\[(.*?)\]\s*,\s*\}",
        re.S,
    )
    q_re = re.compile(r"\{\s*id:\s*\"([^\"]+)\",\s*textDe:\s*\"((?:\\\"|[^\"])*)\"", re.S)
    for cid, title, body in cat_re.findall(txt):
        questions = []
        for qid, qtext in q_re.findall(body):
            questions.append({"id": qid, "text": qtext.replace('\\"', '"')})
        if questions:
            cats.append({"id": cid, "title": title, "questions": questions})
    return cats


class PdfForm:
    def __init__(self, path: Path):
        path.parent.mkdir(parents=True, exist_ok=True)
        self.path = path
        self.c = canvas.Canvas(str(path), pagesize=A4)
        self.c.setTitle("Anamnesebogen – Naturheilpraxis Peter Rauch")
        self.c.setAuthor("Naturheilpraxis Peter Rauch")
        self.c.setSubject("Vollständiger ausfüllbarer Anamnesebogen als AcroForm-PDF")
        self.page = 1
        self.y = H - M
        self.field_count = 0
        self._header(first=True)

    def _header(self, first: bool = False):
        self.c.setFillColor(SAGE)
        self.c.rect(0, H - 58, W, 58, fill=1, stroke=0)
        self.c.setFillColor(white)
        self.c.setFont(BOLD, 13)
        self.c.drawString(M, H - 25, "Naturheilpraxis Peter Rauch")
        self.c.setFont(FONT, 8.5)
        self.c.drawString(M, H - 41, "Friedrich-Deffner-Straße 19a · 86163 Augsburg · Tel. 0821-2621462 · praxis_rauch@icloud.com")
        self.c.setFont(BOLD, 10.5)
        self.c.drawRightString(W - M, H - 25, "ANAMNESEBOGEN")
        self.c.setFont(FONT, 8)
        self.c.drawRightString(W - M, H - 41, "vollständig · ausfüllbares PDF")
        self.y = H - 76

    def _footer(self):
        self.c.setStrokeColor(SAGE)
        self.c.setLineWidth(0.45)
        self.c.line(M, 31, W - M, 31)
        self.c.setFillColor(MUTED)
        self.c.setFont(FONT, 7.5)
        self.c.drawString(M, 19, "Heilpraktiker Peter Rauch · Naturheilpraxis Augsburg")
        self.c.drawRightString(W - M, 19, f"Seite {self.page}")

    def new_page(self):
        self._footer()
        self.c.showPage()
        self.page += 1
        self._header()

    def ensure(self, height: float):
        if self.y - height < M + 34:
            self.new_page()

    def wrap(self, text: str, width: float, font=FONT, size=8.5) -> list[str]:
        words = text.replace("\n", " ").split()
        lines: list[str] = []
        current = ""
        for word in words:
            candidate = f"{current} {word}".strip()
            if stringWidth(candidate, font, size) <= width:
                current = candidate
            else:
                if current:
                    lines.append(current)
                current = word
        if current:
            lines.append(current)
        return lines or [""]

    def draw_wrapped(self, text: str, x: float, y: float, width: float, font=FONT, size=8.5, leading=10, color=INK) -> float:
        self.c.setFillColor(color)
        self.c.setFont(font, size)
        lines = self.wrap(text, width, font, size)
        for i, line in enumerate(lines):
            self.c.drawString(x, y - i * leading, line)
        return len(lines) * leading

    def h1(self, title: str):
        # Jede neue Sektion beginnt grundsätzlich auf einer neuen Seite,
        # ausgenommen die allererste Sektion direkt nach dem Header.
        if self.y < H - 80:
            self.new_page()
        self.c.setFillColor(SAGE_LIGHT)
        self.c.rect(M, self.y - 22, W - 2 * M, 22, fill=1, stroke=0)
        self.c.setFillColor(SAGE_DARK)
        self.c.setFont(BOLD, 10.5)
        self.c.drawString(M + 7, self.y - 15, title)
        self.y -= 30

    def h2(self, title: str):
        self.ensure(20)
        self.c.setFillColor(TERRACOTTA)
        self.c.setFont(BOLD, 9)
        self.c.drawString(M, self.y - 10, title)
        self.y -= 15

    def note(self, text: str, lines: int | None = None):
        font_size = 7.8
        wrapped = self.wrap(text, W - 2 * M, ITALIC, font_size)
        if lines:
            wrapped = wrapped[:lines]
        self.ensure(len(wrapped) * 9 + 4)
        self.c.setFillColor(MUTED)
        self.c.setFont(ITALIC, font_size)
        for line in wrapped:
            self.c.drawString(M, self.y - 8, line)
            self.y -= 9
        self.y -= 2

    def spacer(self, h=6):
        self.y -= h

    def field_name(self, prefix: str, name: str) -> str:
        self.field_count += 1
        return sanitize_name(f"{prefix}_{name}")

    def text_field(self, name: str, x: float, y: float, width: float, height: float = 13, multiline: bool = False, font_size: float = 8):
        kwargs = dict(
            name=name,
            tooltip=name,
            x=x,
            y=y,
            width=width,
            height=height,
            borderWidth=0.45,
            borderColor=BORDER,
            fillColor=white,
            textColor=black,
            fontSize=font_size,
            maxlen=0,
        )
        if multiline:
            kwargs["fieldFlags"] = "multiline"
        self.c.acroForm.textfield(**kwargs)

    def checkbox_field(self, name: str, x: float, y: float, size: float = 9):
        self.c.acroForm.checkbox(
            name=name,
            tooltip=name,
            x=x,
            y=y,
            size=size,
            borderWidth=0.45,
            borderColor=BORDER,
            fillColor=white,
            buttonStyle="check",
        )

    def text_row(self, prefix: str, fields: list[tuple[str, str, float]], label_height=10):
        self.ensure(31)
        x = M
        self.c.setFillColor(INK)
        self.c.setFont(FONT, 8)
        for label, _, width in fields:
            self.c.drawString(x, self.y - 8, label)
            x += width + 8
        self.y -= label_height
        x = M
        for label, key, width in fields:
            self.text_field(self.field_name(prefix, key), x, self.y - 13, width, 13)
            x += width + 8
        self.y -= 18

    def long_text(self, prefix: str, label: str, key: str, lines: int = 10):
        # Multiline AcroForm-Felder erlauben beliebig viel Text (scrollbar).
        # Wir vergrößern die sichtbare Fläche deutlich, damit Patienten ausführlich schreiben können.
        h = lines * 13
        self.ensure(h + 24)
        self.draw_wrapped(label, M, self.y - 8, W - 2 * M, size=8.4, leading=9)
        self.y -= 14
        self.text_field(self.field_name(prefix, key), M, self.y - h, W - 2 * M, h, multiline=True, font_size=7)
        self.y -= h + 8

    def checkboxes(self, prefix: str, title: str, options: list[str], cols: int = 3):
        if title:
            self.h2(title)
        # Titel wird Teil des Feldnamens, damit unterschiedliche Skalen mit gleichen
        # Optionen (z.B. Durst vs. Appetit) keine kollidierenden Feldnamen erzeugen.
        scoped_prefix = sanitize_name(f"{prefix}_{title}") if title else prefix
        col_w = (W - 2 * M) / cols
        row_h = 17
        rows = (len(options) + cols - 1) // cols
        self.ensure(rows * row_h + 8)
        for i, label in enumerate(options):
            row, col = divmod(i, cols)
            x = M + col * col_w
            row_top = self.y - row * row_h
            cb_y = row_top - 12
            label_baseline = row_top - 10
            self.checkbox_field(self.field_name(scoped_prefix, label), x, cb_y, 9)
            self.c.setFillColor(INK)
            self.c.setFont(FONT, 8)
            self.draw_wrapped(label, x + 14, label_baseline, col_w - 16, size=8, leading=9)
        self.y -= rows * row_h + 8

    def _parse_variants(self, label: str) -> tuple[str, list[str]]:
        """Splittet 'Hauptbegriff inkl./: A, B, C' oder 'Begriff a/b/c' in (Haupt, [Varianten])."""
        m = re.match(r"^(.+?)\s+inkl\.\s+(.+)$", label)
        if m:
            return m.group(1).strip(), [v.strip() for v in re.split(r"[,;]", m.group(2)) if v.strip()]
        m = re.match(r"^(.+?):\s+(.+)$", label)
        if m and ("," in m.group(2) or "/" in m.group(2)):
            rhs = m.group(2)
            parts = [v.strip() for v in re.split(r"[,/;]", rhs) if v.strip()]
            if len(parts) >= 2:
                return m.group(1).strip(), parts
        # Slash-Muster: "X a/b/c" (kompakt, ohne Spaces)
        m = re.match(r"^(.+?)\s+([A-Za-zÄÖÜäöüß0-9.\-]+(?:/[A-Za-zÄÖÜäöüß0-9.\-]+){1,})$", label)
        if m:
            parts = [p.strip() for p in m.group(2).split("/") if p.strip()]
            return m.group(1).strip(), parts
        # Slash mit Spaces: "Sinusitis / Nebenhöhlenentzündung" — splitten,
        # NIE splitten wenn Klammern im Label vorkommen (sonst zerreißt
        # "Nebenhöhlen (chronische Reizung / Herd)" oder "(EBV / Pfeiffersches…)"),
        # und ebenfalls nicht bei Platzhalterwörtern.
        PLACEHOLDER = {"stadium", "rasse", "kontakt", "anzahl", "datum", "grund",
                       "dosis", "lokalisation", "farbe", "typ", "art", "symptome",
                       "menge", "dauer", "psa", "bemerkung", "frequenz"}
        if " / " in label and "(" not in label and ")" not in label:
            parts = [p.strip() for p in label.split(" / ") if p.strip()]
            if len(parts) >= 2 and not any(
                any(w.lower() in PLACEHOLDER for w in re.split(r"\s+", p)) for p in parts
            ):
                return parts[0], parts
        return label, []

    def condition_table(self, prefix: str, rows: Iterable[tuple[str, str]], with_since=True, with_details=True):
        rows = list(rows)
        header_h = 15
        self.ensure(header_h + 5)
        label_w = 245 if with_details else 330
        since_w = 72 if with_since else 0
        detail_w = (W - 2 * M) - label_w - 31 - since_w - (9 if with_since else 0)
        self.c.setFillColor(PALE)
        self.c.rect(M, self.y - header_h, W - 2 * M, header_h, fill=1, stroke=0)
        self.c.setFillColor(MUTED)
        self.c.setFont(BOLD, 7.5)
        self.c.drawString(M + 3, self.y - 10, "Beschwerde / Erkrankung")
        self.c.drawString(M + label_w + 5, self.y - 10, "Ja")
        if with_since:
            self.c.drawString(M + label_w + 31, self.y - 10, "Jahr/seit")
        if with_details:
            self.c.drawString(M + label_w + 31 + since_w + 9, self.y - 10, "Details / Bemerkung")
        self.y -= header_h + 2

        def draw_row(row_key: str, row_label: str, indent: float = 0.0):
            label_lines = self.wrap(row_label, label_w - 5 - indent, size=7.6)
            rh = max(16, len(label_lines) * 8 + 5)
            self.ensure(rh + 2)
            y_top = self.y
            self.c.setStrokeColor(HexColor("#dddddd"))
            self.c.setLineWidth(0.25)
            self.c.line(M, y_top - rh, W - M, y_top - rh)
            self.draw_wrapped(row_label, M + 3 + indent, y_top - 10, label_w - 5 - indent, size=7.6, leading=8)
            self.checkbox_field(self.field_name(prefix, f"{row_key}_ja"), M + label_w + 7, y_top - 12, 9)
            next_x = M + label_w + 31
            if with_since:
                self.text_field(self.field_name(prefix, f"{row_key}_seit"), next_x, y_top - 13, since_w, 12, font_size=7.5)
                next_x += since_w + 9
            if with_details:
                self.text_field(self.field_name(prefix, f"{row_key}_details"), next_x, y_top - 13, detail_w, 12, font_size=7.5)
            self.y -= rh

        for key, label in rows:
            main_label, variants = self._parse_variants(label)
            if variants:
                # Sub-Header + alle Varianten zusammen: kein neues Symptom am Seitenende
                needed = 14 + len(variants) * 18
                if self.y - needed < M + 34:
                    self.new_page()
                self.c.setFillColor(SAGE_DARK)
                self.c.setFont(BOLD, 7.8)
                self.c.drawString(M + 3, self.y - 9, main_label)
                self.y -= 12
                for v in variants:
                    draw_row(f"{key}_{sanitize_name(v)}", v, indent=10)
            else:
                draw_row(key, main_label)
        self.y -= 6

    def iaa_table(self, prefix: str, rows: list[tuple[str, str]]):
        """IAA-Tabelle: pro Frage 6 Intensitäts-Checkboxen (1=sehr leicht … 6=sehr stark) + Bemerkungsfeld."""
        rows = list(rows)
        header_h = 16
        # Spalten-Layout
        scale_total_w = 6 * 12 + 5 * 2  # 6 Boxen à 12px + Lücken
        bem_w = 150
        label_w = (W - 2 * M) - scale_total_w - bem_w - 14
        scale_x0 = M + label_w + 6
        bem_x = scale_x0 + scale_total_w + 8

        self.ensure(header_h + 5)
        self.c.setFillColor(PALE)
        self.c.rect(M, self.y - header_h, W - 2 * M, header_h, fill=1, stroke=0)
        self.c.setFillColor(MUTED)
        self.c.setFont(BOLD, 7.3)
        self.c.drawString(M + 3, self.y - 10, "Symptom / Frage")
        # Skalenbeschriftung
        self.c.setFont(FONT, 6.5)
        self.c.drawString(scale_x0 - 2, self.y - 5, "1 sehr leicht")
        self.c.drawRightString(scale_x0 + scale_total_w + 2, self.y - 5, "6 sehr stark")
        self.c.setFont(BOLD, 7.3)
        for i in range(6):
            self.c.drawString(scale_x0 + i * 14 + 3, self.y - 13, str(i + 1))
        self.c.drawString(bem_x, self.y - 10, "Bemerkung / Auslöser")
        self.y -= header_h + 2

        for key, label in rows:
            label_lines = self.wrap(label, label_w - 5, size=7.5)
            rh = max(16, len(label_lines) * 8 + 5)
            # Kein Orphan: prüfen ob die Zeile noch passt
            if self.y - rh < M + 34:
                self.new_page()
            y_top = self.y
            self.c.setStrokeColor(HexColor("#dddddd"))
            self.c.setLineWidth(0.25)
            self.c.line(M, y_top - rh, W - M, y_top - rh)
            self.draw_wrapped(label, M + 3, y_top - 10, label_w - 5, size=7.5, leading=8)
            cb_y = y_top - 13
            for i in range(6):
                self.checkbox_field(self.field_name(prefix, f"{key}_lvl{i+1}"), scale_x0 + i * 14, cb_y, 9)
            self.text_field(self.field_name(prefix, f"{key}_bem"), bem_x, y_top - 13, bem_w, 12, font_size=7.3)
            self.y -= rh
        self.y -= 6

    def mini_table(self, prefix: str, title: str, columns: list[tuple[str, float]], rows: int):
        self.h2(title)
        total = sum(w for _, w in columns)
        scale = (W - 2 * M) / total
        cols = [(label, w * scale) for label, w in columns]
        self.ensure(18 + rows * 18)
        x = M
        self.c.setFillColor(PALE)
        self.c.rect(M, self.y - 14, W - 2 * M, 14, fill=1, stroke=0)
        self.c.setFillColor(MUTED)
        self.c.setFont(BOLD, 7.2)
        for label, w in cols:
            self.c.drawString(x + 2, self.y - 9, label[:40])
            x += w
        self.y -= 17
        for r in range(rows):
            self.ensure(18)
            x = M
            for label, w in cols:
                self.text_field(self.field_name(prefix, f"{r+1}_{label}"), x, self.y - 12, w - 3, 12, font_size=7.2)
                x += w
            self.y -= 17
        self.y -= 5

    def signature_box(self, prefix: str, title: str, height: float = 48):
        self.ensure(height + 28)
        self.c.setFillColor(INK)
        self.c.setFont(BOLD, 8.5)
        self.c.drawString(M, self.y - 8, title)
        self.y -= 14
        self.c.setStrokeColor(BORDER)
        self.c.setLineWidth(0.7)
        self.c.rect(M, self.y - height, W - 2 * M, height, fill=0, stroke=1)
        self.c.setFillColor(MUTED)
        self.c.setFont(ITALIC, 7.5)
        self.c.drawString(M + 6, self.y - height + 6, "Signatur hier in Adobe Reader / Fill & Sign platzieren oder nach Ausdruck handschriftlich unterschreiben")
        self.y -= height + 10

    def tooth_chart(self):
        """FDI-Zahnschema als visuelles Raster mit Zahnnummern und Ankreuz-Feldern."""
        upper_right = ["18","17","16","15","14","13","12","11"]
        upper_left  = ["21","22","23","24","25","26","27","28"]
        lower_right = ["48","47","46","45","44","43","42","41"]
        lower_left  = ["31","32","33","34","35","36","37","38"]
        cell_w = (W - 2 * M) / 16
        cell_h = 22
        total_h = cell_h * 2 + 14
        self.ensure(total_h + 20)
        top = self.y
        # Beschriftung Quadranten
        self.c.setFillColor(MUTED); self.c.setFont(ITALIC, 7)
        self.c.drawString(M, top - 6, "Patient: rechts")
        self.c.drawRightString(W - M, top - 6, "Patient: links")
        self.y -= 10
        # Oberkiefer
        y_row = self.y
        self.c.setStrokeColor(BORDER); self.c.setLineWidth(0.5)
        for i, t in enumerate(upper_right + upper_left):
            x = M + i * cell_w
            self.c.rect(x, y_row - cell_h, cell_w, cell_h, fill=0, stroke=1)
            self.c.setFillColor(INK); self.c.setFont(BOLD, 7.5)
            self.c.drawCentredString(x + cell_w / 2, y_row - 8, t)
            self.checkbox_field(sanitize_name(f"zahnSchema_{t}_betroffen"), x + cell_w / 2 - 4, y_row - cell_h + 3, 8)
            self.field_count += 1
        self.y = y_row - cell_h
        # Trennlinie Ober-/Unterkiefer
        self.c.setStrokeColor(SAGE); self.c.setLineWidth(0.7)
        self.c.line(M, self.y - 4, W - M, self.y - 4)
        self.c.setFillColor(MUTED); self.c.setFont(ITALIC, 6.5)
        self.c.drawCentredString(W / 2, self.y - 11, "Oberkiefer ↑  /  Unterkiefer ↓  ·  Bitte betroffene Zähne ankreuzen")
        self.y -= 16
        # Unterkiefer
        y_row = self.y
        self.c.setStrokeColor(BORDER); self.c.setLineWidth(0.5)
        for i, t in enumerate(lower_right + lower_left):
            x = M + i * cell_w
            self.c.rect(x, y_row - cell_h, cell_w, cell_h, fill=0, stroke=1)
            self.c.setFillColor(INK); self.c.setFont(BOLD, 7.5)
            self.c.drawCentredString(x + cell_w / 2, y_row - 8, t)
            self.checkbox_field(sanitize_name(f"zahnSchema_{t}_betroffen"), x + cell_w / 2 - 4, y_row - cell_h + 3, 8)
            self.field_count += 1
        self.y = y_row - cell_h - 6

    def save(self):
        self._footer()
        self.c.save()


family_rows = [
    ("hoherBlutdruck", "Hoher Blutdruck"), ("herzinfarkt", "Herzinfarkt"), ("schlaganfall", "Schlaganfall"),
    ("diabetes", "Diabetes"), ("gicht", "Gicht"), ("asthma", "Asthma"),
    ("lungentuberkulose", "Lungentuberkulose"), ("nervenleiden", "Nervenleiden"), ("krebs", "Krebserkrankungen"),
    ("allergien", "Allergien"), ("sucht", "Suchterkrankungen"), ("autoimmun", "Autoimmun-Erkrankungen"),
]

kopf_rows = [
    ("augenerkrankung", "Augenerkrankung inkl. Netzhaut, Katarakt (Grauer Star), Glaukom (Grüner Star), Makuladegeneration, Entzündungen"),
    ("schwerhoerig", "Schwerhörigkeit links/rechts/beidseitig"),
    ("ohrenerkrankung", "Ohrenerkrankung inkl. Tinnitus (Ohrgeräusche), Hörsturz, Mittelohrentzündung, Morbus Menière"),
    ("sinusitis", "Sinusitis (Nebenhöhlenentzündung)"),
    ("mandelentzuendung", "Mandelentzündung (Tonsillitis)"),
    ("kopfschmerzen", "Kopfschmerzen / Migräne / Spannungskopfschmerz / Cluster-Kopfschmerz"),
    ("schwindel", "Schwindel: Lagerungsschwindel, Drehschwindel, Schwankschwindel"),
    ("geruchsminderung", "Geruchsminderung / Geruchsverlust (Anosmie/Hyposmie)"),
    ("geschmacksminderung", "Geschmacksminderung (Hypogeusie)"),
    ("neuralgien", "Neuralgien (Nervenschmerzen): Trigeminus, Glossopharyngeus, Occipitalis, Post-Zoster (nach Gürtelrose)"),
]

sleep_rows = [
    ("schlafstoerung", "Schlafstörung allgemein"), ("einschlafstoerung", "Einschlafstörung"),
    ("durchschlafstoerung", "Durchschlafstörung"), ("fruehAufwachen", "Frühes Aufwachen"),
    ("konzentrationsstoerung", "Konzentrationsstörung"), ("muedigkeit", "Müdigkeit"),
    ("leistungsabfall", "Leistungsabfall"), ("vergesslichkeit", "Vergesslichkeit"),
    ("angstzustaende", "Angstzustände"), ("stress", "Stress beruflich/privat"),
    ("partnerschaftsprobleme", "Partnerschaftsprobleme"), ("sexualprobleme", "Sexualprobleme / Libido / Potenz"),
]

psy_rows = [
    ("depression", "Depression"), ("schizophrenie", "Schizophrenie"), ("psychose", "Psychose"),
    ("zwangsgedanken", "Zwangsgedanken"), ("phobien", "Phobien"), ("epilepsie", "Epilepsie"),
    ("trauma", "Trauma / Psychotherapie"), ("mobbing", "Mobbing beruflich/schulisch/privat"),
]

heart_rows = [
    ("blutdruckWechselhaft", "Blutdruck wechselhaft"), ("blutdruckNiedrig", "Blutdruck niedrig"),
    ("blutdruckHoch", "Blutdruck hoch"), ("herzrhythmusstoerung", "Herzrhythmusstörung / Vorhofflimmern / Extrasystolen"),
    ("herzschrittmacher", "Herzschrittmacher"), ("herzschmerzen", "Herzschmerzen bei Belastung/Ruhe"),
    ("herzinfarkt", "Herzinfarkt"), ("stent", "Stent"), ("herzklappenfehler", "Herzklappenfehler"),
    ("herzklappenersatz", "Herzklappenersatz"), ("krampfadern", "Krampfadern"),
    ("thrombose", "Thrombose / Embolie"), ("oedeme", "Ödeme morgens/abends/ständig"),
]

lung_rows = [
    ("asthma", "Asthma allergisch/nicht-allergisch/Belastungsasthma"), ("lungenentzuendung", "Lungenentzündung"),
    ("rippenfellentzuendung", "Rippenfellentzündung"), ("bronchitis", "Bronchitis akut/chronisch"),
    ("tuberkulose", "Tuberkulose"), ("sarkoidose", "Sarkoidose"), ("husten", "Husten trocken/mit Auswurf"),
    ("auswurf", "Auswurf / Farbe"), ("atemnot", "Atemnot bei Belastung/Ruhe"), ("copd", "COPD"),
    ("lungenembolie", "Lungenembolie"),
]

digestive_rows = [
    ("magengeschwuer", "Magengeschwür"), ("duennDarmgeschwuer", "Dünndarmgeschwür"),
    ("sodbrennen", "Sodbrennen regelmäßig/gelegentlich"), ("magensaeurehemmer", "Magensäurehemmer"),
    ("uebelkeit", "Übelkeit morgens/nach Essen/ständig"), ("erbrechen", "Erbrechen"),
    ("verstopfung", "Verstopfung"), ("durchfall", "Durchfall"), ("blaehungen", "Blähungen"),
    ("bauchschmerzen", "Bauchschmerzen / Lokalisation"), ("zoeliakie", "Zöliakie"),
    ("morbusCrohn", "Morbus Crohn"), ("colitis", "Colitis ulcerosa"), ("reizdarm", "Reizdarm"),
]

liver_rows = [
    ("lebererkrankung", "Lebererkrankung / Hepatitis / Fettleber"), ("leberzirrhose", "Leberzirrhose"),
    ("leberkrebs", "Leberkrebs"), ("gelbsucht", "Gelbsucht"), ("gallensteine", "Gallensteine"),
    ("gallenleiden", "Gallenleiden symptomatisch/asymptomatisch"), ("gallenblasenentfernung", "Gallenblasenentfernung"),
    ("gallengangentzuendung", "Gallengangentzündung"),
]

kidney_rows = [
    ("nierenerkrankung", "Nierenerkrankung / Stadium / Blasenentzündung"), ("blasenleiden", "Blasenleiden"),
    ("nykturie", "Nykturie / Anzahl pro Nacht"), ("miktionsbeschwerden", "Miktionsbeschwerden: Brennen, Schmerz, Drang"),
    ("inkontinenz", "Inkontinenz: Belastung, Drang, Überlauf"), ("haematurie", "Hämaturie"),
    ("nierensteine", "Nierensteine"),
]

hormone_rows = [
    ("schilddruese", "Schilddrüse: Unter-/Überfunktion, Hashimoto, Basedow, Knoten, OP, Radiojod"),
    ("hypophyse", "Hypophyse: Adenom, Prolaktinom, Akromegalie, Insuffizienz"),
    ("nebenniere", "Nebenniere: Insuffizienz, Cushing, Phäochromozytom, Erschöpfung"),
]

msk_rows = [
    ("hws", "HWS: Verspannung, Bandscheibe, Arthrose"), ("bws", "BWS: Verspannung, Bandscheibe, Arthrose"),
    ("lws", "LWS: Verspannung, Bandscheibe, Arthrose"), ("iliosakral", "Iliosakralgelenk"),
    ("schulter", "Schulter rechts/links/beidseitig"), ("ellbogen", "Ellbogen rechts/links/beidseitig"),
    ("handgelenk", "Handgelenk rechts/links/beidseitig"), ("finger", "Finger rechts/links/beidseitig"),
    ("huefte", "Hüfte rechts/links/beidseitig"), ("knie", "Knie rechts/links/beidseitig"),
    ("fuss", "Fuß rechts/links/beidseitig"), ("zehen", "Zehen rechts/links/beidseitig"),
    ("rheuma", "Rheuma / Stadium"),
]

women_rows = [
    ("fruehgeburt", "Frühgeburt / Schwangerschaftswoche"), ("gebaermuttererkrankung", "Gebärmuttererkrankung"),
    ("gebaermutterentfernung", "Gebärmutterentfernung teilweise/vollständig"), ("eierstockentfernung", "Eierstockentfernung ein-/beidseitig"),
    ("gebaermutterausschabung", "Gebärmutterausschabung"), ("eierstockzyste", "Eierstockzyste"),
    ("endometriose", "Endometriose"), ("myome", "Myome"), ("pille", "Pille von/bis"),
    ("hormonbehandlung", "Hormonbehandlung"), ("periodeNormal", "Periode normal / Zyklustage"),
    ("periodeSchwach", "Periode schwach / Blutungstage"), ("periodeStark", "Periode stark"),
    ("periodeUnregelmaessig", "Periode unregelmäßig"), ("periodenbeschwerden", "Periodenbeschwerden"),
    ("menopause", "Menopause / Symptome"), ("schwangerschaften", "Schwangerschaften"),
    ("fehlgeburten", "Fehlgeburten"), ("geburten", "Geburten vaginal/Kaiserschnitt"),
    ("wochenbettdepression", "Wochenbettdepression"),
]

men_rows = [
    ("prostata", "Prostata: BPH (gutartige Prostatavergrößerung), Prostatitis (Prostataentzündung), Karzinom (Prostatakrebs), PSA-Wert erhöht"),
    ("hoden", "Hoden: Entzündung (Orchitis), Torsion (Hodenverdrehung), Krebs (Hodenkrebs), Varikozele (Krampfader am Hoden), Hydrozele (Wasserbruch)"),
    ("nebenhoden", "Nebenhoden: Epididymitis (Nebenhodenentzündung), Zyste (Spermatozele)"),
    ("erektionsstoerung", "Erektionsstörung"),
]

surgery_rows = [
    ("unfall", "Unfall"), ("knochenbruch", "Knochenbruch"), ("kopfverletzung", "Kopfverletzung"),
    ("krankenhausaufenthalt", "Krankenhausaufenthalt"), ("kuraufenthalt", "Kuraufenthalt"),
    ("bluttransfusion", "Bluttransfusion"),
]

# Radiologische / nuklearmedizinische / onkologische Verfahren – eigene Tabelle mit Abstand zum Termin
radio_procedures = [
    ("chemotherapie", "Chemotherapie"),
    ("strahlentherapie", "Strahlentherapie (Radiotherapie)"),
    ("szintigraphie", "Szintigraphie (nuklearmedizinische Bildgebung)"),
    ("petCt", "PET-CT (Positronen-Emissions-Tomographie)"),
    ("radioiodtherapie", "Radioiodtherapie (RIT, Schilddrüse)"),
    ("rontgen", "Röntgen / CT (Computertomographie) gehäuft"),
    ("mrt", "MRT (Magnetresonanztomographie) mit Kontrastmittel"),
]

cancer_rows = [
    ("hatKrebs", "Krebserkrankung bekannt"), ("operationDurchgefuehrt", "Operation durchgeführt"),
    ("chemotherapieErhalten", "Chemotherapie erhalten"), ("strahlentherapieErhalten", "Strahlentherapie erhalten"),
    ("metastasen", "Metastasen"), ("aktuelleTumortherapie", "Aktuelle Tumortherapie"),
]

allergy_rows = [
    ("nahrungsmittel", "Nahrungsmittelallergien"), ("medikamente", "Medikamentenallergien"),
    ("kontakt", "Kontaktallergien: Nickel, Latex, sonstige"), ("laktose", "Laktoseintoleranz"),
    ("gluten", "Gluten / Zöliakie"), ("fruktose", "Fruktose"), ("histamin", "Histamin"),
    ("insektengift", "Insektengift (Bienen, Wespen)"),
]

# Inhalationsallergien werden separat detailliert abgefragt
pollen_rows = [
    ("graeser", "Gräser (Wiesengräser, Roggen, Lieschgras)"),
    ("baeume_frueh", "Bäume früh (Hasel, Erle, Birke)"),
    ("baeume_spaet", "Bäume spät (Eiche, Buche, Esche)"),
    ("kraeuter", "Kräuter (Beifuß, Ambrosia, Wegerich)"),
    ("getreidepollen", "Getreidepollen"),
]
inhalation_other_rows = [
    ("hausstaub", "Hausstaubmilben"),
    ("schimmelpilze", "Schimmelpilze (innen/außen)"),
    ("tier_hund", "Tierhaare Hund"),
    ("tier_katze", "Tierhaare Katze"),
    ("tier_pferd", "Tierhaare Pferd"),
    ("tier_andere", "Tierhaare andere Tiere"),
    ("federn", "Federn / Daunen"),
    ("latex_inhalativ", "Latex inhalativ"),
]

environment_chem = [
    "Diesel-Abgase", "Tabakrauch", "Pestizide", "Benzin", "Farben", "Desinfektionsmittel", "Reiniger",
    "Parfüms", "Teer", "Nagellack", "Haarspray", "Neue Raumausstattung", "Kunststoff", "Neues Auto",
]

environment_body = [
    "Strahlung: Geopathie, Elektrosmog, Hochspannung, Funkmasten, WLAN",
    "Nebenhöhlen (chronische Reizung / Herd)",
    "Tonsillen (chronische Reizung / Herd)",
    "Narben (störende oder verziehende Narben)",
]

# Mangelzustände – separat aufgelistet, weil es keine Belastung, sondern ein Defizit ist
vitamin_rows = [
    ("vitA", "Vitamin A (Retinol)"), ("vitB1", "Vitamin B1 (Thiamin)"),
    ("vitB2", "Vitamin B2 (Riboflavin)"), ("vitB3", "Vitamin B3 (Niacin)"),
    ("vitB5", "Vitamin B5 (Pantothensäure)"), ("vitB6", "Vitamin B6 (Pyridoxin)"),
    ("vitB7", "Vitamin B7 / H (Biotin)"), ("vitB9", "Vitamin B9 (Folsäure)"),
    ("vitB12", "Vitamin B12 (Cobalamin)"), ("vitC", "Vitamin C (Ascorbinsäure)"),
    ("vitD", "Vitamin D (Cholecalciferol)"), ("vitE", "Vitamin E (Tocopherol)"),
    ("vitK", "Vitamin K (Phyllochinon)"),
]
mineral_rows = [
    ("calcium", "Calcium"), ("magnesium", "Magnesium"), ("kalium", "Kalium"),
    ("natrium", "Natrium"), ("phosphor", "Phosphor"), ("eisen", "Eisen (Ferritin)"),
]
trace_rows = [
    ("zink", "Zink"), ("selen", "Selen"), ("jod", "Jod"), ("kupfer", "Kupfer"),
    ("mangan", "Mangan"), ("chrom", "Chrom"), ("molybdaen", "Molybdän"),
    ("silicium", "Silicium"),
]

# Belastungen (Mikroorganismen / Toxisch) – eigene Sektion
load_rows = [
    ("viren", "Viren (z. B. EBV, CMV, HSV, HHV-6, Influenza)"),
    ("bakterien", "Bakterien (z. B. Borrelien, Streptokokken, Helicobacter)"),
    ("pilze", "Pilze (z. B. Candida, Aspergillus, Schimmelpilze)"),
    ("parasiten", "Parasiten (z. B. Würmer, Protozoen)"),
    ("schwermetalle", "Schwermetalle (Quecksilber, Blei, Cadmium, Aluminium, Arsen)"),
    ("chemikalien", "Chemikalien / Lösungsmittel"),
    ("pestizide", "Pestizide / Herbizide"),
    ("erbtoxine", "Erbtoxine / pränatale Belastungen"),
]

infection_rows = [
    ("tropenReise", "Tropenreise / Länder"),
    ("zeckenbiss", "Zeckenbiss / roter Hof (Wanderröte)"),
    ("borreliose", "Borreliose diagnostiziert"),
    ("ebv", "Epstein-Barr-Virus (EBV / Pfeiffersches Drüsenfieber)"),
    ("cmv", "CMV (Cytomegalievirus)"),
    ("herpes", "Herpes simplex / Zoster (Gürtelrose)"),
    ("hepatitis", "Hepatitis A/B/C"),
    ("hiv", "HIV"),
    ("hpv", "HPV"),
    ("tuberkulose", "Tuberkulose"),
    ("covid", "COVID-19 / Long-COVID"),
    ("sonstige", "Sonstige durchgemachte Infektionen"),
]
pet_rows = [
    ("hund", "Hund / Rasse"), ("katze", "Katze / Rasse"),
    ("pferd", "Pferd / Kontakt"), ("andereHaustiere", "Andere Haustiere / Tierkontakt"),
]

vaccine_rows = [
    ("mmr", "MMR (Masern, Mumps, Röteln)"), ("tetanus", "Tetanus"), ("diphtherie", "Diphtherie"),
    ("keuchhusten", "Keuchhusten (Pertussis)"), ("polio", "Polio (Kinderlähmung)"),
    ("hepatitisA", "Hepatitis A"), ("hepatitisB", "Hepatitis B"),
    ("windpocken", "Windpocken (Varizellen)"), ("influenza", "Influenza (Grippe)"),
    ("pneumokokken", "Pneumokokken"), ("fsme", "FSME (Zeckenimpfung)"),
    ("hpv", "HPV"), ("meningokokken", "Meningokokken"), ("rotaviren", "Rotaviren"),
    ("herpesZoster", "Herpes Zoster (Gürtelrose)"),
]

preference_options = [
    "Homöopathie", "Biophysikalisch / Bioresonanz", "Metatron / NLS", "Trikombin", "Zapper", "EAV",
    "Mineral-Testung", "Akupunktur", "Phytotherapie", "Bachblüten", "Sanum", "Hypnotherapie",
]


pdf = PdfForm(OUT)

pdf.h1("Willkommen / Anleitung")
pdf.note("Dies ist der vollständige ausfüllbare PDF-Anamnesebogen als Alternative zum Online-Formular. Er ist für Adobe Reader, Adobe Fill & Sign und kompatible PDF-Apps vorgesehen.")
pdf.note("Bitte speichern Sie das ausgefüllte PDF lokal auf Ihrem Gerät. Die Bearbeitung erfolgt offline – es werden beim Ausfüllen keine Daten an einen Server übertragen.")
pdf.note("Mit Stern (*) markierte Felder sind Pflichtangaben (wie im Online-Bogen). Bei Fragen, die nicht zutreffen, lassen Sie die Felder leer.")
pdf.note("Hinweis: Medizinische Fachbegriffe / lateinische Bezeichnungen werden, wenn möglich, mit deutscher Erklärung in Klammern ergänzt.")
pdf.long_text("intro", "Aktueller Anlass / wichtigste Anliegen in eigenen Worten:", "freitext_anlass", 4)

pdf.h1("I. Patientendaten")
pdf.h2("A. Personalia")
pdf.text_row("patient", [("Nachname *", "nachname", 155), ("Vorname *", "vorname", 155), ("Geburtsdatum *", "geburtsdatum", 100), ("Nationalität", "nationalitaet", 105)])
pdf.text_row("patient", [("Geschlecht", "geschlecht", 120), ("Familienstand", "familienstand", 120), ("Körpergröße (cm)", "koerpergroesse", 105), ("Gewicht (kg)", "gewicht", 105)])
pdf.h2("B. Kontaktdaten")
pdf.text_row("kontakt", [("Straße, Hausnummer *", "strasse", 230), ("PLZ *", "plz", 70), ("Wohnort *", "wohnort", 190)])
pdf.text_row("kontakt", [("Telefon privat", "telefonPrivat", 150), ("Telefon beruflich", "telefonBeruflich", 150), ("Mobil *", "mobil", 150)])
pdf.text_row("kontakt", [("E-Mail *", "email", 250)])
pdf.h2("C. Mitversicherte / Angehörige")
pdf.mini_table("mitversicherte", "Mitversicherte Personen", [("Name", 190), ("Verhältnis", 120), ("Geburtsdatum", 120)], 3)
pdf.h2("D. Versicherung")
pdf.checkboxes("versicherung", "Versicherungstyp", ["privat", "gesetzlich", "Beihilfe", "Zusatzversicherung"], 4)
pdf.text_row("versicherung", [("Versicherungsname", "versicherungsname", 190), ("Versicherungsnummer", "versicherungsnummer", 145), ("Tarif", "tarif", 120)])
pdf.checkboxes("versicherung", "Kostenübernahme Naturheilkunde", ["bekannt ja", "bekannt nein", "bitte selbst klären"], 3)
pdf.h2("E. Berufliche Situation (optional)")
pdf.note("Diese Angaben sind freiwillig und nur relevant, wenn beruflicher Stress / Belastungen Teil des Anliegens sind.")
pdf.text_row("beruf", [("Beruf", "beruf", 150), ("Arbeitgeber", "arbeitgeber", 170), ("Branche", "branche", 130)])
pdf.text_row("beruf", [("Arbeitsunfähig seit", "arbeitsunfaehigSeit", 135), ("Berentet seit", "berentetSeit", 120), ("Unfallrente %", "unfallrenteProzent", 95), ("Schwerbehinderung %", "schwerbehinderungProzent", 115)])
pdf.h2("F. Sorgeberechtigte bei Minderjährigen")
pdf.note("Bei minderjährigen Patient:innen sind die folgenden Angaben Pflicht. Bitte zuerst das Verhältnis ankreuzen.")
pdf.checkboxes("sorge", "Verhältnis zur/zum Patient:in *", ["Mutter", "Vater", "Sorgeberechtigte/r", "Vormund / Pfleger:in", "Sonstige/r"], 5)
pdf.text_row("sorge", [("Vorname *", "vorname", 235), ("Nachname *", "nachname", 235)])
pdf.text_row("sorge", [("Straße, Hausnummer *", "strasse", 235), ("PLZ *", "plz", 70), ("Ort *", "ort", 155)])
pdf.text_row("sorge", [("Telefon *", "telefon", 175), ("Mobil *", "mobil", 175), ("E-Mail *", "email", 175)])
pdf.text_row("sorge", [("Bei abweichender Adresse / Bemerkung", "festnetz", 470)])
pdf.h2("G. Informationsquelle und Vorbehandler")
pdf.checkboxes("infoquelle", "Wie sind Sie auf die Praxis aufmerksam geworden?", ["Empfehlung", "BNI (Business Network)", "Internet", "Google", "Arzt/Heilpraktiker", "Social Media", "Sonstiges"], 3)
pdf.text_row("infoquelle", [("Empfohlen von", "empfehlungVon", 220)])
pdf.text_row("vorbehandler", [("Hausarzt", "hausarzt", 170), ("Fachärzte", "fachaerzte", 170), ("Heilpraktiker", "heilpraktiker", 170)])
pdf.text_row("vorbehandler", [("Physiotherapeut", "physiotherapeut", 170), ("Psychotherapeut", "psychotherapeut", 170), ("Sonstige Therapeuten", "sonstige", 170)])
pdf.mini_table("facharztListe", "Facharztliste", [("Fachrichtung", 170), ("Name / Ort", 250)], 4)

pdf.h1("II. Familie")
pdf.note("Familienanamnese: bitte Ja und betroffene Angehörige ankreuzen; Details ggf. rechts ergänzen.")
pdf.condition_table("familie", family_rows, with_since=False, with_details=True)

pdf.h1("III. Kopf & Sinne")
pdf.h2("Kopf, Augen, Ohren, Nebenhöhlen, Neuralgien")
pdf.condition_table("kopf", kopf_rows)
pdf.long_text("kopf", "Sonstige Bemerkungen zu Kopf & Sinnen:", "sonstige", 6)

pdf.h1("III-b. Schlaf und psychovegetative Symptome")
pdf.condition_table("schlaf", sleep_rows)
pdf.long_text("schlaf", "Sonstige Bemerkungen zu Schlaf / Vegetativum:", "sonstige", 6)

pdf.h1("III-c. Psychische Erkrankungen / Belastungen")
pdf.condition_table("psyche", psy_rows)
pdf.long_text("psyche", "Sonstige psychische Bemerkungen:", "sonstige", 6)

pdf.h1("IV. Herz & Kreislauf")
pdf.condition_table("herz", heart_rows)
pdf.long_text("herz", "Sonstige Herz-/Kreislauf-Bemerkungen:", "sonstige", 6)

pdf.h1("V. Lunge & Atmung")
pdf.condition_table("lunge", lung_rows)
pdf.long_text("lunge", "Sonstige Lungen-/Atemwegs-Bemerkungen:", "sonstige", 6)

pdf.h1("VI. Magen & Darm")
pdf.condition_table("magenDarm", digestive_rows)
pdf.checkboxes("magenDarm", "Durst", ["gar nicht", "wenig", "mittel", "viel", "übermäßig"], 5)
pdf.checkboxes("magenDarm", "Appetit", ["gar nicht", "wenig", "mittel", "viel", "übermäßig"], 5)
pdf.checkboxes("magenDarm", "Ernährungstyp", ["Mischkost", "Vegetarisch", "Vegan", "Pescetarisch", "Low-Carb / Keto", "LOGI", "Paleo", "Rohkost", "Mediterran", "Trennkost", "Intervallfasten", "Sonstiges"], 3)
pdf.long_text("magenDarm", "Sonstige Magen-Darm-Bemerkungen / Ernährungsbesonderheiten:", "sonstige", 6)

pdf.h1("VII. Leber & Galle")
pdf.condition_table("leberGalle", liver_rows)
pdf.long_text("leberGalle", "Sonstige Leber-/Galle-Bemerkungen:", "sonstige", 6)

pdf.h1("VIII. Niere & Blase")
pdf.condition_table("niereBlase", kidney_rows)
pdf.text_row("niereBlase", [("Miktionsfrequenz tagsüber", "miktionsfrequenz", 180)])
pdf.long_text("niereBlase", "Sonstige Niere-/Blase-Bemerkungen:", "sonstige", 6)

pdf.h1("IX. Hormone")
pdf.condition_table("hormone", hormone_rows)
pdf.long_text("hormone", "Sonstige hormonelle Themen:", "sonstige", 6)

pdf.h1("X. Bewegungsapparat")
pdf.condition_table("bewegungsapparat", msk_rows)
pdf.long_text("bewegungsapparat", "Sonstige Beschwerden am Bewegungsapparat:", "sonstige", 6)

pdf.h1("XI. Geschlechtsspezifische Anamnese")
pdf.note("Bitte nur den für Sie zutreffenden Abschnitt ausfüllen.")

pdf.h2("XI-a. Frauengesundheit")
pdf.condition_table("frauen", women_rows)
pdf.long_text("frauen", "Sonstige frauengesundheitliche Angaben:", "sonstige", 6)

pdf.h2("XI-b. Männergesundheit")
pdf.condition_table("maenner", men_rows)
pdf.long_text("maenner", "Sonstige männergesundheitliche Angaben:", "sonstige", 6)

pdf.h1("XII. Unfälle & OPs")
pdf.condition_table("unfaelleOps", surgery_rows)
pdf.mini_table("operationen", "Operationen im Detail", [("Jahr", 70), ("Grund / Art der Operation", 360)], 6)
pdf.h2("Radiologische / nuklearmedizinische / onkologische Verfahren")
pdf.note("Bitte für jedes Verfahren Datum, Grund und ggf. Dosis angeben. Hinweis: Zwischen bestimmten Untersuchungen (z.B. Szintigraphie, Radioiodtherapie, PET-CT) und einem Termin bei uns ist ein zeitlicher Abstand erforderlich – bitte vorab telefonisch klären.")
for key, label in radio_procedures:
    pdf.ensure(34)
    pdf.c.setFillColor(SAGE_DARK); pdf.c.setFont(BOLD, 8)
    pdf.c.drawString(M, pdf.y - 9, label)
    pdf.y -= 13
    pdf.text_row(f"radio_{key}", [("Datum", "datum", 100), ("Grund / Art", "grund", 230), ("Dosis", "dosis", 110)])
pdf.long_text("radio", "Sonstige radiologische / nuklearmedizinische Untersuchungen oder Hinweise:", "sonstige", 5)

pdf.h1("XIII. Krebs")
pdf.note("Nur ausfüllen, wenn relevant. Bei akuter/onkologischer Behandlung bitte Unterlagen mitbringen.")
pdf.condition_table("krebs", cancer_rows)
pdf.text_row("krebs", [("Welche Krebsart", "welche", 180), ("Typ", "welcheTyp", 140), ("Diagnosejahr", "diagnoseJahr", 100)])
pdf.text_row("krebs", [("Betroffene Organe", "betroffeneOrgane", 240), ("TNM T", "tnm_t", 60), ("N", "tnm_n", 60), ("M", "tnm_m", 60)])
pdf.long_text("krebs", "Therapien, Metastasen, aktuelle Tumortherapie, Besonderheiten:", "details", 8)
pdf.spacer(10)
pdf.h2("Zusätzliche Bestätigung Krebserkrankung")
pdf.note("Naturheilkundliche Behandlung ersetzt eine schulmedizinisch-onkologische Therapie nicht – sie erfolgt ausschließlich ergänzend / komplementär. Bitte bestätigen Sie diese Aufklärung gesondert.")
pdf.spacer(4)
# Bestätigung mit großer Checkbox auf eigener Zeile + ausreichend Platz für Text
pdf.ensure(40)
cb_y = pdf.y - 18
pdf.checkbox_field(pdf.field_name("krebs", "bestaetigung_komplementaer"), M, cb_y, 11)
pdf.draw_wrapped(
    "Ich bestätige, dass meine Angaben zur Krebserkrankung nach bestem Wissen korrekt sind, und habe verstanden, "
    "dass die naturheilkundliche Behandlung eine schulmedizinisch-onkologische Therapie nicht ersetzt, sondern "
    "ergänzend / komplementär erfolgt.",
    M + 18, cb_y + 8, W - 2 * M - 18, size=8.4, leading=10,
)
pdf.y -= 38
pdf.text_row("krebsUnterschrift", [("Ort", "ort", 180), ("Datum", "datum", 120), ("Name in Druckbuchstaben", "name", 220)])
pdf.signature_box("krebsUnterschrift", "Zusätzliche Unterschrift Krebserkrankung", height=60)

pdf.h1("XIV. Allergien")
pdf.h2("Inhalationsallergien – Pollen")
pdf.note("Bitte bei zutreffenden Pollengruppen ankreuzen und ggf. die Saison/Region ergänzen.")
pdf.condition_table("allergienPollen", pollen_rows)
pdf.h2("Inhalationsallergien – sonstige")
pdf.condition_table("allergienInhalativ", inhalation_other_rows)
pdf.h2("Weitere Allergien & Unverträglichkeiten")
pdf.condition_table("allergien", allergy_rows)
pdf.long_text("allergien", "Sonstige Allergien / Unverträglichkeiten / Reaktionen (z. B. anaphylaktischer Schock, Quincke-Ödem):", "sonstigeUnvertraeglichkeit", 8)

pdf.h1("XV. Medikamente")
pdf.text_row("medikamente", [("In Behandlung bei", "inAerztlicherBehandlung_beiWem", 220), ("Fachärzte", "fachaerzte", 220)])
pdf.mini_table("aktuelleMedikamente", "Aktuelle Medikamente / Nahrungsergänzung", [("Name", 130), ("Dosierung", 85), ("tägl.", 45), ("pro Woche", 70), ("Grund", 130), ("seit", 70)], 8)
pdf.mini_table("unvertraeglichkeiten", "Medikamenten-Unverträglichkeiten / Allergien", [("Name", 150), ("Allergie ja/nein", 90), ("Unverträglichkeit", 105), ("Reaktion", 180)], 5)

pdf.h1("XVI. Lebensweise")
pdf.text_row("lebensweise", [("Raucher aktiv/ehemals/nein", "raucher", 150), ("seit wann", "raucherSeitWann", 90), ("Zigaretten/Tag", "zigarettenProTag", 95), ("Ex-Raucher bis", "exRaucherBisWann", 100)])
pdf.text_row("lebensweise", [("Passivrauchen", "passivRauchen", 125), ("Alkohol Typ", "alkohol_typ", 120), ("Menge/Tag", "alkohol_menge", 100), ("seit wann", "alkohol_seit", 100)])
pdf.text_row("lebensweise", [("Sport ja/nein", "sport_ja", 95), ("pro Woche", "sport_proWoche", 90), ("Art", "sport_art", 170), ("tägliche Bewegung", "taeglicheBewegung", 140)])
pdf.text_row("lebensweise", [("Spaziergang/Woche", "spaziergang_proWoche", 130), ("Dauer Min.", "spaziergang_dauer", 90), ("Meter zu Fuß/Tag", "meterZuFuss", 130)])
pdf.text_row("lebensweise", [("Schlafqualität", "schlafQualitaet", 130), ("Schlafdauer", "schlafDauer", 100), ("Stress-Level", "stressLevel", 110)])
pdf.long_text("lebensweise", "Ernährungsgewohnheiten / Besonderheiten:", "ernaehrungsgewohnheiten", 6)

pdf.h1("XVII. Zahngesundheit")
pdf.checkboxes("zahn", "Gebisstyp / Prothese", ["vollständig", "Teilprothese", "Vollprothese", "Oberkiefer", "Unterkiefer", "beide Kiefer"], 3)
pdf.text_row("zahn", [("Prothese seit", "protheseSeit", 120), ("Letzter Zahnarztbesuch", "letzterZahnarztbesuch", 160), ("Zahnarzt Name/Ort", "zahnarztName", 220)])
pdf.h2("Zahnschema (FDI-Nummern) – betroffene Zähne ankreuzen")
pdf.note("Zähne sind nach internationalem FDI-System nummeriert. Reihenfolge wie beim Blick in den Mund: Patient rechts ↔ links. Zusätzliche Befunde bitte in der Tabelle unten eintragen.")
pdf.tooth_chart()
pdf.mini_table("zahnbefunde", "Zahnbefunde / Auffälligkeiten – freie Eintragung", [("FDI-Nr.", 60), ("Befund/Diagnose", 220), ("seit", 70), ("Bemerkung", 180)], 8)

pdf.h2("Wurzelbehandlungen")
pdf.note("Wurzelbehandelte (devitale) Zähne können Störherde sein. Bitte FDI-Zahnnummer und Jahr angeben.")
pdf.mini_table("wurzelbehandlung", "Wurzelbehandelte Zähne", [("FDI-Nr.", 60), ("Jahr", 70), ("Beschwerden ja/nein", 110), ("Bemerkung", 290)], 6)

pdf.h2("Implantate")
pdf.note("Pro Implantat bitte Zahnnummer (FDI), Jahr und Material angeben (Titan oder Keramik / Zirkonoxid).")
pdf.mini_table("implantate", "Implantate", [("FDI-Nr.", 60), ("Jahr", 70), ("Material (Titan / Keramik)", 160), ("Bemerkung", 240)], 5)

pdf.h2("Metalle und Werkstoffe im Mund")
pdf.checkboxes("zahnMetalle", "Vorhandene Werkstoffe", [
    "Amalgam-Füllungen",
    "Goldinlays / Gold-Kronen",
    "Titan (Implantat/Schraube)",
    "Keramik / Zirkonoxid",
    "Komposit-Kunststoff",
    "Stahl (Brücken, Klammern)",
    "Palladium / Edelmetall-Legierung",
    "Kobalt-Chrom",
    "Andere Metalle / Legierungen",
], 3)
pdf.text_row("zahnMetalle", [("Amalgam entfernt im Jahr", "amalgamEntferntJahr", 150), ("Beschwerden seit Material-Wechsel?", "beschwerdenWechsel", 280)])

pdf.condition_table("zahn", [("parodontitis", "Parodontitis"), ("zahnfleischbluten", "Zahnfleischbluten"), ("kiefergelenk", "Kiefergelenk: Knacken, Schmerzen, eingeschränkt"), ("bruxismus", "Bruxismus nachts/tagsüber/Schiene"), ("zahnherd", "Bekannte Zahnherde / chronische Entzündungen")])
pdf.long_text("zahn", "Weitere zahnärztliche / kieferbezogene Bemerkungen:", "bemerkungen", 8)

pdf.h1("XVIII. Umwelt & Belastungen")
pdf.h2("Chemosensibilität / Reizstoffe")
pdf.condition_table("umweltChemie", [(sanitize_name(x), x) for x in environment_chem], with_since=False, with_details=True)
pdf.h2("Körperliche Störfelder")
pdf.note("Klassische Störfelder (chronische lokale Reizungen, Narben, Tonsillen, Nebenhöhlen, Strahlung).")
pdf.condition_table("umweltKoerper", [(sanitize_name(x), x) for x in environment_body], with_since=False, with_details=True)

pdf.h2("Mangelzustände – Vitamine")
pdf.note("Bekannte oder vermutete Mängel (z. B. Laborwert, Symptome). Diese gehören zu den Defiziten, nicht zu den Belastungen.")
pdf.condition_table("mangelVitamine", vitamin_rows, with_since=False, with_details=True)
pdf.h2("Mangelzustände – Mineralstoffe")
pdf.condition_table("mangelMineralien", mineral_rows, with_since=False, with_details=True)
pdf.h2("Mangelzustände – Spurenelemente")
pdf.condition_table("mangelSpuren", trace_rows, with_since=False, with_details=True)
pdf.long_text("mangel", "Sonstige Mangelzustände (Enzyme, Aminosäuren, Flüssigkeit, sonstiges) / vorliegende Laborwerte:", "sonstige", 8)

pdf.h2("Belastungen – Mikroorganismen & Toxine")
pdf.note("Belastungen sind keine Mangelzustände. Bitte hier bekannte oder vermutete Belastungen ankreuzen.")
pdf.condition_table("belastungen", load_rows, with_since=False, with_details=True)
pdf.long_text("belastungen", "Sonstige Belastungen / Verdachtsmomente:", "sonstige", 6)

pdf.h1("XIX. Infektionen & Tierkontakt")
pdf.note("Hier geht es um durchgemachte Infektionen und Tierkontakt (Zoonose-Risiko). Impfungen werden in der nächsten Sektion (Impfstatus) erfasst.")
pdf.h2("Reisen, Zecken & durchgemachte Infektionen")
pdf.condition_table("infektionen", infection_rows)
pdf.h2("Haustiere / Tierkontakt")
pdf.condition_table("haustiere", pet_rows, with_since=False, with_details=True)
pdf.long_text("infektionen", "Sonstige Hinweise zu Infektionen / Reisen / Tierkontakt:", "sonstige", 6)

pdf.h1("XX. Impfstatus")
pdf.condition_table("impfungen", vaccine_rows)
pdf.h2("COVID-19")
pdf.checkboxes("covid", "COVID", ["geimpft", "Infektion durchgemacht", "Long-COVID", "Impfreaktionen"], 4)
pdf.mini_table("covidDosen", "COVID-Impfungen", [("Dosis", 70), ("Datum", 105), ("Hersteller", 150), ("Reaktion/Bemerkung", 220)], 4)
pdf.long_text("covid", "COVID-Infektion, Long-COVID, Impfreaktionen:", "details", 6)

pdf.h1("XXI. Beschwerden")
pdf.long_text("beschwerden", "Hauptbeschwerde:", "hauptbeschwerde", 6)
pdf.long_text("beschwerden", "Weitere Beschwerden:", "weitereBeschwerden", 6)
pdf.text_row("beschwerden", [("Beginn der Beschwerden", "beginn", 140), ("Verlauf", "verlauf", 120), ("Schmerzintensität 0–10", "schmerzintensitaet", 130)])
pdf.checkboxes("beschwerden", "Auftreten", ["ständig", "tagsüber", "nachts", "nach Mahlzeiten", "bei Belastung", "in Ruhe", "unregelmäßig"], 3)
pdf.checkboxes("beschwerden", "Art / Qualität", ["Schmerz", "körperliche Störung", "Funktionsstörung", "psychische Belastung", "dumpf", "stechend", "brennend", "ziehend", "krampfartig", "elektrisierend"], 3)
pdf.long_text("beschwerden", "Ausstrahlung:", "ausstrahlung", 4)
pdf.long_text("beschwerden", "Was verschlimmert die Beschwerden?", "verschlimmerung", 4)
pdf.long_text("beschwerden", "Was verbessert die Beschwerden?", "verbesserung", 4)
pdf.long_text("beschwerden", "Bisherige Behandlungen:", "bisherigeBehandlungen", 6)
pdf.long_text("beschwerden", "Ergebnis bisheriger Behandlungen:", "ergebnisBisherigerBehandlungen", 4)

pdf.h1("XXII. Präferenzen")
pdf.note("Bitte jeweils Interesse / bereits Erfahrung ankreuzen oder ergänzen.")
for opt in preference_options:
    key = sanitize_name(opt)
    pdf.ensure(18)
    y = pdf.y - 10
    pdf.draw_wrapped(opt, M, y + 5, 230, size=8.2, leading=9)
    pdf.checkbox_field(pdf.field_name("praeferenz", f"{key}_interesse"), M + 250, y, 9)
    pdf.c.setFillColor(MUTED); pdf.c.setFont(FONT, 7.5); pdf.c.drawString(M + 263, y + 2, "Interesse")
    pdf.checkbox_field(pdf.field_name("praeferenz", f"{key}_erfahren"), M + 330, y, 9)
    pdf.c.drawString(M + 343, y + 2, "Erfahrung")
    pdf.y -= 16
pdf.long_text("praeferenz", "Therapieerwartungen:", "therapieerwartungen", 6)
pdf.long_text("praeferenz", "Gesundheitsziele:", "gesundheitsziele", 6)

pdf.h1("XXIII. Persönliches")
pdf.text_row("soziales", [("Kinder Anzahl", "kinderAnzahl", 90), ("Kinder Alter", "kinderAlter", 160), ("Partnerschaft", "partnerschaft", 160)])
pdf.text_row("soziales", [("Wohnumfeld", "wohnumfeld", 120), ("Wohntyp", "wohntyp", 120), ("Beruflicher Stress", "berufStress", 130), ("Finanzielle Belastung", "finanzBelastung", 140)])
pdf.text_row("soziales", [("Soziales Netzwerk", "sozialesNetzwerk", 150)])
pdf.long_text("soziales", "Hobbys / Ressourcen / persönliche Umstände:", "hobbys", 8)

pdf.h1("XXIV. IAA-Fragebogen (Individuelle Austestung und Analyse)")
pdf.note(
    "Warum noch ein zusätzlicher Symptom-Fragebogen? Der IAA-Fragebogen ergänzt die klassische Anamnese um genau die Informationen, "
    "die für die individuelle Einstellung des Trikombin-Behandlungsgeräts (Bioresonanz/Frequenztherapie) benötigt werden. Die Fragen "
    "wirken teilweise ungewöhnlich oder wiederholen Themen aus der Anamnese – das ist gewollt: Erst aus dem Symptomprofil ergibt sich "
    "das passende Frequenzmuster. Es geht hier nicht um eine medizinische Diagnose."
)
pdf.note(
    "Ausfüllen: Bitte NUR Symptome ankreuzen, die tatsächlich auf Sie zutreffen. Wählen Sie dann die Intensität auf einer Skala von "
    "1 (sehr leicht) bis 6 (sehr stark). Nicht zutreffende Fragen einfach leer lassen. In der Spalte 'Bemerkung / Auslöser' können "
    "Sie optional ergänzen, wann/wodurch das Symptom auftritt. Die Sektion ist freiwillig – je vollständiger sie ausgefüllt ist, "
    "desto präziser kann die Geräteeinstellung erfolgen."
)
iaa_categories = parse_iaa_categories()
for cat in iaa_categories:
    pdf.h2(cat["title"])
    pdf.iaa_table(f"iaa_{cat['id']}", [(q["id"].replace('.', '_'), f"{q['id']}  {q['text']}") for q in cat["questions"]])

pdf.h1("XXV. Unterschrift")
pdf.long_text("abschluss", "Weitere Erkrankungen/Symptome, die bisher nicht abgefragt wurden:", "weitereErkrankungen", 10)
pdf.long_text("abschluss", "Zusätzliche Informationen, die für die Behandlung relevant sein könnten:", "zusaetzlicheInfos", 10)
pdf.note("Datenschutz: Ich erlaube, dass meine Gesundheitsdaten für meine Behandlung gespeichert werden. E-Mail-Kommunikation (Rechnungen, Termine, Fragen, Bewertungsanfrage) ist ok. Ich habe die Datenschutzinformationen gelesen und stimme zu.")
pdf.note("Patientenaufklärung: Ich habe die Patientenaufklärung zu Leistungserstattung, Preisen und Terminregelung gelesen und bin damit einverstanden.")
pdf.checkboxes("abschluss", "Bestätigungen", ["Ich bestätige die Richtigkeit meiner Angaben", "Datenschutz-Einwilligung", "Patientenaufklärung akzeptiert"], 1)
pdf.text_row("unterschrift", [("Ort", "ort", 180), ("Datum", "datum", 120), ("Name in Druckbuchstaben", "nameInDruckbuchstaben", 220)])
pdf.text_row("unterschrift", [("Bei Minderjährigen: Name Sorgeberechtigte/r", "erziehungsberechtigter", 250), ("Geburtsdatum Unterzeichner/in", "geburtsdatumUnterzeichner", 160)])
pdf.signature_box("unterschrift", "Unterschrift Patient/in bzw. Sorgeberechtigte/r")
pdf.signature_box("unterschrift", "Optional zweite Unterschrift / weiterer Sorgeberechtigter")
pdf.note("Hinweis: Eine per Adobe Fill & Sign eingefügte gezeichnete Signatur ist eine einfache elektronische Signatur. Alternativ bitte ausdrucken und handschriftlich unterschreiben.")

pdf.save()
reader = PdfReader(str(OUT))
fields = reader.get_fields() or {}
print(f"PDF erstellt: {OUT}")
print(f"Seiten: {len(reader.pages)}")
print(f"Interaktive Felder: {len(fields)}")
print("Online-Struktur abgebildet: Intro + Sektionen I–XXV inkl. IAA und Unterschrift")
