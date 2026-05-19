"""
Erzeugt zwei ausfüllbare AcroForm-PDFs (DSGVO-Offline-Variante):
  - public/patientenvertrag-blanko.pdf
  - public/datenschutz-einwilligung-blanko.pdf

Inhalte sind 1:1 aus den Online-Seiten /patientenaufklaerung und /datenschutz
übernommen, damit Online- und Papierweg rechtlich identisch sind.
"""
from __future__ import annotations
from pathlib import Path
import re
from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor, white, black
from reportlab.pdfgen import canvas
from reportlab.pdfbase.pdfmetrics import stringWidth

W, H = A4
M = 42
SAGE = HexColor("#6b8a6e")
SAGE_DARK = HexColor("#3f5a45")
SAGE_LIGHT = HexColor("#e6efe5")
TERRACOTTA = HexColor("#b85c43")
INK = HexColor("#1d2419")
MUTED = HexColor("#5d6b58")
BORDER = HexColor("#9aa89a")
PALE = HexColor("#f3f5f1")
FONT, BOLD, ITALIC = "Helvetica", "Helvetica-Bold", "Helvetica-Oblique"

OUT_DIR = Path("public")
OUT_DIR.mkdir(exist_ok=True)


def sanitize(name: str) -> str:
    return re.sub(r"[^A-Za-z0-9_]+", "_", name).strip("_")[:60] or "f"


