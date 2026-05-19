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
        self.c.drawString(M, H - 41, "Friedrich-Deffner-Straße 19a · 86163 Augsburg · Tel. 0821-2621462 · info@rauch-heilpraktiker.de")
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

    def long_text(self, prefix: str, label: str, key: str, lines: int = 3):
        h = lines * 12
        self.ensure(h + 24)
        self.draw_wrapped(label, M, self.y - 8, W - 2 * M, size=8.2, leading=9)
        self.y -= 14
        self.text_field(self.field_name(prefix, key), M, self.y - h, W - 2 * M, h, multiline=True, font_size=8)
        self.y -= h + 8

    def checkboxes(self, prefix: str, title: str, options: list[str], cols: int = 3):
        if title:
            self.h2(title)
        col_w = (W - 2 * M) / cols
        rows = (len(options) + cols - 1) // cols
        self.ensure(rows * 15 + 6)
        for i, label in enumerate(options):
            row, col = divmod(i, cols)
            x = M + col * col_w
            y = self.y - 10 - row * 15
            self.checkbox_field(self.field_name(prefix, label), x, y, 9)
            self.draw_wrapped(label, x + 13, y + 7, col_w - 15, size=7.6, leading=8)
        self.y -= rows * 15 + 8

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
        # außer es enthält Platzhalterwörter (Stadium/Rasse/Anzahl/...)
        PLACEHOLDER = {"stadium", "rasse", "kontakt", "anzahl", "datum", "grund",
                       "dosis", "lokalisation", "farbe", "typ", "art", "symptome",
                       "menge", "dauer", "psa", "bemerkung", "frequenz"}
        if " / " in label:
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
            self.c.drawString(x + 2, self.y - 9, label[:22])
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

    def signature_box(self, prefix: str, title: str):
        self.ensure(76)
        self.c.setFillColor(INK)
        self.c.setFont(BOLD, 8.5)
        self.c.drawString(M, self.y - 8, title)
        self.y -= 14
        self.c.setStrokeColor(BORDER)
        self.c.setLineWidth(0.7)
        self.c.rect(M, self.y - 48, W - 2 * M, 48, fill=0, stroke=1)
        self.c.setFillColor(MUTED)
        self.c.setFont(ITALIC, 7.5)
        self.c.drawString(M + 6, self.y - 43, "Signatur hier in Adobe Reader / Fill & Sign platzieren oder nach Ausdruck handschriftlich unterschreiben")
        self.y -= 58

    def save(self):
        self._footer()
        self.c.save()


family_rows = [
    ("hoherBlutdruck", "Hoher Blutdruck"), ("herzinfarkt", "Herzinfarkt"), ("schlaganfall", "Schlaganfall"),
    ("diabetes", "Diabetes"), ("gicht", "Gicht"), ("lungenasthma", "Lungenasthma"),
    ("lungentuberkulose", "Lungentuberkulose"), ("nervenleiden", "Nervenleiden"), ("krebs", "Krebserkrankungen"),
    ("allergien", "Allergien"), ("sucht", "Suchterkrankungen"), ("autoimmun", "Autoimmun-Erkrankungen"),
]

kopf_rows = [
    ("augenerkrankung", "Augenerkrankung inkl. Netzhaut, Katarakt, Glaukom, Makula, Entzündungen"),
    ("schwerhoerig", "Schwerhörigkeit links/rechts/beidseitig"),
    ("ohrenerkrankung", "Ohrenerkrankung inkl. Tinnitus, Hörsturz, Mittelohr, Morbus Menière"),
    ("sinusitis", "Sinusitis / Nebenhöhlenentzündung"),
    ("mandelentzuendung", "Mandelentzündung"),
    ("kopfschmerzen", "Kopfschmerzen / Migräne / Spannung / Cluster"),
    ("schwindel", "Schwindel: Lagerungs-, Dreh-, Schwankschwindel"),
    ("geruchsminderung", "Geruchsminderung / Geruchsverlust"),
    ("geschmacksminderung", "Geschmacksminderung"),
    ("neuralgien", "Neuralgien: Trigeminus, Glossopharyngeus, Occipitalis, Post-Zoster"),
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
    ("prostata", "Prostata: BPH, Prostatitis, Karzinom, PSA"), ("hoden", "Hoden: Entzündung, Torsion, Krebs, Varikozele, Hydrozele"),
    ("nebenhoden", "Nebenhoden: Epididymitis, Zyste"), ("erektionsstoerung", "Erektionsstörung"),
]

