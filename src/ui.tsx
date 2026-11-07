import {
  createContext,
  useContext,
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  Bar,
  BarChart as RBarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart as RLineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type Color = "gray" | "purple" | "green" | "yellow" | "cyan" | "pink" | "blue" | "orange" | "red";
type Tone = "success" | "danger" | "warning" | "info" | "neutral";

const colorVar = (c: Color) => `var(--c-${c})`;
const TONE_COLOR: Record<Tone, string> = {
  success: "var(--c-green)",
  danger: "var(--c-red)",
  warning: "var(--c-yellow)",
  info: "var(--c-blue)",
  neutral: "var(--text-tertiary)",
};
const CHART_SEQUENCE: Color[] = ["blue", "orange", "green", "purple", "cyan", "pink", "yellow", "red", "gray"];

const ALIGN = { start: "flex-start", center: "center", end: "flex-end", stretch: "stretch" } as const;
const JUSTIFY = { start: "flex-start", center: "center", end: "flex-end", "space-between": "space-between" } as const;

export function useCanvasState<T>(key: string, defaultValue: T): [T, (v: T | ((prev: T) => T)) => void] {
  const storageKey = `retreat-planner:${key}`;
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw === null ? defaultValue : (JSON.parse(raw) as T);
    } catch {
      return defaultValue;
    }
  });
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(value));
  }, [storageKey, value]);
  return [value, setValue];
}

export function Stack({ children, gap = 12, style }: { children?: ReactNode; gap?: number; style?: CSSProperties }) {
  return <div style={{ display: "flex", flexDirection: "column", gap, minWidth: 0, ...style }}>{children}</div>;
}