class Form:
    def __init__(self, path: Path, title: str, subtitle: str):
        self.path = path
        self.title = title
        self.subtitle = subtitle
        self.c = canvas.Canvas(str(path), pagesize=A4)
        self.c.setTitle(title)
        self.c.setAuthor("Naturheilpraxis Peter Rauch")
        self.page = 1
        self.field_count = 0
        self._header()

    def _header(self):
        self.c.setFillColor(SAGE)
        self.c.rect(0, H - 58, W, 58, fill=1, stroke=0)
        self.c.setFillColor(white)
        self.c.setFont(BOLD, 13)
        self.c.drawString(M, H - 25, "Naturheilpraxis Peter Rauch")
        self.c.setFont(FONT, 8.5)
        self.c.drawString(M, H - 41, "Friedrich-Deffner-Straße 19a · 86163 Augsburg · Tel. 0821-2621462 · info@rauch-heilpraktiker.de")
        self.c.setFont(BOLD, 10.5)
        self.c.drawRightString(W - M, H - 25, self.title.upper())
        self.c.setFont(FONT, 8)
        self.c.drawRightString(W - M, H - 41, self.subtitle)
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

    def ensure(self, h: float):
        if self.y - h < M + 34:
            self.new_page()

    def wrap(self, text: str, width: float, font=FONT, size=9, leading=11):
        lines = []
        for paragraph in text.split("\n"):
            words = paragraph.split()
            cur = ""
            for w in words:
                cand = (cur + " " + w).strip()
                if stringWidth(cand, font, size) <= width:
                    cur = cand
                else:
                    if cur:
                        lines.append(cur)
                    cur = w
            lines.append(cur)
        return lines

    def h1(self, title: str):
        if self.y < H - 80:
            self.new_page()
        self.c.setFillColor(SAGE_LIGHT)
        self.c.rect(M, self.y - 22, W - 2 * M, 22, fill=1, stroke=0)
        self.c.setFillColor(SAGE_DARK)
        self.c.setFont(BOLD, 11)
        self.c.drawString(M + 7, self.y - 15, title)
        self.y -= 30

    def h2(self, title: str):
        self.ensure(22)
        self.c.setFillColor(TERRACOTTA)
        self.c.setFont(BOLD, 9.5)
        self.c.drawString(M, self.y - 10, title)
        self.y -= 16

    def para(self, text: str, size: float = 9, leading: float = 11.5, color=INK, italic=False):
        font = ITALIC if italic else FONT
        lines = self.wrap(text, W - 2 * M, font, size, leading)
        self.ensure(len(lines) * leading + 4)
        self.c.setFillColor(color)
        self.c.setFont(font, size)
        for ln in lines:
            self.c.drawString(M, self.y - size, ln)
            self.y -= leading
        self.y -= 3

    def bullet_list(self, items: list[str], size: float = 9, leading: float = 11.5):
        for it in items:
            lines = self.wrap(it, W - 2 * M - 14, FONT, size, leading)
            self.ensure(len(lines) * leading + 2)
            self.c.setFillColor(INK)
            self.c.setFont(FONT, size)
            self.c.drawString(M + 4, self.y - size, "•")
            for i, ln in enumerate(lines):
                self.c.drawString(M + 14, self.y - size, ln)
                self.y -= leading
        self.y -= 2

    def field_name(self, key: str) -> str:
        self.field_count += 1
        return sanitize(key)

    def text_field(self, key: str, x: float, y: float, w: float, h: float = 13, multiline=False, font_size=9):
        kwargs = dict(name=self.field_name(key), tooltip=key, x=x, y=y, width=w, height=h,
                      borderWidth=0.5, borderColor=BORDER, fillColor=white, textColor=black, fontSize=font_size)
        if multiline:
            kwargs["fieldFlags"] = "multiline"
        self.c.acroForm.textfield(**kwargs)

    def checkbox(self, key: str, x: float, y: float, size: float = 10):
        self.c.acroForm.checkbox(name=self.field_name(key), tooltip=key, x=x, y=y, size=size,
                                 borderWidth=0.5, borderColor=BORDER, fillColor=white, buttonStyle="check")

    def label_field(self, label: str, key: str, width: float, multiline=False, height=13):
        self.ensure(28)
        self.c.setFillColor(INK)
        self.c.setFont(FONT, 8.5)
        self.c.drawString(M, self.y - 8, label)
        self.y -= 11
        self.text_field(key, M, self.y - height, width, height, multiline=multiline)
        self.y -= height + 6

    def row(self, fields: list[tuple[str, str, float]]):
        self.ensure(32)
        x = M
        self.c.setFillColor(INK)
        self.c.setFont(FONT, 8.5)
        for label, _, w in fields:
            self.c.drawString(x, self.y - 8, label)
            x += w + 8
        self.y -= 11
        x = M
        for _, key, w in fields:
            self.text_field(key, x, self.y - 13, w, 13)
            x += w + 8
        self.y -= 19

    def consent_box(self, label: str, key: str):
        lines = self.wrap(label, W - 2 * M - 20, FONT, 9, 11)
        h = max(16, len(lines) * 11 + 4)
        self.ensure(h + 2)
        y_top = self.y
        self.checkbox(key, M, y_top - 13, 11)
        self.c.setFillColor(INK)
        self.c.setFont(FONT, 9)
        for i, ln in enumerate(lines):
            self.c.drawString(M + 18, y_top - 10 - i * 11, ln)
        self.y -= h + 2

    def signature(self, label: str, key: str, h: float = 50):
        self.ensure(h + 24)
        self.c.setFillColor(INK)
        self.c.setFont(BOLD, 9)
        self.c.drawString(M, self.y - 9, label)
        self.y -= 14
        self.c.setStrokeColor(BORDER)
        self.c.setLineWidth(0.7)
        self.c.rect(M, self.y - h, W - 2 * M, h, fill=0, stroke=1)
        # internes Textfeld als Fallback (z.B. Name in Druckbuchstaben)
        self.text_field(key, M + 2, self.y - h + 2, W - 2 * M - 4, h - 4, multiline=True, font_size=10)
        self.y -= h + 6

    def note(self, text: str):
        self.para(text, size=8, leading=10, color=MUTED, italic=True)

    def save(self):
        self._footer()
        self.c.save()
        print(f"Erstellt: {self.path} ({self.page} Seiten, {self.field_count} Felder)")


# ---------------------------------------------------------------------------
# PDF 1: PATIENTENVERTRAG  (entspricht /patientenaufklaerung)
# ---------------------------------------------------------------------------
pdf = Form(
    OUT_DIR / "patientenvertrag-blanko.pdf",
    title="Patientenvertrag",
    subtitle="Behandlungsvereinbarung · ausfüllbares PDF",
)

pdf.h1("I. Persönliche Angaben")
pdf.row([("Vorname *", "vorname", 230), ("Nachname *", "nachname", 230)])
pdf.row([("Geburtsdatum *", "geburtsdatum", 130), ("Geburtsort", "geburtsort", 180), ("Beruf", "beruf", 160)])
pdf.label_field("Straße und Hausnummer *", "strasse", W - 2 * M)
pdf.row([("PLZ *", "plz", 80), ("Ort *", "ort", 220), ("Land", "land", 180)])
pdf.row([("Telefon mobil *", "telMobil", 200), ("Telefon Festnetz", "telFest", 200), ("E-Mail *", "email", 110)])
pdf.note("Felder mit * sind Pflichtangaben (Behandlungsvertrag, § 630a BGB).")

