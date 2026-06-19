import { Layout } from "@/components/layout/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import { Shield, Lock, Database, Share2, Clock, UserCheck, Mail, Phone, MapPin, Scale, ShieldCheck, AlertCircle, Download, FileText, MessageSquare, HeartPulse, Search, Ban, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { generateDatenschutzPdf } from "@/lib/datenschutzPdfExport";

export default function Datenschutz() {
  const { t, language } = useLanguage();

  const handleDownloadPdf = () => {
    generateDatenschutzPdf({ language });
  };

  const sections = [
    {
      icon: Database,
      title: t("Zweck der Datenverarbeitung", "Purpose of Data Processing"),
      content: t(
        "Die Datenverarbeitung erfolgt, um den Behandlungsvertrag zwischen Ihnen und Ihrem Heilpraktiker erfüllen zu können. Wir verarbeiten Ihre personenbezogenen Daten, insbesondere Ihre Gesundheitsdaten. Dazu zählen Anamnesen, Diagnosen, Therapievorschläge und Befunde, Messungen, Testungen, die wir oder andere Behandlungspersonen (Ärzte/Heilpraktiker usw.) erheben bzw. erhoben haben. Zu diesen Zwecken können uns auch andere Ärzte oder Psychotherapeuten, bei denen Sie in Behandlung sind, Daten zur Verfügung stellen (z.B. in Arztbriefen).",
        "Data processing is carried out to fulfill the treatment contract between you and your practitioner. We process your personal data, in particular your health data. This includes medical histories, diagnoses, therapy suggestions and findings, measurements, tests that we or other treatment providers (doctors/naturopaths, etc.) collect or have collected. For these purposes, other doctors or psychotherapists with whom you are being treated may also provide us with data (e.g. in medical letters)."
      ),
    },
    {
      icon: HeartPulse,
      title: t("Welche Daten wir erheben", "What Data We Collect"),
      content: t(
        "Name, Adresse, E-Mail, Gesundheitsdaten: Diagnose/n, Anamnese, Vorerkrankungen, durchgeführte Behandlungen, Behandlungsverlauf, Bilder, Befunde, personenbezogene Daten, bioelektrische Messdaten, Daten die durch die 5 Elemente Messung, die Metatron Analyse, EAV Diagnostik, Laborwerte, des Vieva Gerätes und des Trikombin Gerätes ermittelt wurden, geführte Gespräche und Dokumentation.",
        "Name, address, email, health data: diagnosis/es, medical history, pre-existing conditions, treatments performed, treatment progress, images, findings, personal data, bioelectric measurement data, data obtained through the 5 Elements Measurement, Metatron Analysis, EAV Diagnostics, laboratory values, Vieva device and Trikombin device, documented conversations and records."
      ),
    },
    {
      icon: Shield,
      title: t("Voraussetzung für die Behandlung", "Prerequisite for Treatment"),
      content: t(
        "Die Erhebung von Gesundheitsdaten ist Voraussetzung für Ihre Behandlung. Werden die notwendigen Informationen nicht erhoben oder bereitgestellt, kann eine sorgfältige Behandlung durch unsere Praxis nicht erfolgen. Es ist uns ohne Ihre Einwilligung nicht erlaubt, Ihre Daten zu verarbeiten – und damit nicht möglich, Ihre Anamnese, Ihren Namen, Ihre Krankheiten oder Ihre Probleme zu notieren. Somit dürfen wir Sie nicht behandeln. Auch auf E-Mails dürfen wir ohne Ihre Erlaubnis nicht antworten.",
        "The collection of health data is a prerequisite for your treatment. If the necessary information is not collected or provided, careful treatment by our practice cannot take place. Without your consent, we are not permitted to process your data – and thus cannot record your medical history, name, illnesses or problems. We would therefore not be allowed to treat you. We are also not permitted to respond to emails without your consent."
      ),
    },
    {
      icon: Share2,
      title: t("Wer bekommt Ihre Daten?", "Who Receives Your Data?"),
      content: t(
        "Wir übermitteln Ihre personenbezogenen Daten nur dann an Dritte, wenn dies gesetzlich erlaubt ist oder wenn Sie hierzu Ihre Einwilligung erteilt haben. Empfänger Ihrer personenbezogenen Daten können vor allem andere Heilpraktiker/Ärzte/Psychotherapeuten/Physiotherapeuten, Krankenversicherungen, Verrechnungsstellen, Steuerberater und Anwälte sein. Die Übermittlung erfolgt überwiegend zum Zwecke der Abrechnung der bei Ihnen erbrachten Leistungen. Die Daten werden außer in den gesetzlich geregelten Fällen nicht an Dritte weitergegeben. Ihre Daten werden nicht an Drittländer übermittelt.",
        "We only transmit your personal data to third parties if this is legally permitted or if you have given your consent. Recipients of your personal data may include other naturopaths/doctors/psychotherapists/physiotherapists, health insurance companies, billing centers, tax advisors and lawyers. Transmission is primarily for billing purposes. Data is not shared with third parties except in legally regulated cases. Your data is not transferred to third countries."
      ),
    },
    {
      icon: Scale,
      title: t("Rechtsgrundlage", "Legal Basis"),
      content: t(
        "Rechtsgrundlage für die Verarbeitung Ihrer Daten ist Art. 9 Abs. 2 h DSGVO i.V.m. § 22 Abs. 1 Nr. 1 b BDSG sowie Art. 6 Abs. 1 b DSGVO (Behandlungsvertrag). Für die 2-Faktor-Authentifizierung: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an Datensicherheit). Die Verarbeitung Ihrer Daten erfolgt auf Basis von gesetzlichen Regelungen. Nur in Ausnahmefällen benötigen wir Ihr Einverständnis.",
        "The legal basis for processing your data is Art. 9(2)(h) GDPR in conjunction with § 22(1)(1)(b) BDSG and Art. 6(1)(b) GDPR (treatment contract). For 2-factor authentication: Art. 6(1)(f) GDPR (legitimate interest in data security). Processing of your data is based on legal regulations. Only in exceptional cases do we need your explicit consent."
      ),
    },
    {
      icon: ShieldCheck,
      title: t("Datensicherheit", "Data Security"),
      content: t(
        "Ihre Daten werden auf unserer Online-Plattform (Lovable) durch folgende Maßnahmen geschützt: TLS-Verschlüsselung bei der Übertragung, verschlüsselte Speicherung in der Datenbank, Zwei-Faktor-Authentifizierung (2FA) per E-Mail, automatische Sitzungsbeendigung und Zugriffskontrolle nach dem Minimalprinzip (nur Sie und der Behandler haben Zugriff). Diese Sicherheitsmaßnahmen betreffen ausschließlich den digitalen Datenverkehr über die Plattform. In der Praxis vor Ort werden Ihre Daten gemäß den berufsrechtlichen Vorgaben für Heilpraktiker aufbewahrt.",
        "Your data is protected on our online platform (Lovable) by: TLS encryption during transmission, encrypted database storage, two-factor authentication (2FA) via email, automatic session termination, and access control based on the principle of least privilege (only you and the practitioner have access). These security measures apply exclusively to digital data traffic via the platform. In the practice, your data is stored in accordance with professional regulations for naturopaths."
      ),
    },
    {
      icon: Clock,
      title: t("Wie lange speichern wir?", "Storage Duration"),
      content: t(
        "Wir bewahren Ihre personenbezogenen Daten nur solange auf, wie dies für die Durchführung der Behandlung erforderlich ist. Aufgrund rechtlicher Vorgaben sind wir allerdings dazu verpflichtet, diese Daten mindestens 10 Jahre nach Abschluss der Behandlung aufzubewahren (§ 630 f BGB). Nach anderen Vorschriften können sich längere Aufbewahrungsfristen ergeben, zum Beispiel 30 Jahre bei Röntgenaufzeichnungen laut Paragraf 28 Absatz 3 der Röntgenverordnung. Bitte beachten Sie, dass Abrechnungsdaten und gesundheitsbezogene Analyse-Daten 10 Jahre Aufbewahrungspflicht besitzen und nicht gelöscht werden dürfen. Danach werden alle Daten sicher gelöscht.",
        "We only retain your personal data for as long as is necessary for carrying out the treatment. However, due to legal requirements, we are obliged to retain this data for at least 10 years after completion of treatment (§ 630 f BGB). Other regulations may result in longer retention periods, for example 30 years for X-ray records pursuant to Section 28(3) of the X-ray Ordinance. Please note that billing data and health-related analysis data must be retained for 10 years and may not be deleted. After that, all data will be securely deleted."
      ),
    },
    {
      icon: UserCheck,
      title: t("Ihre Rechte", "Your Rights"),
      content: t(
        "Sie haben das Recht, über die Sie betreffenden personenbezogenen Daten Auskunft zu erhalten und können die Berichtigung unrichtiger Daten verlangen. Darüber hinaus steht Ihnen unter bestimmten Voraussetzungen das Recht auf Löschung von Daten, das Recht auf Einschränkung der Datenverarbeitung sowie das Recht auf Datenübertragbarkeit zu. In den Fällen, in denen wir Ihr Einverständnis benötigen, haben Sie das Recht, die Einwilligung für die zukünftige Verarbeitung zu widerrufen.",
        "You have the right to receive information about your personal data and can request the correction of incorrect data. In addition, under certain conditions, you have the right to deletion of data, the right to restriction of data processing, and the right to data portability. In cases where we need your consent, you have the right to withdraw consent for future processing."
      ),
    },
    {
      icon: Search,
      title: t("Auskunft über Ihre Daten", "Information About Your Data"),
      content: t(
        "Nach dem BDSG und DSGVO haben Sie ein Recht auf unentgeltliche Auskunft über Ihre gespeicherten Daten, sowie ggf. ein Recht auf Berichtigung, Sperrung oder Löschung von Daten. Um sicherzustellen, dass personenbezogene Daten nicht an Dritte herausgegeben werden, richten Sie Ihre Anfrage bitte per E-Mail oder per Post unter eindeutiger Identifizierung Ihrer Person an: Peter Rauch, Friedrich-Deffner-Straße 19a, 86163 Augsburg.",
        "Under the BDSG and GDPR, you have the right to free information about your stored data, as well as the right to correction, blocking or deletion of data where applicable. To ensure that personal data is not released to third parties, please direct your inquiry by email or post with clear identification of your identity to: Peter Rauch, Friedrich-Deffner-Straße 19a, 86163 Augsburg."
      ),
    },
    {
      icon: Ban,
      title: t("Widerspruchsrecht", "Right of Objection"),
      content: t(
        "Sofern Sie der Erhebung, Verarbeitung oder Nutzung Ihrer Daten durch Peter Rauch nach Maßgabe dieser Datenschutzbestimmungen insgesamt oder für einzelne Maßnahmen widersprechen wollen, können Sie Ihren Widerspruch per E-Mail, Fax oder Brief an folgende Kontaktdaten senden: Peter Rauch, Friedrich-Deffner-Straße 19a, 86163 Augsburg, E-Mail: praxis_rauch@icloud.com.",
        "If you wish to object to the collection, processing or use of your data by Peter Rauch in accordance with these privacy provisions, in whole or for individual measures, you can send your objection by email, fax or letter to: Peter Rauch, Friedrich-Deffner-Straße 19a, 86163 Augsburg, Email: praxis_rauch@icloud.com."
      ),
    },
    {
      icon: Trash2,
      title: t("Löschung", "Deletion"),
      content: t(
        "Daten werden sofort gelöscht, wenn der Zweck erfüllt ist und keine gesetzlichen Gründe mehr widersprechen und wenn Sie einen Löschungsanspruch geltend gemacht haben, wenn die Daten zur Erfüllung des mit der Speicherung verfolgten Zwecks nicht mehr erforderlich sind oder wenn ihre Speicherung aus sonstigen gesetzlichen Gründen unzulässig ist. Bitte beachten Sie, dass Abrechnungsdaten und gesundheitsbezogene Analyse-Daten 10 Jahre Aufbewahrungspflicht besitzen und nicht gelöscht werden dürfen.",
        "Data will be deleted immediately when the purpose has been fulfilled and no legal reasons prevent deletion, when you have asserted a right to deletion, when the data is no longer necessary for the purpose for which it was stored, or when storage is inadmissible for other legal reasons. Please note that billing data and health-related analysis data must be retained for 10 years and may not be deleted."
      ),
    },
    {
      icon: AlertCircle,
      title: t("Beschwerderecht", "Right to Complain"),
      content: t(
        "Sie haben ferner das Recht, sich bei der zuständigen Aufsichtsbehörde für den Datenschutz zu beschweren, wenn Sie der Ansicht sind, dass die Verarbeitung Ihrer personenbezogenen Daten nicht rechtmäßig erfolgt. Zuständige Behörde: Bayerisches Landesamt für Datenschutzaufsicht (BayLDA), Promenade 18, 91522 Ansbach, www.lda.bayern.de",
        "You also have the right to lodge a complaint with the supervisory authority for data protection if you believe that the processing of your personal data is not lawful. Competent authority: Bavarian State Office for Data Protection Supervision (BayLDA), Promenade 18, 91522 Ansbach, www.lda.bayern.de"
      ),
    },
    {
      icon: MessageSquare,
      title: t("Newsletter & E-Mail-Kommunikation", "Newsletter & Email Communication"),
      content: t(
        "Für den Newsletter-Versand und die Kommunikation per E-Mail (Anfragen, Terminvergabe, Rechnungen, Anfragen für eine Bewertung etc.) erheben wir ausschließlich Ihren Vor- und Nachnamen sowie Ihre E-Mail-Adresse. Die Daten werden ausschließlich zum Zwecke des Newsletter-Versandes und der Kommunikation über E-Mail erhoben und gespeichert. Eine Weitergabe der Daten an Dritte erfolgt nicht. Sie haben das Recht, die Einwilligung zur Nutzung Ihrer Daten jederzeit zu widerrufen und sich vom Newsletter-Versand abzumelden.",
        "For newsletter distribution and email communication (inquiries, appointment scheduling, invoices, review requests, etc.), we only collect your first and last name and your email address. The data is collected and stored exclusively for the purpose of newsletter distribution and email communication. Data is not shared with third parties. You have the right to withdraw your consent to the use of your data at any time and to unsubscribe from the newsletter."
      ),
    },
    {
      icon: Shield,
      title: t("Auftragsverarbeiter: Lovable (Plattform-Betreiber)", "Data Processor: Lovable (Platform Operator)"),
      content: t(
        `Dieses Patientenportal wird über die Plattform Lovable (Lovable Labs Incorporated, 1111b South Governors Avenue, Dover, DE 19904, USA; EU-Vertreter: Lovable Labs Sweden AB, Tunnelgatan 5, 11137 Stockholm, Schweden) bereitgestellt. Lovable fungiert als technischer Dienstleister und Auftragsverarbeiter (Art. 28 DSGVO) im Auftrag der Naturheilpraxis Peter Rauch. Ein Auftragsverarbeitungsvertrag (DPA) regelt die Verarbeitung Ihrer Daten.\n\nFolgende Daten werden im Rahmen des Portals verarbeitet: Registrierungsdaten (Name, E-Mail-Adresse, Passwort), Stammdaten (Adresse, Geburtsdatum, Telefon), Gesundheitsangaben (Anamnese, Beschwerden, Vorerkrankungen, Medikamente), Signaturdaten und Protokolldaten (Login-Zeiten, IP-Adressen).\n\nDie Verarbeitung erfolgt zu folgenden Zwecken: Kontoanlage und Authentifizierung, Bereitstellung des Patientenbereichs, Bearbeitung und Speicherung des Anamnesebogens, Termin- und Behandlungsvorbereitung, Dokumentation gemäß § 630f BGB, Erstellung von PDF-Dokumenten.\n\nRechtsgrundlagen: Art. 6 Abs. 1 lit. b DSGVO (Behandlungsvertrag) i.V.m. Art. 9 Abs. 2 lit. h DSGVO und § 22 Abs. 1 Nr. 1 lit. b BDSG (Gesundheitsdaten). Für die 2-Faktor-Authentifizierung: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an Datensicherheit).\n\nLovable bzw. dessen Unterauftragsverarbeiter (insbesondere der Hosting-Anbieter Supabase) können technisch bedingten Zugriff auf Ihre Daten erhalten, soweit dies für Hosting, Wartung, Support und Betrieb der Infrastruktur erforderlich ist. Alle Unterauftragsverarbeiter sind vertraglich an gleichwertige Datenschutzstandards gebunden. Die aktuelle Liste der Unterauftragsverarbeiter ist unter lovable.dev/subprocessors einsehbar.\n\nDrittlandtransfers: Da Lovable seinen Sitz in den USA hat, können Daten in die USA übertragen werden. Diese Transfers sind durch EU-Standardvertragsklauseln (SCCs, Modul 2, Commission Decision 2021/914) und das EU-US Data Privacy Framework abgesichert.\n\nIhre Gesundheitsdaten werden ausschließlich in der verschlüsselten Datenbank gespeichert und NICHT an KI-Dienste, Analysezwecke oder zur Produktverbesserung weitergeleitet. Formulardaten des Anamnesebogens werden direkt in die Datenbank geschrieben ohne jegliche KI-Verarbeitung. Lovable verwendet Ihre personenbezogenen Patientendaten nicht für das Training von KI-Modellen (DPA §10.1).\n\nSpeicherdauer: Ihre Daten werden für die Dauer der Behandlung und danach gemäß den gesetzlichen Aufbewahrungsfristen (mindestens 10 Jahre, § 630f BGB) gespeichert. Nach Vertragsende mit Lovable werden Ihre Daten innerhalb von 30 Tagen gelöscht; in Backups können sie bis zu 90 Tage verbleiben.\n\nDer Datenschutzbeauftragte von Lovable ist erreichbar unter: dpo@lovable.dev. Die zuständige Aufsichtsbehörde für Datenschutzbeschwerden ist das Bayerische Landesamt für Datenschutzaufsicht (BayLDA), Promenade 18, 91522 Ansbach.`,
        `This patient portal is provided through the Lovable platform (Lovable Labs Incorporated, 1111b South Governors Avenue, Dover, DE 19904, USA; EU representative: Lovable Labs Sweden AB, Tunnelgatan 5, 11137 Stockholm, Sweden). Lovable acts as a technical service provider and data processor (Art. 28 GDPR) on behalf of Naturheilpraxis Peter Rauch. A Data Processing Agreement (DPA) governs the processing of your data.\n\nThe following data is processed within the portal: Registration data (name, email, password), personal data (address, date of birth, phone), health data (medical history, complaints, pre-existing conditions, medications), signature data, and log data (login times, IP addresses).\n\nProcessing purposes: Account creation and authentication, provision of the patient area, processing and storage of medical history forms, appointment and treatment preparation, documentation per § 630f BGB, creation of PDF documents.\n\nLegal bases: Art. 6(1)(b) GDPR (treatment contract) in conjunction with Art. 9(2)(h) GDPR and § 22(1)(1)(b) BDSG (health data). For two-factor authentication: Art. 6(1)(f) GDPR (legitimate interest in data security).\n\nLovable and its sub-processors (particularly hosting provider Supabase) may have technical access to your data insofar as this is necessary for hosting, maintenance, support, and infrastructure operation. All sub-processors are contractually bound to equivalent data protection standards. The current list of sub-processors is available at lovable.dev/subprocessors.\n\nInternational transfers: As Lovable is based in the USA, data may be transferred to the USA. These transfers are secured by EU Standard Contractual Clauses (SCCs, Module 2, Commission Decision 2021/914) and the EU-US Data Privacy Framework.\n\nYour health data is stored exclusively in the encrypted database and is NOT forwarded to AI services, analytics purposes, or product improvement. Medical history form data is written directly to the database without any AI processing. Lovable does not use your personal patient data for training AI models (DPA §10.1).\n\nRetention: Your data is stored for the duration of treatment and thereafter in accordance with legal retention periods (minimum 10 years, § 630f BGB). After contract termination with Lovable, your data will be deleted within 30 days; it may remain in backups for up to 90 days.\n\nLovable's Data Protection Officer can be reached at: dpo@lovable.dev. The competent supervisory authority for data protection complaints is the Bavarian State Office for Data Protection Supervision (BayLDA), Promenade 18, 91522 Ansbach.`
      ),
    },
    {
      icon: FileText,
      title: t("Einwilligungen, Pflichtangaben und freiwillige Angaben", "Consent, Mandatory and Voluntary Information"),
      content: t(
        "Im Rahmen des Patientenportals unterscheiden wir zwischen Pflichtangaben und freiwilligen Angaben. Pflichtangaben (mit * gekennzeichnet) sind für die Durchführung der Behandlung und die Erfüllung des Behandlungsvertrags erforderlich: Name, E-Mail-Adresse, Geburtsdatum. Alle weiteren Angaben im Anamnesebogen (z.B. zu Vorerkrankungen, Beschwerden, Medikamenten) sind freiwillig, werden aber für eine sorgfältige Behandlung dringend empfohlen. Ihre Einwilligung zur Verarbeitung Ihrer Gesundheitsdaten erteilen Sie aktiv durch das Setzen der Einwilligungs-Checkbox im Anamnesebogen und die digitale Signatur mit 2-Faktor-Bestätigung. Diese Einwilligung können Sie jederzeit mit Wirkung für die Zukunft widerrufen. Ein Widerruf berührt nicht die Rechtmäßigkeit der bis dahin erfolgten Verarbeitung. Bitte beachten Sie, dass ohne Einwilligung eine Behandlung nicht möglich ist. Gesundheitsdaten unterliegen einem erhöhten Schutzbedarf gemäß Art. 9 DSGVO und werden zu keinem Zeitpunkt nebenbei oder für andere als die oben genannten Zwecke verarbeitet. Es findet kein Profiling, keine automatisierte Entscheidungsfindung und kein Tracking von Gesundheitsdaten statt.",
        "Within the patient portal, we distinguish between mandatory and voluntary information. Mandatory information (marked with *) is required for treatment and fulfillment of the treatment contract: name, email address, date of birth. All other information in the medical history form (e.g., pre-existing conditions, complaints, medications) is voluntary but strongly recommended for thorough treatment. You actively consent to the processing of your health data by checking the consent checkbox in the medical history form and providing your digital signature with 2-factor confirmation. You may withdraw this consent at any time with effect for the future. Withdrawal does not affect the lawfulness of processing carried out prior to withdrawal. Please note that treatment is not possible without consent. Health data is subject to enhanced protection under Art. 9 GDPR and is never processed incidentally or for purposes other than those stated above. There is no profiling, no automated decision-making, and no tracking of health data."
      ),
    },
  ];

  return (
    <Layout mainAriaLabel="Datenschutz">
      <div className="container py-12 md:py-16">
        {/* Header */}
        <div className="mb-12 text-center">
          <div className="mb-4 inline-flex items-center justify-center rounded-full bg-primary/10 p-3">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <h1 className="font-serif text-3xl font-bold text-foreground md:text-4xl">
            {t("Patienteninformationen zum Datenschutz", "Patient Privacy Information")}
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            {t("Naturheilpraxis Peter Rauch", "Naturheilpraxis Peter Rauch")}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button 
              onClick={handleDownloadPdf}
              variant="outline"
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              {t("Info als PDF herunterladen", "Download info as PDF")}
            </Button>
            <a
              href="/datenschutz-einwilligung-blanko.pdf"
              download
              className="inline-flex items-center gap-2 rounded-md border border-primary/30 bg-white px-4 py-2 text-sm font-medium text-primary shadow-sm transition-colors hover:bg-sage-100"
            >
              <FileText className="h-4 w-4" />
              {t("Einwilligung als ausfüllbares PDF", "Consent as fillable PDF")}
            </a>
          </div>
        </div>

        {/* Practice Info */}
        <Card className="mx-auto mb-8 max-w-4xl border-primary/20 bg-sage-50">
          <CardContent className="pt-6">
            <div className="text-center">
              <h2 className="font-serif text-xl font-semibold text-foreground">
                {t("Verantwortliche Person für die Datenverarbeitung", "Person Responsible for Data Processing")}
              </h2>
              <p className="mt-2 text-foreground font-medium">
                Peter Rauch, Heilpraktiker
              </p>
              <div className="mt-3 flex flex-col items-center gap-2 text-muted-foreground sm:flex-row sm:justify-center sm:gap-6">
                <span className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Friedrich-Deffner-Straße 19a, 86163 Augsburg
                </span>
                <span className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  0821-2621462
                </span>
                <span className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  praxis_rauch@icloud.com
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Introduction */}
        <div className="mx-auto mb-8 max-w-4xl">
          <Card className="border-sage-200">
            <CardContent className="pt-6">
              <p className="text-lg leading-relaxed text-foreground">
                {t(
                  "Sehr geehrte Patientin, sehr geehrter Patient, der Schutz Ihrer personenbezogenen Daten ist für uns sehr wichtig. Nach der DSGVO (EU-Datenschutz-Grundverordnung) sind wir verpflichtet, Sie darüber zu informieren, zu welchem Zweck unsere Praxis Daten erhebt, speichert, weiterleitet oder sonst verarbeitet. Der Information können Sie auch entnehmen, welche Rechte Sie haben.",
                  "Dear Patient, the protection of your personal data is very important to us. Under the GDPR (EU General Data Protection Regulation), we are obliged to inform you about the purpose for which our practice collects, stores, forwards or otherwise processes data. You can also find out what rights you have from this information."
                )}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* DSGVO Badge */}
        <div className="mb-8 flex justify-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-sage-100 px-4 py-2 text-sm font-medium text-primary">
            <Lock className="h-4 w-4" />
            {t("DSGVO-konform · TLS-verschlüsselt · 2FA-geschützt", "GDPR Compliant · TLS Encrypted · 2FA Protected")}
          </div>
        </div>

        {/* Content Sections */}
        <div className="mx-auto max-w-4xl space-y-6">
          {sections.map((section, index) => (
            <Card key={index} className="border-sage-200">
              <CardHeader className="flex flex-row items-center gap-4 pb-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <section.icon className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="font-serif text-xl">{section.title}</CardTitle>
              </CardHeader>
              <CardContent className="pl-[4.5rem]">
                <div className="text-muted-foreground leading-relaxed whitespace-pre-line">{section.content}</div>
              </CardContent>
            </Card>
          ))}

          {/* Consent Section - Medical Data */}
          <Card className="border-primary/30 bg-sage-50">
            <CardHeader>
              <CardTitle className="font-serif text-xl">
                {t("Einwilligung in die Nutzung medizinischer Daten", "Consent for Use of Medical Data")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground leading-relaxed">
                {t(
                  "Mit Ihrer Einwilligung erlauben Sie Peter Rauch, Friedrich-Deffner-Straße 19a, 86163 Augsburg, Ihre medizinischen Daten im Rahmen des bestehenden Behandlungsvertrages zu verarbeiten, d.h. speichern, kopieren, ändern, löschen, verarbeiten, versenden, archivieren usw. Hierzu gehören insbesondere: Diagnose/n, Anamnese, Vorerkrankungen, durchgeführte Behandlungen, Behandlungsverlauf, Bilder, Befunde, personenbezogene Daten, bioelektrische Messdaten, Daten die durch die 5 Elemente Messung, die Metatron Analyse, EAV Diagnostik, Laborwerte, des Vieva Gerätes und des Trikombin Gerätes ermittelt wurden, geführte Gespräche und Dokumentation.",
                  "With your consent, you allow Peter Rauch, Friedrich-Deffner-Straße 19a, 86163 Augsburg, to process your medical data within the framework of the existing treatment contract, i.e. store, copy, modify, delete, process, send, archive, etc. This includes in particular: diagnosis/es, medical history, pre-existing conditions, treatments performed, treatment progress, images, findings, personal data, bioelectric measurement data, data obtained through the 5 Elements Measurement, Metatron Analysis, EAV Diagnostics, laboratory values, Vieva device and Trikombin device, documented conversations and records."
                )}
              </p>
              <p className="text-muted-foreground leading-relaxed">
                {t(
                  "Die Daten werden ausschließlich zur Erfüllung des Behandlungsvertrages genutzt und, außer in den gesetzlich geregelten Fällen, insbesondere einer ausdrücklichen Einwilligung Ihrerseits, nicht an Dritte weitergegeben.",
                  "The data is used exclusively for the fulfillment of the treatment contract and, except in legally regulated cases, in particular with your explicit consent, is not shared with third parties."
                )}
              </p>
              <p className="text-sm text-muted-foreground italic">
                {t(
                   "Sie können jederzeit ohne Angabe von Gründen von Ihrem Widerrufsrecht Gebrauch machen und die erteilte Einwilligungserklärung für die Zukunft abändern oder widerrufen. Der Widerruf erfolgt mittels einer Erklärung gegenüber Peter Rauch per Post oder per E-Mail an praxis_rauch@icloud.com. Die Einwilligung erfolgt digital im Rahmen des Anamnesebogens mit 2-Faktor-Bestätigung gemäß § 126a BGB.",
                   "You can exercise your right of withdrawal at any time without giving reasons and modify or revoke the consent given for the future. Withdrawal is made by declaration to Peter Rauch by post or by email to praxis_rauch@icloud.com. Consent is given digitally as part of the medical history form with 2-factor confirmation according to § 126a BGB."
                )}
              </p>
            </CardContent>
          </Card>

          {/* Contact Section */}
          <Card className="border-primary/20 bg-sage-50">
            <CardHeader>
              <CardTitle className="font-serif text-xl">
                {t("Kontakt für Datenschutzanfragen", "Contact for Privacy Inquiries")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                {t(
                  "Bei Fragen zum Datenschutz oder zur Ausübung Ihrer Rechte wenden Sie sich bitte an:",
                  "For questions about data protection or to exercise your rights, please contact:"
                )}
              </p>
              <div className="text-muted-foreground">
                <p className="font-medium text-foreground">Peter Rauch</p>
                <p>Friedrich-Deffner-Straße 19a, 86163 Augsburg</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:gap-6">
                <a
                  href="mailto:info@rauch-heilpraktiker.de"
                  className="inline-flex items-center gap-2 text-primary hover:underline"
                >
                  <Mail className="h-4 w-4" />
                  info@rauch-heilpraktiker.de
                </a>
                <a
                  href="tel:+498212621462"
                  className="inline-flex items-center gap-2 text-primary hover:underline"
                >
                  <Phone className="h-4 w-4" />
                  0821-2621462
                </a>
              </div>
              <p className="text-sm text-muted-foreground italic">
                {t(
                  "Es entstehen dabei keine anderen Kosten als die Portokosten bzw. die Übermittlungskosten nach den geltenden Tarifen.",
                  "No costs other than postal costs or transmission costs according to applicable tariffs will be incurred."
                )}
              </p>
            </CardContent>
          </Card>

          {/* Last Updated */}
          <p className="text-center text-sm text-muted-foreground">
            {t("Stand: Februar 2026", "Last updated: February 2026")}
          </p>
        </div>
      </div>
    </Layout>
  );
}
