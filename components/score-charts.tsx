"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const categoryColors: Record<string, string> = {
  BOM: "#059669",
  ACEITAVEL: "#2563eb",
  EM_RISCO: "#d97706",
  CRITICO: "#dc2626",
};

export function scoreColor(categoria: string) {
  return categoryColors[categoria] ?? "#64748b";
}

/** Score geral em anel radial (0-100). */
export function ScoreRadial({ score, categoria }: { score: number; categoria: string }) {
  const color = scoreColor(categoria);
  return (
    <div className="relative mx-auto h-52 w-52">
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart cx="50%" cy="50%" innerRadius="70%" outerRadius="100%" data={[{ value: score }]} startAngle={90} endAngle={-270}>
          <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
          <RadialBar dataKey="value" cornerRadius={12} fill={color} background={{ fill: "#e2e8f0" }} angleAxisId={0} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold" style={{ color }}>{score}</span>
        <span className="text-xs font-semibold text-slate-500">/ 100</span>
      </div>
    </div>
  );
}

/** Score por categoria (barras horizontais, peso máximo por categoria). */
export function CategoryScoreChart({
  data,
}: {
  data: { label: string; score: number; weight: number; incomplete: boolean }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={data.length * 44}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
        <XAxis type="number" domain={[0, 20]} tick={{ fontSize: 11, fill: "#475569" }} />
        <YAxis
          type="category"
          dataKey="label"
          width={190}
          tick={{ fontSize: 11, fill: "#334155" }}
          tickFormatter={(label: string, index: number) => `${label}${data[index]?.incomplete ? " ⚠︎" : ""}`}
        />
        <Tooltip
          formatter={(value: number, _name, item) => [`${value} de ${item.payload.weight} pts`, "Pontuação"]}
        />
        <Bar dataKey="score" name="Pontuação" fill="#1e40af" radius={[0, 6, 6, 0]} barSize={18}>
          {data.map((entry) => (
            <Cell key={entry.label} fill={entry.incomplete ? "#94a3b8" : "#1e40af"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export type ScoreHistoryPoint = { data: string; score: number };

/** Evolução do score nos últimos meses (linha). */
export function ScoreEvolutionChart({ data }: { data: ScoreHistoryPoint[] }) {
  if (data.length < 2) {
    return (
      <p className="py-16 text-center text-sm text-slate-500">
        Ainda não há histórico suficiente — os snapshots são guardados automaticamente ao longo do tempo.
      </p>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="data" tick={{ fontSize: 11, fill: "#475569" }} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#475569" }} />
        <Tooltip formatter={(value: number) => [`${value} / 100`, "Score"]} />
        <Line type="monotone" dataKey="score" stroke="#1e40af" strokeWidth={2.5} dot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
