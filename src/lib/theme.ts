"use client";

import { useState, useEffect, useCallback } from "react";

export type SystemUiVersion = "dark" | "classic";

export const SHARK_UI_VERSION_KEY = "shark_ui_version";
const THEME_EVENT = "shark-theme-change";

export function getSystemUiVersion(): SystemUiVersion {
  if (typeof window === "undefined") return "dark";
  try {
    const saved = localStorage.getItem(SHARK_UI_VERSION_KEY);
    if (saved === "classic" || saved === "dark") {
      return saved;
    }
  } catch {
    // ignore storage errors
  }
  return "dark";
}

export function applySystemUiVersionToDom(version: SystemUiVersion) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", version);
  if (version === "dark") {
    document.documentElement.classList.add("shark-dark");
    document.documentElement.classList.remove("shark-classic");
  } else {
    document.documentElement.classList.add("shark-classic");
    document.documentElement.classList.remove("shark-dark");
  }
}

export function setSystemUiVersion(version: SystemUiVersion) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SHARK_UI_VERSION_KEY, version);
    document.cookie = `${SHARK_UI_VERSION_KEY}=${version}; path=/; max-age=31536000; SameSite=Lax`;
  } catch {
    // ignore storage errors
  }
  applySystemUiVersionToDom(version);
  window.dispatchEvent(new CustomEvent<SystemUiVersion>(THEME_EVENT, { detail: version }));
}

export function toggleSystemUiVersion(): SystemUiVersion {
  const current = getSystemUiVersion();
  const next: SystemUiVersion = current === "dark" ? "classic" : "dark";
  setSystemUiVersion(next);
  return next;
}

export function useSystemUiVersion() {
  const [version, setVersionState] = useState<SystemUiVersion>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const initial = getSystemUiVersion();
    setVersionState(initial);
    applySystemUiVersionToDom(initial);
    setMounted(true);

    const handleThemeChange = (e: Event) => {
      const customEvent = e as CustomEvent<SystemUiVersion>;
      if (customEvent.detail) {
        setVersionState(customEvent.detail);
      } else {
        setVersionState(getSystemUiVersion());
      }
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === SHARK_UI_VERSION_KEY) {
        const updated = getSystemUiVersion();
        setVersionState(updated);
        applySystemUiVersionToDom(updated);
      }
    };

    window.addEventListener(THEME_EVENT, handleThemeChange);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(THEME_EVENT, handleThemeChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const setVersion = useCallback((v: SystemUiVersion) => {
    setSystemUiVersion(v);
    setVersionState(v);
  }, []);

  const toggleVersion = useCallback(() => {
    const next = toggleSystemUiVersion();
    setVersionState(next);
    return next;
  }, []);

  return {
    version,
    isDark: version === "dark",
    isClassic: version === "classic",
    mounted,
    setVersion,
    toggleVersion,
  };
}
