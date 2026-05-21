import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from "recharts";
import { Clock, CheckCircle2, BookOpen } from "lucide-react";
import type { Subject } from "./subjects";
import { getLessonsForSubject } from "./content";

export type ProgressRow = {
  subject: Subject;
  done: number;
  total: number;
  seconds: number;
  pct: number;
};

export function buildProgressRows(
  subjects: Subject[],
  grade: string,
  perSubject: Record<string, { done: number; seconds: number }>,
): ProgressRow[] {
  return subjects.map(subject => {
    const total = getLessonsForSubject(subject.slug, grade).length;
    const s = perSubject[subject.slug] || { done: 0, seconds: 0 };
    const pct = total > 0 ? Math.round((s.done / total) * 100) : 0;
    return { subject, done: s.done, total, seconds: s.seconds, pct };
  });
}

function fmtTime(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

const PALETTE = [
  "hsl(217 91% 60%)", "hsl(158 64% 42%)", "hsl(36 92% 52%)",
  "hsl(262 70% 58%)", "hsl(24 90% 56%)", "hsl(173 70% 40%)",
  "hsl(330 75% 56%)", "hsl(199 89% 48%)", "hsl(20 14% 40%)", "hsl(76 56% 42%)",
];

export default function ProgressCharts({ rows }: { rows: ProgressRow[] }) {
  const data = rows.map(r => ({
    name: r.subject.name.length > 14 ? r.subject.name.slice(0, 12) + "…" : r.subject.name,
    full: r.subject.name,
    pct: r.pct,
    done: r.done,
    total: r.total,
    minutes: Math.round(r.seconds / 60),
  }));

  const totalDone = rows.reduce((s, r) => s + r.done, 0);
  const totalLessons = rows.reduce((s, r) => s + r.total, 0);
  const totalSeconds = rows.reduce((s, r) => s + r.seconds, 0);
  const overallPct = totalLessons > 0 ? Math.round((totalDone / totalLessons) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* Summary tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SummaryTile icon={<CheckCircle2 className="w-5 h-5" />} label="Overall completion" value={`${overallPct}%`}
          sub={`${totalDone} of ${totalLessons} lessons`} />
        <SummaryTile icon={<Clock className="w-5 h-5" />} label="Total time learned" value={fmtTime(totalSeconds)}
          sub={`across ${rows.length} subjects`} />
        <SummaryTile icon={<BookOpen className="w-5 h-5" />} label="Subjects started" value={`${rows.filter(r => r.done > 0).length}`}
          sub={`of ${rows.length}`} />
      </div>

      {/* Bar chart: % complete per subject */}
      <Card>
        <CardContent className="p-4 sm:p-5 space-y-3">
          <div>
            <h3 className="font-semibold text-sm">Percent complete by subject</h3>
            <p className="text-xs text-muted-foreground">How far you've progressed in each CBC learning area.</p>
          </div>
          <div className="h-64 -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 24 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" interval={0} height={50} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted))" }}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))" }}
                  formatter={(_v, _n, p: any) => [`${p.payload.pct}%  ·  ${p.payload.done}/${p.payload.total}`, p.payload.full]}
                  labelFormatter={() => ""}
                />
                <Bar dataKey="pct" radius={[6, 6, 0, 0]}>
                  {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Bar chart: minutes per subject */}
      <Card>
        <CardContent className="p-4 sm:p-5 space-y-3">
          <div>
            <h3 className="font-semibold text-sm">Time spent (minutes)</h3>
            <p className="text-xs text-muted-foreground">Minutes of active learning, per subject.</p>
          </div>
          <div className="h-56 -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 24 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" interval={0} height={50} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted))" }}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))" }}
                  formatter={(v: any, _n, p: any) => [`${v} min`, p.payload.full]}
                  labelFormatter={() => ""}
                />
                <Bar dataKey="minutes" radius={[6, 6, 0, 0]} fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Detailed rows */}
      <Card>
        <CardContent className="p-4 sm:p-5 space-y-3">
          <div>
            <h3 className="font-semibold text-sm">Subject breakdown</h3>
            <p className="text-xs text-muted-foreground">Lessons finished, time invested, and progress.</p>
          </div>
          <ul className="divide-y">
            {rows.map(r => (
              <li key={r.subject.slug} className="py-3 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full ${r.subject.colorVar} ${r.subject.textVar} flex items-center justify-center text-lg shrink-0`}>
                  {r.subject.icon}
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-sm leading-tight truncate">{r.subject.name}</p>
                    <span className="text-xs font-semibold tabular-nums">{r.pct}%</span>
                  </div>
                  <Progress value={r.pct} className="h-1.5" />
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> {r.done}/{r.total} lessons</span>
                    <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {fmtTime(r.seconds)}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryTile({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">{icon}</div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="text-lg font-bold leading-tight">{value}</p>
          <p className="text-[11px] text-muted-foreground truncate">{sub}</p>
        </div>
      </CardContent>
    </Card>
  );
}
