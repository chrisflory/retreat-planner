import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App, { loadListingIntoPlan } from "./App";
import LandSearch from "./LandSearch";
import { Pill, Row, Text, useCanvasState } from "./ui";
import { useTheme, type ThemeMode } from "./theme";
import "./styles.css";

type Tab = "plan" | "land";

const THEMES: { id: ThemeMode; label: string }[] = [
  { id: "auto", label: "Auto" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];

function Root() {
  const [tab, setTab] = useCanvasState<Tab>("tab", "plan");
  const [theme, setTheme] = useTheme();
  return (
    <>
      <Row gap={8} wrap style={{ padding: "16px 24px 0", maxWidth: 1400, margin: "0 auto" }}>
        <Pill active={tab === "plan"} onClick={() => setTab("plan")}>
          Retirement plan
        </Pill>
        <Pill active={tab === "land"} onClick={() => setTab("land")}>
          Land search
        </Pill>
        <div style={{ flex: 1 }} />
        <Text size="small" tone="tertiary">
          Theme
        </Text>
        {THEMES.map((t) => (
          <Pill key={t.id} size="sm" active={theme === t.id} onClick={() => setTheme(t.id)}>
            {t.label}
          </Pill>
        ))}
      </Row>
      {tab === "plan" ? (
        <App />
      ) : (
        <LandSearch
          onUseInPlan={(state, price, acres) => {
            loadListingIntoPlan(state, price, acres);
            setTab("plan");
          }}
        />
      )}
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