pdf.h1("II. Wichtiger Hinweis zur Kostenerstattung")
pdf.para(
    "Die gesetzlichen Krankenkassen in Deutschland übernehmen die Kosten der Heilpraktiker-Behandlung "
    "leider nicht. Wir können auch nicht garantieren, dass eine Erstattung durch die privaten "
    "Krankenversicherungen (PKV), private Zusatzversicherungen oder die Beihilfe erfolgt."
)

pdf.h2("Kostenerstattung")
pdf.para(
    "Die Gebührenordnung – GebÜH (Gebührenordnung der Heilpraktiker) ist geltend für Patienten, die "
    "privatversichert, beihilfeversichert oder zusatzversichert sind. Für selbstzahlende, nicht "
    "privatversicherte Patienten sind die GebÜH-Positionen nicht von Bedeutung."
)
pdf.para(
    "Versicherte privater Krankenkassen (Beihilfe, Zusatzversicherungen und private "
    "Vollversicherungen) erhalten Leistungen des Heilpraktikers erstattet, wenn dies in ihrem "
    "Versicherungsvertrag vereinbart wurde. Die Erstattungsfähigkeit nach GebÜH ist je nach "
    "Krankenkasse und gewähltem Tarif (ca. 50 Krankenkassen à 10 Tarife = ca. 500 verschiedene "
    "Abrechnungsmodalitäten) unterschiedlich."
)
pdf.para(
    "Die Übernahme der Behandlungskosten und damit in Zusammenhang stehende Arzneimittelverordnungen "
    "wird von den Versicherungen sehr unterschiedlich gehandhabt. Eine Kostenerstattung ist nicht "
    "gesichert und unterliegt mitunter der Einzelprüfung. Häufig werden nur Teilbeträge erstattet, "
    "die nicht kostendeckend sind."
)

pdf.h2("GebÜH – Gebührenordnung der Heilpraktiker")
pdf.para(
    "Das GebÜH ist ein Verzeichnis der durchschnittlich üblichen Vergütungen, welches als "
    "Berechnungshilfe bei der Rechnungserstellung dient. Sofern die Höhe des Honorars vor der "
    "Behandlung nicht ausdrücklich vereinbart wurde, kann der Patient davon ausgehen, dass sie sich "
    "im Rahmen der im GebÜH enthaltenen Beträge bewegt."
)
pdf.para(
    "Die Praxis rechnet nach GebÜH-Höchstsatz ab. Sollten die möglichen Positionen der GebÜH, die "
    "bezüglich der Behandlung abgerechnet werden können, den Stundensatz überschreiten, wird dies "
    "auf der Rechnung folgend ausgewiesen: „Differenzbetrag zwischen Gebührenverzeichnis und dem "
    "Patientenvertrag\"."
)

pdf.h1("III. Zahlungspflicht")
pdf.para(
    "Unabhängig von einer abweichenden Beurteilung der medizinischen Notwendigkeit, einer "
    "medizinisch-wissenschaftlichen Anerkennung der durchgeführten Therapien und Diagnostik, oder "
    "einer abweichenden Erstattung Ihrer Versicherung, ist der Rechnungsbetrag in voller Höhe zu "
    "zahlen."
)

pdf.h1("IV. Terminvereinbarung & Absageregelung")
pdf.para(
    "Vereinbarte Termine sind ausschließlich für den jeweiligen Patienten reserviert. Da es seitens "
    "des Therapeuten einer gründlichen Vorbereitung bedarf und es sich um eine reine Bestellpraxis "
    "handelt, müssen Termine mindestens 48 Stunden vor dem vereinbarten Termin abgesagt werden."
)
pdf.bullet_list([
    "Für nicht rechtzeitig abgesagte Termine wird eine Ausfallentschädigung in voller Höhe des Stundensatzes berechnet.",
    "Bei Verspätungen über 15 Minuten ist eine Verlängerung der Sitzungszeit oder Erstattung nicht genutzter Zeit nicht möglich.",
    "Bei Verspätungen über 30 Minuten kann der Therapeut den Termin ablehnen. Auch hier wird eine Ausfallentschädigung fällig.",
    "Der Therapeut behält sich das Recht vor, eine Sitzung abzubrechen, sofern die Mitwirkung des Patienten nicht gegeben ist. In diesem Fall ist das gesamte Honorar fällig.",
])

