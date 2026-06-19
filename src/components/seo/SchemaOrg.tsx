import { useEffect } from "react";

/**
 * Schema.org structured data for MedicalBusiness
 * Helps Google understand the practice as a medical/health business
 */
const SchemaOrg = () => {
  useEffect(() => {
    const schemaId = "schema-org-medical-business";
    
    // Remove existing schema if present
    const existing = document.getElementById(schemaId);
    if (existing) {
      existing.remove();
    }

    const schema = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "MedicalBusiness",
          "@id": "https://rauch-heilpraktiker.de/#business",
          name: "Naturheilpraxis Peter Rauch",
          alternateName: "Heilpraktiker Peter Rauch",
          description: "Naturheilpraxis für ganzheitliche Therapien, Irisdiagnose, Darmsanierung und individuelle Gesundheitsberatung in Augsburg.",
          url: "https://rauch-heilpraktiker.de",
          telephone: "+49-821-2621462",
          email: "info@rauch-heilpraktiker.de",
          address: {
            "@type": "PostalAddress",
            streetAddress: "Friedrich-Deffner-Straße 19a",
            addressLocality: "Augsburg",
            postalCode: "86163",
            addressCountry: "DE",
            addressRegion: "Bayern"
          },
          geo: {
            "@type": "GeoCoordinates",
            latitude: 48.3561,
            longitude: 10.9056
          },
          openingHoursSpecification: [
            {
              "@type": "OpeningHoursSpecification",
              dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
              opens: "09:00",
              closes: "18:00"
            }
          ],
          priceRange: "€€",
          currenciesAccepted: "EUR",
          paymentAccepted: "Cash, EC Card",
          image: "https://rauch-heilpraktiker.de/og-image.png",
          sameAs: [],
          founder: {
            "@type": "Person",
            "@id": "https://rauch-heilpraktiker.de/#person",
            name: "Peter Rauch",
            jobTitle: "Heilpraktiker",
            description: "Staatlich geprüfter Heilpraktiker nach dem Heilpraktikergesetz"
          },
          medicalSpecialty: [
            "Naturopathy",
            "Holistic Medicine",
            "Alternative Medicine"
          ],
          availableService: [
            {
              "@type": "MedicalTherapy",
              name: "Irisdiagnose",
              description: "Diagnose durch Analyse der Iris"
            },
            {
              "@type": "MedicalTherapy",
              name: "Darmsanierung",
              description: "Ganzheitliche Darmgesundheit und Mikrobiom-Therapie"
            },
            {
              "@type": "MedicalTherapy",
              name: "Entgiftungstherapie",
              description: "Unterstützung der körpereigenen Entgiftungsprozesse"
            }
          ]
        },
        {
          "@type": "WebSite",
          "@id": "https://rauch-heilpraktiker.de/#website",
          url: "https://rauch-heilpraktiker.de",
          name: "Naturheilpraxis Peter Rauch",
          publisher: {
            "@id": "https://rauch-heilpraktiker.de/#business"
          },
          inLanguage: ["de-DE", "en-US"]
        },
        {
          "@type": "BreadcrumbList",
          "@id": "https://rauch-heilpraktiker.de/#breadcrumb",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: "Startseite",
              item: "https://rauch-heilpraktiker.de/"
            }
          ]
        }
      ]
    };

    const script = document.createElement("script");
    script.id = schemaId;
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);

    return () => {
      const scriptToRemove = document.getElementById(schemaId);
      if (scriptToRemove) {
        scriptToRemove.remove();
      }
    };
  }, []);

  return null;
};

export default SchemaOrg;
