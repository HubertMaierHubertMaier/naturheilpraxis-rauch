"""
Erzeugt einen vollständig ausfüllbaren Anamnesebogen (AcroForm-PDF).
Patient öffnet im kostenlosen Adobe Reader, füllt aus, speichert/druckt.
Unterschrift NICHT digital -> handschriftlich nach Ausdruck (rechtssicher § 126 BGB).
"""
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, black, white
from reportlab.pdfbase import pdfform

OUT = "public/anamnesebogen-blanko.pdf"
W, H = A4
M = 40  # margin

SAGE = HexColor("#5b8a72")
SAGE_LIGHT = HexColor("#e8f0ea")
SAND = HexColor("#f5efe6")
INK = HexColor("#2a2a2a")
MUTED = HexColor("#666666")

class Form:
    def __init__(self, path):
        self.c = canvas.Canvas(path, pagesize=A4)
        self.c.setTitle("Anamnesebogen – Naturheilpraxis Peter Rauch")
        self.c.setAuthor("Naturheilpraxis Peter Rauch")
        self.c.setSubject("Anamnesebogen zum Ausfüllen am PC")
        self.y = H - M
        self.page_num = 1

    def new_page(self):
        self._footer()
        self.c.showPage()
        self.page_num += 1
        self.y = H - M
        self._header(first=False)

    def ensure(self, needed):
        if self.y - needed < M + 30:
            self.new_page()

    def _header(self, first=True):
        # Sage bar
        self.c.setFillColor(SAGE)
        self.c.rect(0, H - 60, W, 60, fill=1, stroke=0)
        self.c.setFillColor(white)
        self.c.setFont("Helvetica-Bold", 14)
        self.c.drawString(M, H - 30, "Naturheilpraxis Peter Rauch")
        self.c.setFont("Helvetica", 9)
        self.c.drawString(M, H - 45, "Friedrich-Deffner-Straße 19a · 86163 Augsburg · Tel. 0821-2621462 · info@rauch-heilpraktiker.de")
        self.c.setFont("Helvetica-Bold", 11)
        self.c.drawRightString(W - M, H - 30, "ANAMNESEBOGEN")
        self.c.setFont("Helvetica", 8)
        self.c.drawRightString(W - M, H - 45, "zum Ausfüllen am PC")
        self.y = H - 80

    def _footer(self):
        self.c.setFillColor(MUTED)
        self.c.setFont("Helvetica", 8)
        self.c.drawString(M, 20, "Heilpraktiker Peter Rauch · www.rauch-heilpraktiker.de")
        self.c.drawRightString(W - M, 20, f"Seite {self.page_num}")
        self.c.setStrokeColor(SAGE)
        self.c.setLineWidth(0.5)
        self.c.line(M, 32, W - M, 32)

    def h1(self, txt):
        self.ensure(34)
        self.c.setFillColor(SAGE_LIGHT)
        self.c.rect(M, self.y - 22, W - 2 * M, 22, fill=1, stroke=0)
        self.c.setFillColor(SAGE)
        self.c.setFont("Helvetica-Bold", 11)
        self.c.drawString(M + 8, self.y - 15, txt)
        self.y -= 30

    def h2(self, txt):
        self.ensure(18)
        self.c.setFillColor(SAGE)
        self.c.setFont("Helvetica-Bold", 9.5)
        self.c.drawString(M, self.y - 10, txt)
        self.y -= 14

    def note(self, txt):
        self.ensure(14)
        self.c.setFillColor(MUTED)
        self.c.setFont("Helvetica-Oblique", 8)
        self.c.drawString(M, self.y - 9, txt)
        self.y -= 12

    def text(self, label, name, width=200, height=14):
        """Einzeiliges Textfeld + Label."""
        self.ensure(height + 4)
        self.c.setFillColor(INK)
        self.c.setFont("Helvetica", 9)
        self.c.drawString(M, self.y - 10, label)
        self.c.acroForm.textfield(
            name=name, tooltip=label,
            x=M + 120, y=self.y - height,
            width=width, height=height,
            borderWidth=0.5, borderColor=MUTED,
            fillColor=white, textColor=INK,
            fontSize=9, fieldFlags=0,
        )
        self.y -= height + 4

    def text_row(self, fields):
        """Mehrere Felder nebeneinander: [(label, name, width)]"""
        height = 14
        self.ensure(height + 12)
        x = M
        # Labels
        self.c.setFillColor(INK)
        self.c.setFont("Helvetica", 9)
        for label, _name, w in fields:
            self.c.drawString(x, self.y - 10, label)
            x += w + 10
        # Fields below
        self.y -= 12
        x = M
        for _label, name, w in fields:
            self.c.acroForm.textfield(
                name=name, tooltip=_label,
                x=x, y=self.y - height, width=w, height=height,
                borderWidth=0.5, borderColor=MUTED,
                fillColor=white, textColor=INK, fontSize=9,
            )
            x += w + 10
        self.y -= height + 6

    def multiline(self, label, name, lines=4):
        height = lines * 14
        self.ensure(height + 18)
        self.c.setFillColor(INK)
        self.c.setFont("Helvetica", 9)
        self.c.drawString(M, self.y - 10, label)
        self.y -= 14
        self.c.acroForm.textfield(
            name=name, tooltip=label,
            x=M, y=self.y - height, width=W - 2 * M, height=height,
            borderWidth=0.5, borderColor=MUTED,
            fillColor=white, textColor=INK, fontSize=9,
            fieldFlags="multiline",
        )
        self.y -= height + 6

    def checkbox(self, label, name, x=None):
        """Einzel-Checkbox in einer Zeile."""
        self.ensure(16)
        if x is None:
            x = M
        self.c.acroForm.checkbox(
            name=name, tooltip=label,
            x=x, y=self.y - 12, size=11,
            borderWidth=0.5, borderColor=MUTED, fillColor=white,
        )
        self.c.setFillColor(INK)
        self.c.setFont("Helvetica", 9)
        self.c.drawString(x + 16, self.y - 10, label)
        self.y -= 16

    def checkbox_grid(self, items, cols=3):
        """items = [(label, name)] – Mehrere Checkboxen in Spalten."""
        col_w = (W - 2 * M) / cols
        rows = (len(items) + cols - 1) // cols
        height = rows * 16
        self.ensure(height + 4)
        for i, (label, name) in enumerate(items):
            r, col = divmod(i, cols)
            x = M + col * col_w
            y = self.y - 12 - r * 16
            self.c.acroForm.checkbox(
                name=name, tooltip=label,
                x=x, y=y, size=10,
                borderWidth=0.5, borderColor=MUTED, fillColor=white,
            )
            self.c.setFillColor(INK)
            self.c.setFont("Helvetica", 8.5)
            self.c.drawString(x + 14, y + 2, label[:38])
        self.y -= height + 6

    def spacer(self, h=8):
        self.y -= h

    def save(self):
        self._footer()
        self.c.save()


