import { useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

interface SEOHeadProps {
  title?: string;
  description?: string;
  type?: "website" | "article" | "profile";
  image?: string;
  url?: string;
  noIndex?: boolean;
}

/**
 * SEO component that manages meta tags dynamically.
 * For static Schema.org data, see the script in index.html
 */
const SEOHead = ({
  title,
  description,
  type = "website",
  image = "https://id-preview--2a361a45-233a-4659-a3f4-a2f1dda0e86d.lovable.app/og-image.png",
  url,
  noIndex = true,
}: SEOHeadProps) => {
  const { language } = useLanguage();

  const defaultTitle = language === "de" 
    ? "Naturheilpraxis Peter Rauch | Heilpraktiker in Augsburg"
    : "Natural Medicine Practice Peter Rauch | Naturopath in Augsburg";
  
  const defaultDescription = language === "de"
    ? "Naturheilpraxis Peter Rauch in Augsburg – ganzheitliche Therapien, Irisdiagnose, Darmsanierung und individuelle Beratung für Ihre Gesundheit."
    : "Natural Medicine Practice Peter Rauch in Augsburg – holistic therapies, iris diagnosis, intestinal restoration and personalized health consultations.";

  const finalTitle = title ? `${title} | Naturheilpraxis Peter Rauch` : defaultTitle;
  const finalDescription = description || defaultDescription;
  const currentUrl = url || window.location.href;

  useEffect(() => {
    // Update document title
    document.title = finalTitle;

    // Update meta tags
    const updateMeta = (name: string, content: string, property = false) => {
      const selector = property ? `meta[property="${name}"]` : `meta[name="${name}"]`;
      let meta = document.querySelector(selector) as HTMLMetaElement;
      
      if (!meta) {
        meta = document.createElement("meta");
        if (property) {
          meta.setAttribute("property", name);
        } else {
          meta.setAttribute("name", name);
        }
        document.head.appendChild(meta);
      }
      meta.setAttribute("content", content);
    };

    // Standard meta tags
    updateMeta("description", finalDescription);
    updateMeta("author", "Peter Rauch, Heilpraktiker");
    
    if (noIndex) {
      updateMeta("robots", "noindex, nofollow");
    } else {
      updateMeta("robots", "index, follow");
    }

    // Open Graph tags
    updateMeta("og:title", finalTitle, true);
    updateMeta("og:description", finalDescription, true);
    updateMeta("og:type", type, true);
    updateMeta("og:url", currentUrl, true);
    updateMeta("og:image", image, true);
    updateMeta("og:locale", language === "de" ? "de_DE" : "en_US", true);
    updateMeta("og:site_name", "Naturheilpraxis Peter Rauch", true);

    // Twitter Card tags
    updateMeta("twitter:card", "summary_large_image");
    updateMeta("twitter:title", finalTitle);
    updateMeta("twitter:description", finalDescription);
    updateMeta("twitter:image", image);

    // A noindex app route must not claim equivalence with a public website URL.
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (noIndex) {
      canonical?.remove();
    } else {
      if (!canonical) {
        canonical = document.createElement("link");
        canonical.setAttribute("rel", "canonical");
        document.head.appendChild(canonical);
      }
      canonical.setAttribute("href", currentUrl);
    }

    // Cleanup function
    return () => {
      // Reset to defaults when component unmounts (optional)
    };
  }, [finalTitle, finalDescription, type, currentUrl, image, noIndex, language]);

  return null;
};

export default SEOHead;