surgery_rows = [
    ("unfall", "Unfall"), ("knochenbruch", "Knochenbruch"), ("kopfverletzung", "Kopfverletzung"),
    ("krankenhausaufenthalt", "Krankenhausaufenthalt"), ("kuraufenthalt", "Kuraufenthalt"),
    ("bluttransfusion", "Bluttransfusion"), ("chemotherapie", "Chemotherapie"),
    ("strahlentherapie", "Strahlentherapie"), ("szintigraphie", "Szintigraphie"),
    ("petCt", "PET-CT"), ("radioiodtherapie", "Radioiodtherapie / Datum / Grund / Dosis"),
]

cancer_rows = [
    ("hatKrebs", "Krebserkrankung bekannt"), ("operationDurchgefuehrt", "Operation durchgeführt"),
    ("chemotherapieErhalten", "Chemotherapie erhalten"), ("strahlentherapieErhalten", "Strahlentherapie erhalten"),
    ("metastasen", "Metastasen"), ("aktuelleTumortherapie", "Aktuelle Tumortherapie"),
]

allergy_rows = [
    ("inhalation", "Inhalationsallergien: Pollen, Staub, Tierhaare, Schimmel"),
    ("tierepithelien", "Tierepithelien: Hund, Katze, Pferd"),
    ("nahrungsmittel", "Nahrungsmittelallergien"), ("medikamente", "Medikamentenallergien"),
    ("kontakt", "Kontaktallergien: Nickel, Latex, sonstige"), ("laktose", "Laktoseintoleranz"),
    ("gluten", "Gluten / Zöliakie"), ("fruktose", "Fruktose"), ("histamin", "Histamin"),
]

environment_chem = [
    "Diesel-Abgase", "Tabakrauch", "Pestizide", "Benzin", "Farben", "Desinfektionsmittel", "Reiniger",
    "Parfüms", "Teer", "Nagellack", "Haarspray", "Neue Raumausstattung", "Kunststoff", "Neues Auto",
]

environment_body = [
    "Strahlung: Geopathie, Elektrosmog, Hochspannung, Funkmasten, WLAN", "Zahnherde / Wurzelbehandlungen",
    "Quecksilber / Amalgam", "Zahnbeschwerden", "Metalle im Mund", "Implantate", "Nebenhöhlen",
    "Tonsillen", "Narben", "Mangelzustände: Vitamine, Mineralien, Spurenelemente, Enzyme, Flüssigkeit",
    "Mikroorganismen: Viren, Bakterien, Pilze, Parasiten", "Toxisch: Schwermetalle, Chemikalien, Pestizide, Erbtoxine",
]

infection_rows = [
    ("tropenReise", "Tropenreise / Länder"), ("zeckenbiss", "Zeckenbiss / roter Hof"),
    ("borreliose", "Borreliose"), ("fsmeImpfung", "FSME-Impfung"), ("hund", "Hund / Rasse"),
    ("katze", "Katze / Rasse"), ("pferd", "Pferd / Kontakt"), ("andereHaustiere", "Andere Haustiere"),
]

vaccine_rows = [
    ("mmr", "MMR"), ("tetanus", "Tetanus"), ("diphtherie", "Diphtherie"), ("keuchhusten", "Keuchhusten"),
    ("polio", "Polio"), ("hepatitisA", "Hepatitis A"), ("hepatitisB", "Hepatitis B"),
    ("windpocken", "Windpocken"), ("influenza", "Influenza"), ("pneumokokken", "Pneumokokken"),
]

preference_options = [
    "Homöopathie", "Biophysikalisch / Bioresonanz", "Metatron / NLS", "Trikombin", "Zapper", "EAV",
    "Mineral-Testung", "Akupunktur", "Phytotherapie", "Bachblüten", "Sanum", "Hypnotherapie",
]


pdf = PdfForm(OUT)

pdf.h1("Willkommen / Anleitung")
pdf.note("Dies ist der vollständige ausfüllbare PDF-Anamnesebogen als Alternative zum Online-Formular. Er ist für Adobe Reader, Adobe Fill & Sign und kompatible PDF-Apps vorgesehen.")
pdf.note("Bitte speichern Sie das ausgefüllte PDF lokal auf Ihrem Gerät. Die Bearbeitung erfolgt ohne Ausfüllen über den Lovable-Server.")
pdf.note("Bei Fragen, die nicht zutreffen, lassen Sie die Felder leer. Pflichtfelder aus dem Onlinebogen sind im PDF fachlich wichtig, werden technisch aber nicht erzwungen.")
pdf.long_text("intro", "Aktueller Anlass / wichtigste Anliegen in eigenen Worten:", "freitext_anlass", 4)