pdf.h1("V. Verhinderung des Therapeuten")
pdf.para(
    "Sollte der Therapeut verhindert sein, die Leistungen zum vereinbarten Termin zu erbringen, kann "
    "er für evtl. entstandene Kosten nicht haftbar gemacht werden, es sei denn, die Verhinderung "
    "beruht auf Vorsatz oder grober Fahrlässigkeit. Im Falle einer Verhinderung kann ein Ersatztermin "
    "vereinbart werden. Der Therapeut kann naturgemäß keine Garantien für Behandlungserfolge gewähren."
)

pdf.h1("VI. Bestätigungen & Einwilligungen")
pdf.consent_box(
    "Ich habe die Patientenaufklärung zu Leistungserstattung, Preisen und Terminregelung gelesen und "
    "verstanden und bin mit den Inhalten einverstanden.",
    "best_aufklaerung",
)
pdf.consent_box(
    "Mir ist bekannt, dass die Krankenkassenerstattung nicht garantiert ist und ich den "
    "Rechnungsbetrag unabhängig von einer Erstattung in voller Höhe selbst schulde.",
    "best_zahlung",
)
pdf.consent_box(
    "Ich habe die 48-Stunden-Absageregelung zur Kenntnis genommen und akzeptiere die "
    "Ausfallentschädigung bei nicht rechtzeitiger Absage.",
    "best_absage",
)
pdf.consent_box(
    "Ich habe die separate Datenschutzerklärung (Datenschutz-Einwilligung) gelesen oder werde sie "
    "gemeinsam mit diesem Vertrag unterzeichnen.",
    "best_datenschutz_verweis",
)

pdf.h1("VII. Unterschrift")
pdf.row([("Ort", "unt_ort", 200), ("Datum", "unt_datum", 130), ("Name in Druckbuchstaben", "unt_name", 200)])
pdf.row([
    ("Bei Minderjährigen: Name Sorgeberechtigte/r", "sorgeberechtigter", 280),
    ("Geburtsdatum Unterzeichner/in", "unt_gebdatum", 200),
])
pdf.signature("Unterschrift Patient/in bzw. Sorgeberechtigte/r", "sig_patient")
pdf.signature("Optional zweite Unterschrift / weiterer Sorgeberechtigter", "sig_zweit", h=42)
pdf.note(
    "Hinweis: Eine per Adobe Fill & Sign eingefügte handgezeichnete Signatur gilt als einfache "
    "elektronische Signatur. Für den Behandlungsvertrag empfehlen wir, den Bogen zusätzlich "
    "auszudrucken und handschriftlich zu unterschreiben."
)
pdf.save()


# ---------------------------------------------------------------------------
# PDF 2: DATENSCHUTZ-EINWILLIGUNG  (entspricht /datenschutz)
# ---------------------------------------------------------------------------
pdf = Form(
    OUT_DIR / "datenschutz-einwilligung-blanko.pdf",
    title="Datenschutz-Einwilligung",
    subtitle="DSGVO-Aufklärung & Einwilligung · ausfüllbares PDF",
)

pdf.h1("Verantwortliche Person")
pdf.para(
    "Peter Rauch, Heilpraktiker · Friedrich-Deffner-Straße 19a, 86163 Augsburg\n"
    "Tel. 0821-2621462 · info@rauch-heilpraktiker.de"
)

pdf.h1("I. Persönliche Angaben des/der Einwilligenden")
pdf.row([("Vorname *", "vorname", 230), ("Nachname *", "nachname", 230)])
pdf.row([("Geburtsdatum *", "geburtsdatum", 130), ("Telefon *", "telefon", 200), ("E-Mail *", "email", 160)])
pdf.label_field("Anschrift (Straße, PLZ, Ort) *", "anschrift", W - 2 * M)

pdf.h1("II. Aufklärung gemäß DSGVO")

pdf.h2("Zweck der Datenverarbeitung")
pdf.para(
    "Die Datenverarbeitung erfolgt, um den Behandlungsvertrag zwischen Ihnen und Ihrem Heilpraktiker "
    "erfüllen zu können. Wir verarbeiten Ihre personenbezogenen Daten, insbesondere Ihre "
    "Gesundheitsdaten. Dazu zählen Anamnesen, Diagnosen, Therapievorschläge und Befunde, Messungen, "
    "Testungen, die wir oder andere Behandlungspersonen (Ärzte/Heilpraktiker usw.) erheben bzw. "
    "erhoben haben. Zu diesen Zwecken können uns auch andere Ärzte oder Psychotherapeuten, bei denen "
    "Sie in Behandlung sind, Daten zur Verfügung stellen (z.B. in Arztbriefen)."
)

