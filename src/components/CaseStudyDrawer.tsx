import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Scatter,
  Line,
  Area,
  ReferenceLine,
  Label,
  Tooltip,
} from "recharts";

type Candidate = {
  code: string;
  degree: string;
  year: string;
  grit: number;
  uni: string;
  endorsement: string;
  endorser: string;
  traits: string[];
};

// Deterministic pseudo-random clusters
function cluster(seed: number, count: number, xMin: number, xMax: number, yMin: number, yMax: number) {
  const pts: { x: number; y: number }[] = [];
  let s = seed;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  for (let i = 0; i < count; i++) {
    pts.push({
      x: Math.round((xMin + rand() * (xMax - xMin)) * 10) / 10,
      y: Math.round((yMin + rand() * (yMax - yMin)) * 10) / 10,
    });
  }
  return pts;
}

const standardApplicants = cluster(7, 26, 1, 11, 74, 94);
const workingCohort = cluster(21, 22, 18, 38, 66, 86);
const target = [{ x: 25, y: 76 }];

// Green threshold line: descends from 92% at 0h to 60% at 40h
const thresholdLine = (x: number) => 92 - 0.8 * x;
const zoneData = Array.from({ length: 9 }, (_, i) => {
  const x = i * 5;
  const line = thresholdLine(x);
  return { x, base: line, zone: 100 - line };
});

function TargetDot(props: any) {
  const { cx, cy } = props;
  return (
    <circle cx={cx} cy={cy} r={9} fill="#A3E635" stroke="#111111" strokeWidth={3} />
  );
}