pdf.h1("I. Patientendaten")
pdf.h2("A. Personalia")
pdf.text_row("patient", [("Nachname *", "nachname", 155), ("Vorname *", "vorname", 155), ("Geburtsdatum *", "geburtsdatum", 100), ("Nationalität", "nationalitaet", 105)])
pdf.text_row("patient", [("Geschlecht", "geschlecht", 120), ("Zivilstand", "zivilstand", 120), ("Körpergröße (cm)", "koerpergroesse", 105), ("Gewicht (kg)", "gewicht", 105)])
pdf.h2("B. Kontaktdaten")
pdf.text_row("kontakt", [("Straße, Hausnummer *", "strasse", 230), ("PLZ *", "plz", 70), ("Wohnort *", "wohnort", 190)])
pdf.text_row("kontakt", [("Telefon privat", "telefonPrivat", 150), ("Telefon beruflich", "telefonBeruflich", 150), ("Mobil", "mobil", 150)])
pdf.text_row("kontakt", [("E-Mail *", "email", 250)])
pdf.h2("C. Mitversicherte / Angehörige")
pdf.mini_table("mitversicherte", "Mitversicherte Personen", [("Name", 190), ("Verhältnis", 120), ("Geburtsdatum", 120)], 3)
pdf.h2("D. Versicherung")
pdf.checkboxes("versicherung", "Versicherungstyp", ["privat", "gesetzlich", "Beihilfe", "Zusatzversicherung"], 4)
pdf.text_row("versicherung", [("Versicherungsname", "versicherungsname", 190), ("Versicherungsnummer", "versicherungsnummer", 145), ("Tarif", "tarif", 120)])
pdf.checkboxes("versicherung", "Kostenübernahme Naturheilkunde", ["bekannt ja", "bekannt nein", "bitte selbst klären"], 3)
pdf.h2("E. Berufliche Situation")
pdf.text_row("beruf", [("Beruf", "beruf", 150), ("Arbeitgeber", "arbeitgeber", 170), ("Branche", "branche", 130)])
pdf.text_row("beruf", [("Arbeitsunfähig seit", "arbeitsunfaehigSeit", 135), ("Berentner seit", "berentnerSeit", 120), ("Unfallrente %", "unfallrenteProzent", 95), ("Schwerbehinderung %", "schwerbehinderungProzent", 115)])
pdf.h2("F. Sorgeberechtigte bei Minderjährigen")
pdf.text_row("sorge", [("Mutter/Vater/Sorgeberechtigte/r", "typ", 175), ("Vorname", "vorname", 145), ("Nachname", "nachname", 145)])
pdf.text_row("sorge", [("Straße", "strasse", 175), ("PLZ", "plz", 70), ("Ort", "ort", 160), ("Telefon", "telefon", 120)])
pdf.text_row("sorge", [("E-Mail", "email", 220), ("Festnetz bei abweichender Adresse", "festnetz", 220)])
pdf.h2("G. Informationsquelle und Vorbehandler")
pdf.checkboxes("infoquelle", "Wie sind Sie auf die Praxis aufmerksam geworden?", ["Empfehlung", "Internet", "Google", "Arzt/Heilpraktiker", "Social Media", "Sonstiges"], 3)
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
pdf.h2("Schlaf und psychovegetative Symptome")
pdf.condition_table("schlaf", sleep_rows)
pdf.h2("Psychische Erkrankungen / Belastungen")
pdf.condition_table("psyche", psy_rows)

pdf.h1("IV. Herz & Kreislauf")
pdf.condition_table("herz", heart_rows)
pdf.long_text("herz", "Sonstige Herz-/Kreislauf-Bemerkungen:", "sonstige", 2)

pdf.h1("V. Lunge & Atmung")
pdf.condition_table("lunge", lung_rows)
pdf.long_text("lunge", "Sonstige Lungen-/Atemwegs-Bemerkungen:", "sonstige", 2)

pdf.h1("VI. Magen & Darm")
pdf.condition_table("magenDarm", digestive_rows)
pdf.text_row("magenDarm", [("Durst", "durst", 120), ("Appetit", "appetit", 140), ("Ernährungstyp", "ernaehrungstyp", 200)])
pdf.long_text("magenDarm", "Sonstige Magen-Darm-Bemerkungen:", "sonstige", 2)

