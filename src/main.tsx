import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { version as pkgVersion } from "../package.json";
import App, { loadListingIntoPlan } from "./App";
import type { Listing } from "./LandSearch";
import LandSearch from "./LandSearch";
import { Pill, Row, Text, useCanvasState } from "./ui";
import { useTheme, type ThemeMode } from "./theme";
import "./styles.css";

type Tab = "plan" | "sustain" | "land";

const THEMES: { id: ThemeMode; label: string }[] = [
  { id: "auto", label: "Auto" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];

function VersionMark() {
  const [version, setVersion] = useState(pkgVersion);
  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    import("@tauri-apps/api/app")
      .then(({ getVersion }) => getVersion())
      .then((v) => {
        if (v) setVersion(v);
      })
      .catch(() => {});
  }, []);
  return (
    <Text size="small" tone="tertiary">
      v{version}
    </Text>
  );
}

function Root() {
  const [tab, setTab] = useCanvasState<Tab>("tab", "plan");
  const [theme, setTheme] = useTheme();
  return (
    <div className="page">
      <Row gap={8} wrap style={{ marginBottom: 12 }}>
        <Pill active={tab === "plan"} onClick={() => setTab("plan")}>
          Retirement plan
        </Pill>
        <Pill active={tab === "sustain"} onClick={() => setTab("sustain")}>
          Self-reliance
        </Pill>
        <Pill active={tab === "land"} onClick={() => setTab("land")}>
          Land search
        </Pill>
        <div style={{ flex: 1 }} />
        <VersionMark />
        <Text size="small" tone="tertiary">
          Theme
        </Text>
        {THEMES.map((t) => (
          <Pill key={t.id} size="sm" active={theme === t.id} onClick={() => setTheme(t.id)}>
            {t.label}
          </Pill>
        ))}
      </Row>
      {tab === "land" ? (
        <LandSearch
          onUseInPlan={(state, price, acres, listing: Listing) => {
            loadListingIntoPlan(state, price, acres, listing);
            setTab("plan");
          }}
        />
      ) : (
        <App part={tab === "sustain" ? "sustain" : "plan"} />
      )}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
