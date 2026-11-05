import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App, { loadListingIntoPlan } from "./App";
import LandSearch from "./LandSearch";
import { Pill, Row, useCanvasState } from "./ui";
import "./styles.css";

type Tab = "plan" | "land";

function Root() {
  const [tab, setTab] = useCanvasState<Tab>("tab", "plan");
  return (
    <>
      <Row gap={8} style={{ padding: "16px 24px 0", maxWidth: 1400, margin: "0 auto" }}>
        <Pill active={tab === "plan"} onClick={() => setTab("plan")}>
          Retirement plan
        </Pill>
        <Pill active={tab === "land"} onClick={() => setTab("land")}>
          Land search
        </Pill>
      </Row>
      {tab === "plan" ? (
        <App />
      ) : (
        <LandSearch
          onUseInPlan={(state, price) => {
            loadListingIntoPlan(state, price);
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