pdf.h1("VII. Leber & Galle")
pdf.condition_table("leberGalle", liver_rows)
pdf.long_text("leberGalle", "Sonstige Leber-/Galle-Bemerkungen:", "sonstige", 2)

pdf.h1("VIII. Niere & Blase")
pdf.condition_table("niereBlase", kidney_rows)
pdf.text_row("niereBlase", [("Miktionsfrequenz tagsüber", "miktionsfrequenz", 180)])
pdf.long_text("niereBlase", "Sonstige Niere-/Blase-Bemerkungen:", "sonstige", 2)

pdf.h1("IX. Hormone")
pdf.condition_table("hormone", hormone_rows)
pdf.long_text("hormone", "Sonstige hormonelle Themen:", "sonstige", 2)

pdf.h1("X. Bewegungsapparat")
pdf.condition_table("bewegungsapparat", msk_rows)
pdf.long_text("bewegungsapparat", "Sonstige Beschwerden am Bewegungsapparat:", "sonstige", 3)

pdf.h1("XI. Frauengesundheit")
pdf.note("Nur ausfüllen, soweit zutreffend.")
pdf.text_row("frauen", [("Geburtsgewicht", "geburtsgewicht", 130)])
pdf.condition_table("frauen", women_rows)
pdf.long_text("frauen", "Sonstige frauengesundheitliche Angaben:", "sonstige", 2)

pdf.h1("XI. Männergesundheit")
pdf.note("Nur ausfüllen, soweit zutreffend.")
pdf.condition_table("maenner", men_rows)
pdf.long_text("maenner", "Sonstige männergesundheitliche Angaben:", "sonstige", 2)

pdf.h1("XII. Unfälle & OPs")
pdf.condition_table("unfaelleOps", surgery_rows)
pdf.mini_table("operationen", "Operationen im Detail", [("Jahr", 70), ("Grund / Art der Operation", 360)], 6)

pdf.h1("XIII. Krebs")
pdf.note("Nur ausfüllen, wenn relevant. Bei akuter/onkologischer Behandlung bitte Unterlagen mitbringen.")
pdf.condition_table("krebs", cancer_rows)
pdf.text_row("krebs", [("Welche Krebsart", "welche", 180), ("Typ", "welcheTyp", 140), ("Diagnosejahr", "diagnoseJahr", 100)])
pdf.text_row("krebs", [("Betroffene Organe", "betroffeneOrgane", 240), ("TNM T", "tnm_t", 60), ("N", "tnm_n", 60), ("M", "tnm_m", 60)])
pdf.long_text("krebs", "Therapien, Metastasen, aktuelle Tumortherapie, Besonderheiten:", "details", 4)

pdf.h1("XIV. Allergien")
pdf.condition_table("allergien", allergy_rows)
pdf.long_text("allergien", "Sonstige Allergien / Unverträglichkeiten / Reaktionen:", "sonstigeUnvertraeglichkeit", 3)

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
pdf.long_text("lebensweise", "Ernährungsgewohnheiten / Besonderheiten:", "ernaehrungsgewohnheiten", 3)

pdf.h1("XVII. Zahngesundheit")
pdf.checkboxes("zahn", "Gebisstyp / Prothese", ["vollständig", "Teilprothese", "Vollprothese", "Oberkiefer", "Unterkiefer", "beide Kiefer"], 3)
pdf.text_row("zahn", [("Prothese seit", "protheseSeit", 120), ("Letzter Zahnarztbesuch", "letzterZahnarztbesuch", 160), ("Zahnarzt Name/Ort", "zahnarztName", 220)])
pdf.mini_table("zahnbefunde", "Zahnbefunde / Zahnnummern", [("Zahnnummer", 80), ("Befund/Diagnose", 200), ("seit", 80), ("Bemerkung", 170)], 10)
pdf.condition_table("zahn", [("parodontitis", "Parodontitis"), ("zahnfleischbluten", "Zahnfleischbluten"), ("kiefergelenk", "Kiefergelenk: Knacken, Schmerzen, eingeschränkt"), ("bruxismus", "Bruxismus nachts/tagsüber/Schiene")])
pdf.long_text("zahn", "Weitere zahnärztliche / kieferbezogene Bemerkungen:", "bemerkungen", 3)