export function CaseStudyDrawer({
  candidate,
  credits,
  matched,
  onClose,
  onRequestMatch,
}: {
  candidate: Candidate | null;
  credits: number;
  matched: boolean;
  onClose: () => void;
  onRequestMatch: (code: string) => void;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (candidate) {
      requestAnimationFrame(() => setOpen(true));
    } else {
      setOpen(false);
    }
  }, [candidate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!candidate) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />
      <aside
        className={`absolute right-0 top-0 flex h-full w-full max-w-xl flex-col overflow-y-auto bg-background shadow-2xl transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}
        role="dialog"
        aria-label={`Anonymous case study for ${candidate.code}`}
      >
        <div className="panel-dark sticky top-0 z-10 flex items-center justify-between gap-3 rounded-none p-5">
          <div>
            <p className="font-mono text-sm font-black tracking-wider text-lime">{candidate.code}</p>
            <p className="mt-1 text-xs text-charcoal-foreground/70">
              Full Anonymous Case Study · {candidate.degree} · {candidate.year}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close case study"
            className="rounded-full border border-charcoal-foreground/30 px-3 py-1.5 text-xs font-bold text-charcoal-foreground transition hover:bg-charcoal-foreground/10"
          >
            ✕ Close
          </button>
        </div>

        <div className="space-y-6 p-5 sm:p-6">
          <section>
            <h3 className="text-lg">Relative Opportunity Graph</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Academic marks vs. external life load — this candidate&apos;s performance adjusted for
              real-world context.
            </p>

            <div className="mt-4 h-[380px] w-full rounded-2xl border border-border bg-card p-3">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={zoneData} margin={{ top: 20, right: 20, bottom: 24, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e0" />
                  <XAxis
                    type="number"
                    dataKey="x"
                    domain={[0, 40]}
                    ticks={[0, 10, 20, 30, 40]}
                    tick={{ fontSize: 11 }}
                    label={{
                      value: "External Commitments / Life Load (hrs per week)",
                      position: "bottom",
                      offset: 8,
                      style: { fontSize: 11, fontWeight: 700 },
                    }}
                  />
                  <YAxis
                    type="number"
                    dataKey="y"
                    domain={[55, 100]}
                    ticks={[55, 65, 75, 85, 95, 100]}
                    tick={{ fontSize: 11 }}
                    label={{
                      value: "Academic GPA / Marks (%)",
                      angle: -90,
                      position: "insideLeft",
                      style: { fontSize: 11, fontWeight: 700 },
                    }}
                  />
                  <Tooltip
                    cursor={{ strokeDasharray: "4 4" }}
                    formatter={(value: any, name: any) => [value, name]}
                    labelFormatter={(x: any) => `${x} hrs/week`}
                  />

                  {/* Shaded premium grit zone above threshold */}
                  <Area dataKey="base" stackId="zone" stroke="none" fill="transparent" isAnimationActive={false} />
                  <Area
                    dataKey="zone"
                    stackId="zone"
                    stroke="none"
                    fill="#A3E635"
                    fillOpacity={0.18}
                    isAnimationActive={false}
                  />
                  {/* Green dashed threshold line */}
                  <Line
                    dataKey="base"
                    stroke="#65A30D"
                    strokeWidth={2.5}
                    strokeDasharray="8 6"
                    dot={false}
                    isAnimationActive={false}
                  />

                  {/* Cohorts */}
                  <Scatter name="Standard Applicants" data={standardApplicants} fill="#9CA3AF" />
                  <Scatter name="Working Student Cohort" data={workingCohort} fill="#1F2937" />
                  <Scatter name="Selected Candidate" data={target} shape={<TargetDot />} />

                  {/* Traditional ATS cut-off at 80% GPA */}
                  <ReferenceLine y={80} stroke="#DC2626" strokeWidth={2} strokeDasharray="5 4">
                    <Label
                      value="Traditional ATS Cut-off (Instantly Rejected)"
                      position="insideTopRight"
                      fill="#DC2626"
                      fontSize={10}
                      fontWeight={800}
                    />
                  </ReferenceLine>

                  {/* Labels */}
                  <Label
                    value="PREMIUM GRIT ZONE"
                    position="insideTopLeft"
                    fill="#4D7C0F"
                    fontSize={11}
                    fontWeight={900}
                    offset={14}
                  />
                  <Label
                    value="↘ Actual Performance Adjusted for Context"
                    position="insideBottomRight"
                    fill="#1F2937"
                    fontSize={10}
                    fontWeight={800}
                    offset={40}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[11px] font-semibold text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-gray-400" /> Standard Applicants
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-charcoal" /> Working Student Cohort
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-black bg-lime" />{" "}
                Selected Candidate (25 hrs · 76% GPA)
              </span>
            </div>
          </section>

          <section className="panel-light p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-charcoal">
                  {candidate.degree} · {candidate.year}
                </p>
                <p className="text-xs text-muted-foreground">{candidate.uni}</p>
              </div>
              <div className="text-right">
                <p className="font-display text-2xl font-black">{candidate.grit}</p>
                <p className="text-[10px] font-bold text-muted-foreground">GRIT INDEX</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {candidate.traits.map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground"
                >
                  {t}
                </span>
              ))}
            </div>
            <blockquote className="mt-4 rounded-2xl border-l-4 border-lime bg-secondary/60 p-4">
              <p className="text-sm italic text-secondary-foreground">“{candidate.endorsement}”</p>
              <footer className="mt-2 text-xs font-bold text-muted-foreground">
                ✓ Verified — {candidate.endorser}
              </footer>
            </blockquote>
          </section>

          <button
            onClick={() => onRequestMatch(candidate.code)}
            disabled={matched}
            className={`w-full rounded-full px-4 py-3.5 text-sm font-black transition ${
              matched
                ? "border-2 border-lime bg-lime/20 text-charcoal"
                : "bg-lime text-lime-foreground hover:brightness-105 disabled:opacity-50"
            }`}
          >
            {matched
              ? "🤝 Handshake Pending — 1 Credit Used"
              : credits > 0
                ? "🪙 REQUEST MATCH & UNLOCK | 1 Credit"
                : "No Match Credits Remaining"}
          </button>
        </div>
      </aside>
    </div>
  );
}
