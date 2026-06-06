const DEV_ADMIN_BYPASS_KEY = "dev_admin_bypass";

export const isDevAdminBypassAllowedHost = (hostname: string, isDevBuild: boolean) => {
  if (!isDevBuild) return false;

  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
};

export const isDevHost = () => {
  if (typeof window === "undefined") return false;

  return isDevAdminBypassAllowedHost(window.location.hostname, import.meta.env.DEV);
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