f = Form(OUT)
f._header(first=True)

# ============================================================
# I. STAMMDATEN
# ============================================================
f.h1("I. Stammdaten")
f.text_row([("Vorname", "vorname", 220), ("Nachname", "nachname", 240)])
f.text_row([("Geburtsdatum", "geburtsdatum", 100), ("Geburtsort", "geburtsort", 150), ("Beruf", "beruf", 180)])
f.text("Straße, Hausnr.", "strasse", width=395)
f.text_row([("PLZ", "plz", 60), ("Ort", "ort", 200), ("Telefon", "telefon", 180)])
f.text_row([("Mobil", "mobil", 180), ("E-Mail", "email", 270)])
f.text("Krankenversicherung", "versicherung", width=395)
f.text_row([("Größe (cm)", "groesse", 80), ("Gewicht (kg)", "gewicht", 80), ("Blutgruppe", "blutgruppe", 80)])
f.text("Hausarzt (Name / Ort)", "hausarzt", width=395)
f.spacer()
f.text("Empfohlen von", "empfehlung", width=395)

# ============================================================
# II. AKTUELLE BESCHWERDEN
# ============================================================
f.h1("II. Aktuelle Beschwerden")
f.multiline("Was führt Sie zu mir? Bitte beschreiben Sie Ihre Hauptbeschwerden:", "hauptbeschwerden", lines=5)
f.text_row([("Seit wann?", "beschwerden_seit", 180), ("Auslöser bekannt?", "ausloeser", 230)])
f.multiline("Was lindert / verschlimmert die Beschwerden?", "linderung", lines=3)
f.multiline("Bisherige Behandlungen / Diagnosen:", "vorbehandlungen", lines=4)

f.new_page()

# ============================================================
# III. FAMILIENGESCHICHTE
# ============================================================
f.h1("III. Familienanamnese")
f.note("Kommen folgende Erkrankungen in Ihrer Familie vor (Eltern, Geschwister, Großeltern)?")
f.checkbox_grid([
    ("Hoher Blutdruck", "fam_blutdruck"),
    ("Herzinfarkt", "fam_herzinfarkt"),
    ("Schlaganfall", "fam_schlaganfall"),
    ("Diabetes", "fam_diabetes"),
    ("Krebs", "fam_krebs"),
    ("Allergien", "fam_allergien"),
    ("Asthma", "fam_asthma"),
    ("Autoimmun-Erkrankungen", "fam_autoimmun"),
    ("Nervenleiden (Parkinson, MS)", "fam_neuro"),
    ("Depression / Psyche", "fam_psyche"),
    ("Suchterkrankungen", "fam_sucht"),
    ("Gicht / Rheuma", "fam_rheuma"),
], cols=3)
f.multiline("Sonstige familiäre Erkrankungen / Bemerkungen:", "fam_sonstige", lines=2)