pdf.h1("XVIII. Umwelt")
pdf.h2("Chemosensibilität / Reizstoffe")
pdf.condition_table("umweltChemie", [(sanitize_name(x), x) for x in environment_chem], with_since=False, with_details=True)
pdf.h2("Körperbelastungen / Störfelder")
pdf.condition_table("umweltKoerper", [(sanitize_name(x), x) for x in environment_body], with_since=False, with_details=True)

pdf.h1("XIX. Infektionen")
pdf.condition_table("infektionen", infection_rows)

pdf.h1("XX. Impfstatus")
pdf.condition_table("impfungen", vaccine_rows)
pdf.h2("COVID-19")
pdf.checkboxes("covid", "COVID", ["geimpft", "Infektion durchgemacht", "Long-COVID", "Impfreaktionen"], 4)
pdf.mini_table("covidDosen", "COVID-Impfungen", [("Dosis", 70), ("Datum", 105), ("Hersteller", 150), ("Reaktion/Bemerkung", 220)], 4)
pdf.long_text("covid", "COVID-Infektion, Long-COVID, Impfreaktionen:", "details", 3)

pdf.h1("XXI. Beschwerden")
pdf.long_text("beschwerden", "Hauptbeschwerde:", "hauptbeschwerde", 4)
pdf.long_text("beschwerden", "Weitere Beschwerden:", "weitereBeschwerden", 3)
pdf.text_row("beschwerden", [("Beginn der Beschwerden", "beginn", 140), ("Verlauf", "verlauf", 120), ("Schmerzintensität 0–10", "schmerzintensitaet", 130)])
pdf.checkboxes("beschwerden", "Auftreten", ["ständig", "tagsüber", "nachts", "nach Mahlzeiten", "bei Belastung", "in Ruhe", "unregelmäßig"], 3)
pdf.checkboxes("beschwerden", "Art / Qualität", ["Schmerz", "körperliche Störung", "Funktionsstörung", "psychische Belastung", "dumpf", "stechend", "brennend", "ziehend", "krampfartig", "elektrisierend"], 3)
pdf.long_text("beschwerden", "Ausstrahlung:", "ausstrahlung", 2)
pdf.long_text("beschwerden", "Was verschlimmert die Beschwerden?", "verschlimmerung", 2)
pdf.long_text("beschwerden", "Was verbessert die Beschwerden?", "verbesserung", 2)
pdf.long_text("beschwerden", "Bisherige Behandlungen:", "bisherigeBehandlungen", 3)
pdf.long_text("beschwerden", "Ergebnis bisheriger Behandlungen:", "ergebnisBisherigerBehandlungen", 2)

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
pdf.long_text("praeferenz", "Therapieerwartungen:", "therapieerwartungen", 3)
pdf.long_text("praeferenz", "Gesundheitsziele:", "gesundheitsziele", 3)

pdf.h1("XXIII. Persönliches")
pdf.text_row("soziales", [("Familienstand", "familienstand", 120), ("Kinder Anzahl", "kinderAnzahl", 90), ("Kinder Alter", "kinderAlter", 160)])
pdf.text_row("soziales", [("Wohnumfeld", "wohnumfeld", 120), ("Wohntyp", "wohntyp", 120), ("Beruflicher Stress", "berufStress", 130), ("Finanzielle Belastung", "finanzBelastung", 140)])
pdf.text_row("soziales", [("Soziales Netzwerk", "sozialesNetzwerk", 150)])
pdf.long_text("soziales", "Hobbys / Ressourcen / persönliche Umstände:", "hobbys", 4)

pdf.h1("XXIV. IAA-Fragebogen")
pdf.note("Individuelle Austestung und Analyse (IAA). Bitte zutreffende Fragen ankreuzen; Bemerkungen/Intensität optional ergänzen.")
iaa_categories = parse_iaa_categories()
for cat in iaa_categories:
    pdf.h2(cat["title"])
    pdf.condition_table(f"iaa_{cat['id']}", [(q["id"].replace('.', '_'), f"{q['id']}  {q['text']}") for q in cat["questions"]], with_since=False, with_details=True)

pdf.h1("XXV. Unterschrift")
pdf.long_text("abschluss", "Weitere Erkrankungen/Symptome, die bisher nicht abgefragt wurden:", "weitereErkrankungen", 4)
pdf.long_text("abschluss", "Zusätzliche Informationen, die für die Behandlung relevant sein könnten:", "zusaetzlicheInfos", 4)
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
