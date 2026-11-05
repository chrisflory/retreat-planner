import { useEffect, useState } from "react";
import { useCanvasState } from "./ui";

export type ThemeMode = "auto" | "light" | "dark";
type Resolved = "light" | "dark";

const STORAGE_KEY = "retreat-planner:theme";
const inTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const media = window.matchMedia("(prefers-color-scheme: light)");

function browserTheme(): Resolved {
  return media.matches ? "light" : "dark";
}

function apply(theme: Resolved) {
  document.documentElement.dataset.theme = theme;
}

function storedMode(): ThemeMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const v = raw === null ? "auto" : JSON.parse(raw);
    return v === "light" || v === "dark" ? v : "auto";
  } catch {
    return "auto";
  }
}

const initial = storedMode();
apply(initial === "auto" ? browserTheme() : initial);

export function useTheme(): [ThemeMode, (m: ThemeMode) => void] {
  const [mode, setMode] = useCanvasState<ThemeMode>("theme", "auto");
  const [system, setSystem] = useState<Resolved>(browserTheme);

  useEffect(() => {
    const onMedia = () => setSystem(browserTheme());
    media.addEventListener("change", onMedia);
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    if (inTauri) {
      import("@tauri-apps/api/window")
        .then(async ({ getCurrentWindow }) => {
          const win = getCurrentWindow();
          const un = await win.onThemeChanged(({ payload }) => {
            if (storedMode() === "auto") setSystem(payload);
          });
          if (cancelled) un();
          else unlisten = un;
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
      media.removeEventListener("change", onMedia);
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    if (!inTauri) return;
    import("@tauri-apps/api/window")
      .then(async ({ getCurrentWindow }) => {
        const win = getCurrentWindow();
        await win.setTheme(mode === "auto" ? null : mode);
        if (mode === "auto") {
          const t = await win.theme();
          if (t) setSystem(t);
        }
      })
      .catch(() => {});
  }, [mode]);

  useEffect(() => {
    apply(mode === "auto" ? system : mode);
  }, [mode, system]);

  return [mode, setMode];
}