# ============================================================
# IV. EIGENE VORERKRANKUNGEN
# ============================================================
f.h1("IV. Eigene Vorerkrankungen")
f.checkbox_grid([
    ("Bluthochdruck", "vor_blutdruck"),
    ("Herzerkrankung", "vor_herz"),
    ("Diabetes", "vor_diabetes"),
    ("Schilddrüse", "vor_schilddruese"),
    ("Asthma / COPD", "vor_lunge"),
    ("Magen / Darm", "vor_magen"),
    ("Leber / Galle", "vor_leber"),
    ("Niere / Blase", "vor_niere"),
    ("Rheuma / Gelenke", "vor_rheuma"),
    ("Hauterkrankung", "vor_haut"),
    ("Allergien", "vor_allergien"),
    ("Migräne", "vor_migraene"),
    ("Krebs", "vor_krebs"),
    ("Hepatitis", "vor_hepatitis"),
    ("Borreliose", "vor_borreliose"),
    ("Depression / Burnout", "vor_psyche"),
    ("Schlafstörungen", "vor_schlaf"),
    ("Autoimmun-Erkrankung", "vor_autoimmun"),
], cols=3)
f.multiline("Details / weitere Erkrankungen (mit Jahr):", "vor_details", lines=4)

# ============================================================
# V. OPERATIONEN / UNFÄLLE
# ============================================================
f.h1("V. Operationen und Unfälle")
f.multiline("Operationen (Art, Jahr):", "operationen", lines=4)
f.multiline("Unfälle / Verletzungen (Art, Jahr):", "unfaelle", lines=3)

f.new_page()

# ============================================================
# VI. MEDIKAMENTE & NAHRUNGSERGÄNZUNG
# ============================================================
f.h1("VI. Medikamente / Nahrungsergänzung")
f.multiline("Welche Medikamente nehmen Sie regelmäßig? (Name, Dosis, Häufigkeit)", "medikamente", lines=5)
f.multiline("Nahrungsergänzungsmittel / Vitamine / Mineralstoffe:", "nem", lines=4)
f.multiline("Homöopathische / pflanzliche Mittel:", "naturmittel", lines=3)

# ============================================================
# VII. ALLERGIEN & UNVERTRÄGLICHKEITEN
# ============================================================
f.h1("VII. Allergien und Unverträglichkeiten")
f.checkbox_grid([
    ("Pollen / Heuschnupfen", "all_pollen"),
    ("Hausstaub / Milben", "all_milben"),
    ("Tierhaare", "all_tier"),
    ("Insektenstiche", "all_insekt"),
    ("Nahrungsmittel", "all_food"),
    ("Medikamente", "all_med"),
    ("Latex", "all_latex"),
    ("Nickel / Metalle", "all_metall"),
    ("Schimmelpilze", "all_schimmel"),
], cols=3)
f.multiline("Details (welche Stoffe, Reaktion, Schwere):", "all_details", lines=4)

# ============================================================
# VIII. LEBENSSTIL
# ============================================================
f.h1("VIII. Lebensstil")
f.text_row([("Rauchen (Zig./Tag)", "rauchen", 100), ("seit Jahr", "rauchen_seit", 80), ("aufgehört Jahr", "rauchen_ende", 100)])
f.text_row([("Alkohol (Häufigkeit / Menge)", "alkohol", 200), ("Kaffee (Tassen/Tag)", "kaffee", 100)])
f.text_row([("Sport / Bewegung pro Woche", "sport", 220), ("Schlaf (h/Nacht)", "schlaf", 80)])
f.multiline("Ernährungsweise (Mischkost, vegetarisch, vegan, Unverträglichkeiten, Besonderheiten):", "ernaehrung", lines=3)
f.multiline("Stress-Level / Beruflich-private Belastungen:", "stress", lines=3)

f.new_page()

# ============================================================
# IX. FRAUEN / MÄNNER
# ============================================================
f.h1("IX. Frauen- bzw. Männergesundheit")
f.note("Nur ausfüllen, was zutrifft.")
f.h2("Frauen:")
f.text_row([("Letzte Periode", "menstruation_letzte", 100), ("Zyklus (Tage)", "zyklus", 80), ("Beschwerden?", "menstruation_beschwerden", 200)])
f.text_row([("Schwangerschaften", "schwangerschaften", 80), ("Geburten", "geburten", 80), ("Fehlgeburten", "fehlgeburten", 80)])
f.text("Wechseljahre / Hormontherapie", "wechseljahre", width=395)
f.h2("Männer:")
f.text("Prostata-Beschwerden / PSA-Wert / letzte Vorsorge", "prostata", width=395)