export function Row({
  children,
  gap = 8,
  align = "center",
  justify = "start",
  wrap,
  style,
}: {
  children?: ReactNode;
  gap?: number;
  align?: keyof typeof ALIGN;
  justify?: keyof typeof JUSTIFY;
  wrap?: boolean;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap,
        alignItems: ALIGN[align],
        justifyContent: JUSTIFY[justify],
        flexWrap: wrap ? "wrap" : "nowrap",
        minWidth: 0,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Grid({
  children,
  columns,
  gap = 12,
  align = "stretch",
  style,
}: {
  children?: ReactNode;
  columns: number | string;
  gap?: number;
  align?: keyof typeof ALIGN;
  style?: CSSProperties;
}) {
  return (
    <div
      className="grid"
      style={{
        display: "grid",
        gridTemplateColumns: typeof columns === "number" ? `repeat(${columns}, minmax(0, 1fr))` : columns,
        gap,
        alignItems: ALIGN[align],
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Divider() {
  return <hr className="divider" />;
}

const NestedText = createContext(false);

export function Text({
  children,
  tone = "primary",
  size = "body",
  weight = "normal",
  italic,
  as,
  style,
}: {
  children?: ReactNode;
  tone?: "primary" | "secondary" | "tertiary" | "quaternary";
  size?: "body" | "small";
  weight?: "normal" | "medium" | "semibold" | "bold";
  italic?: boolean;
  as?: "p" | "span";
  style?: CSSProperties;
}) {
  const nested = useContext(NestedText);
  const Tag = as ?? (nested ? "span" : "p");
  const weights = { normal: 400, medium: 500, semibold: 600, bold: 700 };
  return (
    <NestedText.Provider value={true}>
      <Tag
        style={{
          margin: 0,
          color: `var(--text-${tone})`,
          fontSize: size === "small" ? 12.5 : 14,
          lineHeight: 1.55,
          fontWeight: weights[weight],
          fontStyle: italic ? "italic" : undefined,
          ...style,
        }}
      >
        {children}
      </Tag>
    </NestedText.Provider>
  );
}

export const H1 = ({ children }: { children?: ReactNode }) => <h1 className="h1">{children}</h1>;
export const H2 = ({ children }: { children?: ReactNode }) => <h2 className="h2">{children}</h2>;
export const H3 = ({ children }: { children?: ReactNode }) => <h3 className="h3">{children}</h3>;

export function Card({ children, style }: { children?: ReactNode; variant?: "default" | "borderless"; style?: CSSProperties }) {
  return (
    <div className="card" style={style}>
      {children}
    </div>
  );
}

export function CardHeader({ children, trailing }: { children?: ReactNode; trailing?: ReactNode }) {
  return (
    <div className="card-header">
      <span>{children}</span>
      {trailing}
    </div>
  );
}

export function CardBody({ children, style }: { children?: ReactNode; style?: CSSProperties }) {
  return (
    <div className="card-body" style={style}>
      {children}
    </div>
  );
}

export function Pill({
  children,
  active,
  size = "md",
  onClick,
}: {
  children?: ReactNode;
  active?: boolean;
  size?: "sm" | "md";
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className={`pill${active ? " active" : ""}${size === "sm" ? " sm" : ""}${onClick ? " clickable" : ""}`}
      onClick={onClick}
    >
      <span className="pill-label">{children}</span>
    </button>
  );
}

export function Stat({ value, label, tone }: { value: ReactNode; label: string; tone?: Exclude<Tone, "neutral"> }) {
  return (
    <div className="stat">
      <div className="stat-value" style={{ color: tone ? TONE_COLOR[tone] : undefined }}>
        {value}
      </div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

export function Callout({ children, tone = "info", title }: { children?: ReactNode; tone?: Tone; title?: ReactNode }) {
  return (
    <div className="callout" style={{ borderLeftColor: TONE_COLOR[tone] }}>
      {title && <div className="callout-title">{title}</div>}
      <div className="callout-body">{children}</div>
    </div>
  );
}

export function Table({
  headers = [],
  rows = [],
  columnAlign = [],
  rowTone = [],
  striped,
}: {
  headers?: ReactNode[];
  rows?: ReactNode[][];
  columnAlign?: Array<"left" | "center" | "right" | undefined>;
  rowTone?: Array<Tone | undefined>;
  striped?: boolean;
}) {
  return (
    <div className="table-wrap">
      <table className={striped ? "striped" : undefined}>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} style={{ textAlign: columnAlign[i] ?? "left" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              {headers.map((_, c) => (
                <td key={c} style={{ textAlign: columnAlign[c] ?? "left" }}>
                  {c === 0 && rowTone[r] && <span className="tone-dot" style={{ background: TONE_COLOR[rowTone[r]!] }} />}
                  {row[c]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TextInput({
  value,
  onChange,
  type = "text",
  placeholder,
  style,
}: {
  value?: string;
  onChange?: (v: string) => void;
  type?: "text" | "number";
  placeholder?: string;
  style?: CSSProperties;
}) {
  return (
    <input
      className="input"
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange?.(e.target.value)}
      style={style}
    />
  );
}

export function Select({
  value,
  onChange,
  options = [],
}: {
  value?: string;
  onChange?: (v: string) => void;
  options?: Array<{ value: string; label: string }>;
}) {
  return (
    <select className="input" value={value} onChange={(e) => onChange?.(e.target.value)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Toggle({ checked, onChange }: { checked?: boolean; onChange?: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`toggle${checked ? " on" : ""}`}
      onClick={() => onChange?.(!checked)}
    >
      <span />
    </button>
  );
}

export function Swatch({ color }: { color: Color }) {
  return <span className="swatch" style={{ background: colorVar(color) }} />;
}

export function UsageBar({
  segments,
  total,
  topLeftLabel,
  topRightLabel,
}: {
  segments: ReadonlyArray<{ id: string; value: number; color?: Color }>;
  total: number;
  topLeftLabel?: ReactNode;
  topRightLabel?: ReactNode;
}) {
  return (
    <Stack gap={6}>
      <Row justify="space-between">
        {topLeftLabel}
        {topRightLabel}
      </Row>
      <div className="usage-bar">
        {segments.map((s) => (
          <div
            key={s.id}
            style={{
              width: `${Math.max(0, (s.value / Math.max(total, 1)) * 100)}%`,
              background: colorVar(s.color ?? "gray"),
            }}
          />
        ))}
      </div>
    </Stack>
  );
}

type Series = { name: string; data: (number | null)[]; tone?: Tone };

const seriesColor = (s: Series, i: number) => (s.tone ? TONE_COLOR[s.tone] : colorVar(CHART_SEQUENCE[i % CHART_SEQUENCE.length]));

const compact = (prefix: string) => (v: number) => {
  const abs = Math.abs(v);
  const body = abs >= 1e6 ? `${(abs / 1e6).toFixed(1)}M` : abs >= 1e3 ? `${Math.round(abs / 1e3)}K` : `${Math.round(abs)}`;
  return `${v < 0 ? "-" : ""}${prefix}${body}`;
};

const tooltipStyle = {
  contentStyle: {
    background: "var(--bg-elevated)",
    border: "1px solid var(--stroke)",
    borderRadius: 6,
    fontSize: 12,
    color: "var(--text-primary)",
  },
  labelStyle: { color: "var(--text-secondary)" },
};

function toRows(categories: string[], series: Series[]) {
  return categories.map((cat, i) => {
    const row: Record<string, string | number | null> = { cat };
    for (const s of series) {
      const v = s.data[i];
      row[s.name] = v == null || !Number.isFinite(v) ? null : v;
    }
    return row;
  });
}

export function LineChart({
  categories = [],
  series = [],
  valuePrefix = "",
  height = 260,
  yFloor,
  fluid,
}: {
  categories?: string[];
  series?: Series[];
  valuePrefix?: string;
  height?: number;
  /** Lowest dollar the axis will show. A deeper shortfall runs off the bottom. */
  yFloor?: number;
  /** Grow the plot with the window instead of using a fixed height. */
  fluid?: boolean;
}) {
  const fmt = compact(valuePrefix);
  const values = series.flatMap((s) => s.data).filter((n): n is number => n != null && Number.isFinite(n));
  const lowest = values.length ? Math.min(...values) : 0;
  const highest = values.length ? Math.max(...values) : 0;
  const yMin = yFloor === undefined ? undefined : Math.max(Math.min(lowest, 0), yFloor);
  const span = Math.max(highest - (yMin ?? 0), 1);
  const yMax = yMin === undefined ? undefined : Math.max(highest, 0) + span * 0.03;
  return (
    <div className={fluid ? "chart-plot" : undefined} style={{ width: "100%", height: fluid ? undefined : height }}>
      <ResponsiveContainer>
        <RLineChart data={toRows(categories, series)} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--stroke)" vertical={false} />
          <XAxis dataKey="cat" tick={{ fill: "var(--text-tertiary)", fontSize: 11 }} stroke="var(--stroke)" interval="preserveStartEnd" />
          <YAxis
            tickFormatter={fmt}
            tick={{ fill: "var(--text-tertiary)", fontSize: 11 }}
            stroke="var(--stroke)"
            width={60}
            domain={yMin === undefined || yMax === undefined ? undefined : [yMin, yMax]}
            allowDataOverflow={yMin !== undefined}
          />
          <Tooltip {...tooltipStyle} formatter={(v) => fmt(Number(v))} labelFormatter={(l) => `Age ${l}`} />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
          <ReferenceLine y={0} stroke="var(--text-tertiary)" strokeDasharray="4 4" />
          {series.map((s, i) => (
            <Line key={s.name} type="monotone" dataKey={s.name} stroke={seriesColor(s, i)} strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
          ))}
        </RLineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BarChart({
  categories = [],
  series = [],
  horizontal,
  stacked,
  valuePrefix = "",
  height = 260,
  yMin,
}: {
  categories?: string[];
  series?: Series[];
  horizontal?: boolean;
  stacked?: boolean;
  valuePrefix?: string;
  height?: number;
  yMin?: number;
  beginAtZero?: boolean;
}) {
  const fmt = compact(valuePrefix);
  const single = series.length === 1;
  const valueAxis = {
    type: "number" as const,
    tickFormatter: fmt,
    tick: { fill: "var(--text-tertiary)", fontSize: 11 },
    stroke: "var(--stroke)",
    domain: [yMin ?? 0, "auto"] as [number, string],
    allowDataOverflow: yMin !== undefined,
  };
  const catAxis = {
    type: "category" as const,
    dataKey: "cat",
    tick: { fill: "var(--text-secondary)", fontSize: 11 },
    stroke: "var(--stroke)",
    interval: 0,
  };
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <RBarChart
          data={toRows(categories, series)}
          layout={horizontal ? "vertical" : "horizontal"}
          margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
        >
          <CartesianGrid stroke="var(--stroke)" horizontal={!horizontal} vertical={!!horizontal} />
          {horizontal ? (
            <>
              <XAxis {...valueAxis} />
              <YAxis {...catAxis} width={150} />
            </>
          ) : (
            <>
              <XAxis {...catAxis} />
              <YAxis {...valueAxis} width={60} />
            </>
          )}
          <Tooltip {...tooltipStyle} formatter={(v) => fmt(Number(v))} cursor={{ fill: "var(--fill)" }} />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
          {series.map((s, i) => (
            <Bar key={s.name} dataKey={s.name} stackId={stacked ? "stack" : undefined} fill={seriesColor(s, i)} isAnimationActive={false}>
              {single && !s.tone &&
                categories.map((c, ci) => <Cell key={c} fill={colorVar(CHART_SEQUENCE[ci % CHART_SEQUENCE.length])} />)}
            </Bar>
          ))}
        </RBarChart>
      </ResponsiveContainer>
    </div>
  );
}
