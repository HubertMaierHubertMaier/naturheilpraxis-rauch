import jsPDF from "jspdf";

type Language = "de" | "en";

interface DatenschutzPdfOptions {
  language: Language;
}

export const generateDatenschutzPdf = ({ language }: DatenschutzPdfOptions) => {
  const t = (de: string, en: string) => (language === "de" ? de : en);
  
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;
  let yPosition = margin;

  const addTitle = (text: string) => {
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(text, pageWidth / 2, yPosition, { align: "center" });
    yPosition += 10;
  };

  const addSubtitle = (text: string) => {
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(text, pageWidth / 2, yPosition, { align: "center" });
    yPosition += 8;
  };

  const addSectionHeader = (text: string) => {
    checkPageBreak(15);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(text, margin, yPosition);
    yPosition += 7;
  };

  const addParagraph = (text: string) => {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(text, contentWidth);
    lines.forEach((line: string) => {
      checkPageBreak(6);
      doc.text(line, margin, yPosition);
      yPosition += 5;
    });
    yPosition += 3;
  };

  const addSpacing = (space: number = 5) => {
    yPosition += space;
  };

  const checkPageBreak = (requiredSpace: number) => {
    if (yPosition + requiredSpace > pageHeight - margin) {
      doc.addPage();
      yPosition = margin;
    }
  };

  const addFooter = () => {
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(
        `${t("Seite", "Page")} ${i} ${t("von", "of")} ${pageCount}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: "center" }
      );
    }
  };

  // Title
  addTitle(t("Patienteninformationen zum Datenschutz", "Patient Privacy Information"));
  addSubtitle("Naturheilpraxis Peter Rauch");
  addSpacing(3);

  // Practice Info
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Friedrich-Deffner-Straße 19a, 86163 Augsburg", pageWidth / 2, yPosition, { align: "center" });
  yPosition += 5;
  doc.text("Tel: 0821-2621462 | E-Mail: praxis_rauch@icloud.com", pageWidth / 2, yPosition, { align: "center" });
  yPosition += 10;

  // DSGVO Badge
  doc.setFillColor(240, 245, 240);
  doc.roundedRect(margin, yPosition - 3, contentWidth, 10, 2, 2, "F");
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(
    t("DSGVO-konform · TLS-verschlüsselt · 2FA-geschützt", "GDPR Compliant · TLS Encrypted · 2FA Protected"),
    pageWidth / 2,
    yPosition + 3,
    { align: "center" }
  );
  yPosition += 15;

  // Introduction
  addParagraph(
    t(
      "Sehr geehrte Patientin, sehr geehrter Patient, der Schutz Ihrer personenbezogenen Daten ist für uns sehr wichtig. Nach der DSGVO (EU-Datenschutz-Grundverordnung) sind wir verpflichtet, Sie darüber zu informieren, zu welchem Zweck unsere Praxis Daten erhebt, speichert, weiterleitet oder sonst verarbeitet. Der Information können Sie auch entnehmen, welche Rechte Sie haben.",
      "Dear Patient, the protection of your personal data is very important to us. Under the GDPR, we are obliged to inform you about the purpose for which our practice collects, stores, forwards or otherwise processes data. You can also find out what rights you have from this information."
    )
  );

  // Sections
  const sections = [
    {
      title: t("Zweck der Datenverarbeitung", "Purpose of Data Processing"),
      content: t(
        "Die Datenverarbeitung erfolgt, um den Behandlungsvertrag zwischen Ihnen und Ihrem Heilpraktiker erfüllen zu können. Wir verarbeiten Ihre personenbezogenen Daten, insbesondere Ihre Gesundheitsdaten. Dazu zählen Anamnesen, Diagnosen, Therapievorschläge und Befunde, Messungen, Testungen, die wir oder andere Behandlungspersonen (Ärzte/Heilpraktiker usw.) erheben bzw. erhoben haben. Zu diesen Zwecken können uns auch andere Ärzte oder Psychotherapeuten, bei denen Sie in Behandlung sind, Daten zur Verfügung stellen (z.B. in Arztbriefen).",
        "Data processing is carried out to fulfill the treatment contract between you and your practitioner. We process your personal data, in particular your health data. This includes medical histories, diagnoses, therapy suggestions and findings, measurements, tests that we or other treatment providers collect or have collected. Other doctors or psychotherapists may also provide us with data (e.g. in medical letters)."
      ),
    },
    {
      title: t("Welche Daten wir erheben", "What Data We Collect"),
      content: t(
        "Name, Adresse, E-Mail, Gesundheitsdaten: Diagnose/n, Anamnese, Vorerkrankungen, durchgeführte Behandlungen, Behandlungsverlauf, Bilder, Befunde, personenbezogene Daten, bioelektrische Messdaten, Daten die durch die 5 Elemente Messung, die Metatron Analyse, EAV Diagnostik, Laborwerte, des Vieva Gerätes und des Trikombin Gerätes ermittelt wurden, geführte Gespräche und Dokumentation.",
        "Name, address, email, health data: diagnoses, medical history, pre-existing conditions, treatments performed, treatment progress, images, findings, personal data, bioelectric measurement data, data from 5 Elements Measurement, Metatron Analysis, EAV Diagnostics, laboratory values, Vieva device and Trikombin device, conversations and documentation."
      ),
    },
    {
      title: t("Voraussetzung für die Behandlung", "Prerequisite for Treatment"),
      content: t(
        "Die Erhebung von Gesundheitsdaten ist Voraussetzung für Ihre Behandlung. Werden die notwendigen Informationen nicht erhoben oder bereitgestellt, kann eine sorgfältige Behandlung durch unsere Praxis nicht erfolgen. Es ist uns ohne Ihre Einwilligung nicht erlaubt, Ihre Daten zu verarbeiten – und damit nicht möglich, Ihre Anamnese, Ihren Namen, Ihre Krankheiten oder Ihre Probleme zu notieren. Somit dürfen wir Sie nicht behandeln. Auch auf E-Mails dürfen wir ohne Ihre Erlaubnis nicht antworten.",
        "The collection of health data is a prerequisite for your treatment. Without your consent, we are not permitted to process your data and thus cannot record your medical history, name, illnesses or problems. We would not be allowed to treat you. We are also not permitted to respond to emails without your consent."
      ),
    },
    {
      title: t("Wer bekommt Ihre Daten?", "Who Receives Your Data?"),
      content: t(
        "Wir übermitteln Ihre personenbezogenen Daten nur dann an Dritte, wenn dies gesetzlich erlaubt ist oder wenn Sie hierzu Ihre Einwilligung erteilt haben. Empfänger Ihrer personenbezogenen Daten können vor allem andere Heilpraktiker/Ärzte/Psychotherapeuten/Physiotherapeuten, Krankenversicherungen, Verrechnungsstellen, Steuerberater und Anwälte sein. Die Übermittlung erfolgt überwiegend zum Zwecke der Abrechnung der bei Ihnen erbrachten Leistungen. Ihre Daten werden nicht an Drittländer übermittelt.",
        "We only transmit your personal data to third parties if legally permitted or with your consent. Recipients may include other practitioners, doctors, psychotherapists, physiotherapists, health insurance companies, billing centers, tax advisors and lawyers. Transmission is primarily for billing purposes. Your data is not transferred to third countries."
      ),
    },
    {
      title: t("Rechtsgrundlage", "Legal Basis"),
      content: t(
        "Rechtsgrundlage für die Verarbeitung Ihrer Daten ist Art. 9 Abs. 2 h DSGVO i.V.m. § 22 Abs. 1 Nr. 1 b BDSG sowie Art. 6 Abs. 1 b DSGVO (Behandlungsvertrag). Für die 2-Faktor-Authentifizierung: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an Datensicherheit).",
        "The legal basis for processing your data is Art. 9(2)(h) GDPR in conjunction with § 22(1)(1)(b) BDSG and Art. 6(1)(b) GDPR (treatment contract). For 2-factor authentication: Art. 6(1)(f) GDPR (legitimate interest in data security)."
      ),
    },
    {
      title: t("Datensicherheit", "Data Security"),
      content: t(
        "Ihre Daten werden auf unserer Online-Plattform (Lovable) durch folgende Maßnahmen geschützt: TLS-Verschlüsselung bei der Übertragung, verschlüsselte Speicherung in der Datenbank, Zwei-Faktor-Authentifizierung (2FA) per E-Mail, automatische Sitzungsbeendigung und Zugriffskontrolle nach dem Minimalprinzip. Diese Sicherheitsmaßnahmen betreffen ausschließlich den digitalen Datenverkehr über die Plattform. In der Praxis vor Ort werden Ihre Daten gemäß den berufsrechtlichen Vorgaben für Heilpraktiker aufbewahrt.",
        "Your data is protected on our online platform (Lovable) by: TLS encryption during transmission, encrypted database storage, two-factor authentication (2FA) via email, automatic session termination, and access control based on the principle of least privilege. These security measures apply exclusively to digital data traffic via the platform. In the practice, your data is stored in accordance with professional regulations for naturopaths."
      ),
    },
    {
      title: t("Wie lange speichern wir?", "Storage Duration"),
      content: t(
        "Wir bewahren Ihre personenbezogenen Daten nur solange auf, wie dies für die Durchführung der Behandlung erforderlich ist. Aufgrund rechtlicher Vorgaben sind wir dazu verpflichtet, diese Daten mindestens 10 Jahre nach Abschluss der Behandlung aufzubewahren (§ 630 f BGB). Nach anderen Vorschriften können sich längere Aufbewahrungsfristen ergeben, zum Beispiel 30 Jahre bei Röntgenaufzeichnungen laut Paragraf 28 Absatz 3 der Röntgenverordnung. Abrechnungsdaten und gesundheitsbezogene Analyse-Daten besitzen 10 Jahre Aufbewahrungspflicht.",
        "We retain your data for as long as necessary for treatment. Legal requirements oblige us to retain data for at least 10 years after treatment (§ 630 f BGB). Longer periods may apply, e.g. 30 years for X-ray records. Billing and health analysis data must be retained for 10 years."
      ),
    },
    {
      title: t("Ihre Rechte", "Your Rights"),
      content: t(
        "Sie haben das Recht, über die Sie betreffenden personenbezogenen Daten Auskunft zu erhalten und können die Berichtigung unrichtiger Daten verlangen. Darüber hinaus steht Ihnen das Recht auf Löschung, Einschränkung der Datenverarbeitung sowie Datenübertragbarkeit zu. In den Fällen, in denen wir Ihr Einverständnis benötigen, haben Sie das Recht, die Einwilligung für die zukünftige Verarbeitung zu widerrufen.",
        "You have the right to receive information about your personal data and can request correction of incorrect data. You also have the right to deletion, restriction of processing and data portability. Where we need your consent, you have the right to withdraw it for future processing."
      ),
    },
    {
      title: t("Auskunft über Ihre Daten", "Information About Your Data"),
      content: t(
        "Nach dem BDSG und DSGVO haben Sie ein Recht auf unentgeltliche Auskunft über Ihre gespeicherten Daten, sowie ggf. ein Recht auf Berichtigung, Sperrung oder Löschung von Daten. Richten Sie Ihre Anfrage bitte per E-Mail oder per Post unter eindeutiger Identifizierung Ihrer Person an: Peter Rauch, Friedrich-Deffner-Straße 19a, 86163 Augsburg.",
        "Under the BDSG and GDPR, you have the right to free information about your stored data, as well as correction, blocking or deletion. Please direct your inquiry by email or post with clear identification to: Peter Rauch, Friedrich-Deffner-Straße 19a, 86163 Augsburg."
      ),
    },
    {
      title: t("Widerspruchsrecht", "Right of Objection"),
      content: t(
        "Sofern Sie der Erhebung, Verarbeitung oder Nutzung Ihrer Daten widersprechen wollen, können Sie Ihren Widerspruch per E-Mail, Fax oder Brief senden an: Peter Rauch, Friedrich-Deffner-Straße 19a, 86163 Augsburg, E-Mail: praxis_rauch@icloud.com.",
        "If you wish to object to the collection, processing or use of your data, you can send your objection by email, fax or letter to: Peter Rauch, Friedrich-Deffner-Straße 19a, 86163 Augsburg, Email: praxis_rauch@icloud.com."
      ),
    },
    {
      title: t("Löschung", "Deletion"),
      content: t(
        "Daten werden sofort gelöscht, wenn der Zweck erfüllt ist und keine gesetzlichen Gründe mehr widersprechen. Bitte beachten Sie, dass Abrechnungsdaten und gesundheitsbezogene Analyse-Daten 10 Jahre Aufbewahrungspflicht besitzen und nicht gelöscht werden dürfen.",
        "Data will be deleted immediately when the purpose has been fulfilled and no legal reasons prevent deletion. Please note that billing and health analysis data must be retained for 10 years and may not be deleted."
      ),
    },
    {
      title: t("Beschwerderecht", "Right to Complain"),
      content: t(
        "Sie haben das Recht, sich bei der zuständigen Aufsichtsbehörde zu beschweren: Bayerisches Landesamt für Datenschutzaufsicht (BayLDA), Promenade 18, 91522 Ansbach, www.lda.bayern.de",
        "You have the right to lodge a complaint with the supervisory authority: Bavarian State Office for Data Protection Supervision (BayLDA), Promenade 18, 91522 Ansbach, www.lda.bayern.de"
      ),
    },
    {
      title: t("Newsletter & E-Mail-Kommunikation", "Newsletter & Email Communication"),
      content: t(
        "Für den Newsletter-Versand und die Kommunikation per E-Mail (Anfragen, Terminvergabe, Rechnungen etc.) erheben wir ausschließlich Ihren Vor- und Nachnamen sowie Ihre E-Mail-Adresse. Eine Weitergabe der Daten an Dritte erfolgt nicht. Sie haben das Recht, die Einwilligung jederzeit zu widerrufen.",
        "For newsletter and email communication (inquiries, appointments, invoices etc.), we only collect your name and email. Data is not shared with third parties. You can withdraw consent at any time."
      ),
    },
    {
      title: t("KI-gestützte Plattform (Lovable)", "AI-Powered Platform (Lovable)"),
      content: t(
        "Diese Website wurde mit Lovable erstellt. Die Plattform verarbeitet technische Daten auf Servern innerhalb der EU. Ihre Gesundheitsdaten werden ausschließlich in unserer eigenen, verschlüsselten Datenbank gespeichert und nicht an Lovable oder Dritte weitergegeben. Lovable hat keinen Zugriff auf Ihre personenbezogenen Daten oder Gesundheitsinformationen.",
        "This website was created with Lovable. The platform processes technical data on EU servers. Your health data is stored exclusively in our own encrypted database and is not shared with Lovable or third parties. Lovable has no access to your personal data or health information."
      ),
    },
  ];

  sections.forEach((section) => {
    addSectionHeader(section.title);
    addParagraph(section.content);
    addSpacing(3);
  });

  // Consent Section
  addSpacing(5);
  addSectionHeader(t("Einwilligung in die Nutzung medizinischer Daten", "Consent for Use of Medical Data"));
  addParagraph(
    t(
      "Mit Ihrer Einwilligung erlauben Sie Peter Rauch, Ihre medizinischen Daten im Rahmen des bestehenden Behandlungsvertrages zu verarbeiten. Hierzu gehören: Diagnose/n, Anamnese, Vorerkrankungen, durchgeführte Behandlungen, Behandlungsverlauf, Bilder, Befunde, bioelektrische Messdaten, Daten der 5 Elemente Messung, Metatron Analyse, EAV Diagnostik, Laborwerte, des Vieva Gerätes und des Trikombin Gerätes, geführte Gespräche und Dokumentation.",
      "With your consent, you allow Peter Rauch to process your medical data within the treatment contract. This includes: diagnoses, medical history, pre-existing conditions, treatments, treatment progress, images, findings, bioelectric measurement data, data from 5 Elements Measurement, Metatron Analysis, EAV Diagnostics, laboratory values, Vieva device and Trikombin device, conversations and documentation."
    )
  );
  addParagraph(
    t(
      "Die Daten werden ausschließlich zur Erfüllung des Behandlungsvertrages genutzt. Sie können jederzeit ohne Angabe von Gründen widerrufen (per Post oder E-Mail an praxis_rauch@icloud.com). Die Einwilligung erfolgt digital mit 2-Faktor-Bestätigung gemäß § 126a BGB.",
      "Data is used exclusively for the treatment contract. You can withdraw at any time without giving reasons (by post or email to praxis_rauch@icloud.com). Consent is given digitally with 2-factor confirmation per § 126a BGB."
    )
  );

  // Contact
  addSpacing(5);
  addSectionHeader(t("Kontakt für Datenschutzanfragen", "Contact for Privacy Inquiries"));
  addParagraph("Peter Rauch, Friedrich-Deffner-Straße 19a, 86163 Augsburg");
  addParagraph("E-Mail: praxis_rauch@icloud.com | Tel: 0821-2621462");
  addParagraph(
    t(
      "Es entstehen dabei keine anderen Kosten als die Portokosten bzw. die Übermittlungskosten nach den geltenden Tarifen.",
      "No costs other than postal or transmission costs according to applicable tariffs will be incurred."
    )
  );

  // Last Updated
  addSpacing(10);
  doc.setFontSize(9);
  doc.setFont("helvetica", "italic");
  doc.text(t("Stand: Februar 2026", "Last updated: February 2026"), pageWidth / 2, yPosition, { align: "center" });

  addFooter();

  const fileName = t("Datenschutzinformation_Naturheilpraxis_Rauch.pdf", "Privacy_Policy_Naturheilpraxis_Rauch.pdf");
  doc.save(fileName);
};