# ============================================================
# X. ZAHNGESUNDHEIT / UMWELT
# ============================================================
f.h1("X. Zahngesundheit und Umweltbelastungen")
f.checkbox_grid([
    ("Amalgam-Füllungen", "zahn_amalgam"),
    ("Gold im Mund", "zahn_gold"),
    ("Kunststoff / Komposit", "zahn_kunststoff"),
    ("Wurzelbehandlung(en)", "zahn_wurzel"),
    ("Implantate", "zahn_implantat"),
    ("Zahnschiene / Bruxismus", "zahn_bruxismus"),
    ("Schimmel in Wohnung", "umw_schimmel"),
    ("Elektrosmog / WLAN nahe Bett", "umw_elektro"),
    ("Berufliche Schadstoffe", "umw_beruf"),
], cols=3)
f.multiline("Details Zahn / Umwelt:", "zahn_umwelt_details", lines=3)

# ============================================================
# XI. IMPFUNGEN / INFEKTIONEN
# ============================================================
f.h1("XI. Impfungen und durchgemachte Infektionen")
f.multiline("Letzte Impfungen (Art, Jahr):", "impfungen", lines=3)
f.multiline("Durchgemachte Infektionen (Borreliose, Pfeiffer'sches Drüsenfieber, Herpes, Corona, etc.):", "infektionen", lines=3)

f.new_page()

# ============================================================
# XII. BEHANDLUNGSPRÄFERENZEN & SONSTIGES
# ============================================================
f.h1("XII. Behandlungspräferenzen")
f.note("Welche Verfahren interessieren Sie besonders / haben Sie schon ausprobiert?")
f.checkbox_grid([
    ("Bioresonanz / Frequenztherapie", "pref_bioresonanz"),
    ("NLS-Diagnostik (Metatron)", "pref_nls"),
    ("EAV", "pref_eav"),
    ("Homöopathie", "pref_homoeopathie"),
    ("NAET (Allergien)", "pref_naet"),
    ("Orthomolekular", "pref_ortho"),
    ("Manuelle Therapie / Osteopathie", "pref_manuell"),
    ("Hypnose", "pref_hypnose"),
    ("Qigong / Entspannung", "pref_qigong"),
], cols=3)

f.h1("XIII. Persönliches / Sonstiges")
f.multiline("Was sollte ich sonst noch über Sie wissen? (Wünsche, Ängste, Erwartungen)", "sonstiges", lines=5)

# ============================================================
# XIV. UNTERSCHRIFT
# ============================================================
f.h1("XIV. Unterschrift")
f.note("Hinweis: Bitte das ausgefüllte PDF AUSDRUCKEN und unten HANDSCHRIFTLICH unterschreiben (rechtssicher nach § 126 BGB).")
f.note("Die Unterschrift kann am Computer NICHT eingegeben werden – bewusst zur Rechtssicherheit.")
f.spacer(6)
f.text_row([("Ort", "ort_unterschrift", 180), ("Datum", "datum_unterschrift", 120)])
f.spacer(20)

# Signature line (handgeschrieben)
f.ensure(60)
f.c.setStrokeColor(MUTED)
f.c.setLineWidth(0.7)
f.c.line(M, f.y - 30, M + 280, f.y - 30)
f.c.setFillColor(MUTED)
f.c.setFont("Helvetica", 8)
f.c.drawString(M, f.y - 42, "Unterschrift Patient/in (handschriftlich nach Ausdruck)")
f.c.line(W - M - 280, f.y - 30, W - M, f.y - 30)
f.c.drawString(W - M - 280, f.y - 42, "Bei Minderjährigen: Unterschrift Erziehungsberechtigte/r")
f.y -= 60

f.note("Datenschutz: Die DSGVO-Einwilligung wird über ein separates Dokument geregelt.")
f.note("Bitte bringen Sie diesen Bogen ausgedruckt und unterschrieben zum Erstgespräch mit – oder scannen ein und mailen ihn an info@rauch-heilpraktiker.de")

f.save()
print(f"✅ PDF erstellt: {OUT}")

# Verify form fields
from pypdf import PdfReader
r = PdfReader(OUT)
fields = r.get_fields()
print(f"📋 Interaktive Felder: {len(fields) if fields else 0}")
print(f"📄 Seiten: {len(r.pages)}")