pdf.h2("Welche Daten wir erheben")
pdf.para(
    "Name, Adresse, E-Mail, Gesundheitsdaten: Diagnose/n, Anamnese, Vorerkrankungen, durchgeführte "
    "Behandlungen, Behandlungsverlauf, Bilder, Befunde, personenbezogene Daten, bioelektrische "
    "Messdaten, Daten die durch die 5 Elemente Messung, die Metatron-Analyse (NLS), EAV-Diagnostik, "
    "Laborwerte, das Vieva-Gerät und das Trikombin-Gerät ermittelt wurden, geführte Gespräche und "
    "Dokumentation."
)

pdf.h2("Voraussetzung für die Behandlung")
pdf.para(
    "Die Erhebung von Gesundheitsdaten ist Voraussetzung für Ihre Behandlung. Werden die "
    "notwendigen Informationen nicht erhoben oder bereitgestellt, kann eine sorgfältige Behandlung "
    "durch unsere Praxis nicht erfolgen. Es ist uns ohne Ihre Einwilligung nicht erlaubt, Ihre Daten "
    "zu verarbeiten – und damit nicht möglich, Ihre Anamnese, Ihren Namen, Ihre Krankheiten oder "
    "Ihre Probleme zu notieren. Auch auf E-Mails dürfen wir ohne Ihre Erlaubnis nicht antworten."
)

pdf.h2("Wer bekommt Ihre Daten?")
pdf.para(
    "Wir übermitteln Ihre personenbezogenen Daten nur dann an Dritte, wenn dies gesetzlich erlaubt "
    "ist oder wenn Sie hierzu Ihre Einwilligung erteilt haben. Empfänger können vor allem andere "
    "Heilpraktiker/Ärzte/Psychotherapeuten/Physiotherapeuten, Krankenversicherungen, "
    "Verrechnungsstellen, Steuerberater und Anwälte sein. Die Übermittlung erfolgt überwiegend zum "
    "Zwecke der Abrechnung. Ihre Daten werden nicht an Drittländer übermittelt."
)

pdf.h2("Rechtsgrundlage")
pdf.para(
    "Art. 9 Abs. 2 lit. h DSGVO i.V.m. § 22 Abs. 1 Nr. 1 lit. b BDSG sowie Art. 6 Abs. 1 lit. b "
    "DSGVO (Behandlungsvertrag)."
)

pdf.h2("Speicherdauer")
pdf.para(
    "Wir bewahren Ihre personenbezogenen Daten nur so lange auf, wie dies für die Durchführung der "
    "Behandlung erforderlich ist. Aufgrund rechtlicher Vorgaben sind wir verpflichtet, diese Daten "
    "mindestens 10 Jahre nach Abschluss der Behandlung aufzubewahren (§ 630f BGB). Nach anderen "
    "Vorschriften können sich längere Aufbewahrungsfristen ergeben, z. B. 30 Jahre bei "
    "Röntgenaufzeichnungen (§ 28 Abs. 3 RöV). Abrechnungsdaten und gesundheitsbezogene Analyse-Daten "
    "besitzen 10 Jahre Aufbewahrungspflicht und dürfen vorher nicht gelöscht werden. Danach werden "
    "alle Daten sicher gelöscht."
)

pdf.h2("Ihre Rechte")
pdf.para(
    "Sie haben das Recht auf Auskunft, Berichtigung, Löschung (im Rahmen der gesetzlichen "
    "Aufbewahrungsfristen), Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerruf einer "
    "erteilten Einwilligung. Beschwerderecht bei der zuständigen Aufsichtsbehörde: Bayerisches "
    "Landesamt für Datenschutzaufsicht (BayLDA), Promenade 18, 91522 Ansbach, www.lda.bayern.de."
)

pdf.h2("Newsletter & E-Mail-Kommunikation")
pdf.para(
    "Für die Kommunikation per E-Mail (Anfragen, Terminvergabe, Rechnungen, Bewertungsanfragen etc.) "
    "erheben wir ausschließlich Vor- und Nachnamen sowie Ihre E-Mail-Adresse. Die Daten werden "
    "ausschließlich zu diesem Zweck verwendet und nicht an Dritte weitergegeben. Eine Einwilligung "
    "kann jederzeit widerrufen werden."
)

