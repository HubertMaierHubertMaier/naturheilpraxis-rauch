const DEV_ADMIN_BYPASS_KEY = "dev_admin_bypass";

export const isDevHost = () => {
  if (typeof window === "undefined") return false;

  const hostname = window.location.hostname;
  const isNonProduction =
    import.meta.env.DEV ||
    hostname.includes("preview") ||
    hostname.includes("lovableproject.com") ||
    hostname.includes("localhost");

  const isPublishedProduction =
    hostname === "naturheilpraxis-rauch.lovable.app" ||
    hostname === "www.rauch-heilpraktiker.de" ||
    hostname === "rauch-heilpraktiker.de";

  return isNonProduction && !isPublishedProduction;
};

export const activateDevAdminBypass = () => {
  if (!isDevHost()) return false;

  try {
    localStorage.setItem(DEV_ADMIN_BYPASS_KEY, "true");
    sessionStorage.setItem(DEV_ADMIN_BYPASS_KEY, "true");
  } catch {
    return false;
  }

  return true;
};

export const clearDevAdminBypass = () => {
  try {
    localStorage.removeItem(DEV_ADMIN_BYPASS_KEY);
    sessionStorage.removeItem(DEV_ADMIN_BYPASS_KEY);
  } catch {
    // Ignore storage failures in restricted browsers.
  }
};

export const isDevAdminBypassActive = () => {
  if (!isDevHost()) return false;

  try {
    const urlHasDev = new URLSearchParams(window.location.search).get("dev") === "true";
    if (urlHasDev) return activateDevAdminBypass();

    return (
      localStorage.getItem(DEV_ADMIN_BYPASS_KEY) === "true" ||
      sessionStorage.getItem(DEV_ADMIN_BYPASS_KEY) === "true"
    );
  } catch {
    return false;
  }
};

export const withDevParam = (path: string) => {
  if (!isDevAdminBypassActive()) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}dev=true`;
};