pdf.h1("III. Einwilligung in die Nutzung medizinischer Daten")
pdf.para(
    "Mit Ihrer Einwilligung erlauben Sie Peter Rauch, Friedrich-Deffner-Straße 19a, 86163 Augsburg, "
    "Ihre medizinischen Daten im Rahmen des bestehenden Behandlungsvertrages zu verarbeiten – d. h. "
    "zu speichern, kopieren, ändern, löschen, verarbeiten, versenden, archivieren. Hierzu gehören "
    "insbesondere: Diagnose(n), Anamnese, Vorerkrankungen, durchgeführte Behandlungen, "
    "Behandlungsverlauf, Bilder, Befunde, personenbezogene Daten, bioelektrische Messdaten, Daten "
    "der 5-Elemente-Messung, der Metatron-Analyse (NLS), der EAV-Diagnostik, Laborwerte, des Vieva- "
    "und des Trikombin-Gerätes, geführte Gespräche und Dokumentation."
)
pdf.para(
    "Die Daten werden ausschließlich zur Erfüllung des Behandlungsvertrages genutzt und – außer in "
    "den gesetzlich geregelten Fällen oder mit ausdrücklicher Einwilligung – nicht an Dritte "
    "weitergegeben."
)
pdf.note(
    "Widerruf jederzeit ohne Angabe von Gründen für die Zukunft möglich per Post oder per E-Mail an "
    "info@rauch-heilpraktiker.de. Der Widerruf berührt nicht die Rechtmäßigkeit der bis dahin "
    "erfolgten Verarbeitung. Eine Behandlung ist ohne Einwilligung nicht möglich."
)

pdf.h1("IV. Einwilligungserklärungen (bitte ankreuzen)")
pdf.consent_box(
    "Ich willige in die Verarbeitung meiner Gesundheitsdaten zum Zweck der Behandlung gemäß Abschnitt "
    "II und III ein (Pflicht für die Behandlung).",
    "ew_gesundheit",
)
pdf.consent_box(
    "Ich willige in die Verarbeitung von Daten aus apparativen Verfahren (Bioresonanz, "
    "Metatron-/NLS-Analyse, EAV, 5-Elemente-Messung, Vieva, Trikombin) ein. Mir ist bekannt, dass "
    "diese Verfahren der Komplementärmedizin zuzuordnen sind, schulmedizinisch nicht anerkannt und "
    "keine medizinische Diagnose ersetzen.",
    "ew_geraete",
)
pdf.consent_box(
    "Ich willige in die E-Mail-Kommunikation zu Terminen, Rechnungen, Anfragen und gelegentlichen "
    "Bewertungsanfragen ein (jederzeit widerrufbar).",
    "ew_email",
)
pdf.consent_box(
    "Ich willige in die Weitergabe meiner Daten an mitbehandelnde Therapeuten/Ärzte ein, soweit dies "
    "für meine Behandlung erforderlich ist (z. B. Befundabgleich, Kooperation).",
    "ew_weitergabe",
)
pdf.consent_box(
    "Ich willige in die Weitergabe meiner Abrechnungsdaten an Krankenversicherung, Beihilfestelle "
    "oder Verrechnungsstelle ein, soweit dies für die Abrechnung erforderlich ist.",
    "ew_abrechnung",
)
pdf.note(
    "Pflichtangabe ist nur die erste Checkbox (Gesundheitsdaten zur Behandlung). Alle weiteren "
    "Einwilligungen sind freiwillig und beeinflussen den Behandlungsvertrag nicht."
)

pdf.h1("V. Unterschrift")
pdf.row([("Ort", "unt_ort", 200), ("Datum", "unt_datum", 130), ("Name in Druckbuchstaben", "unt_name", 200)])
pdf.row([
    ("Bei Minderjährigen: Name Sorgeberechtigte/r", "sorgeberechtigter", 280),
    ("Geburtsdatum Unterzeichner/in", "unt_gebdatum", 200),
])
pdf.signature("Unterschrift Patient/in bzw. Sorgeberechtigte/r", "sig_patient")
pdf.signature("Optional zweite Unterschrift / weiterer Sorgeberechtigter", "sig_zweit", h=42)
pdf.note(
    "Stand: Februar 2026 · Diese Einwilligung wird gemeinsam mit dem Patientenvertrag und dem "
    "ausgefüllten Anamnesebogen Bestandteil Ihrer Behandlungsakte."
)
pdf.save()
