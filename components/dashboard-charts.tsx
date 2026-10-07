"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type ModuleCount = { name: string; total: number };
export type CriticalitySlice = { name: string; value: number; color: string };

export function ModuleCountChart({ data }: { data: ModuleCount[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#475569" }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#475569" }} />
        <Tooltip />
        <Bar dataKey="total" name="Registos" fill="#1e40af" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function AssetCriticalityChart({ data }: { data: CriticalitySlice[] }) {
  if (data.length === 0) {
    return <p className="py-16 text-center text-sm text-slate-500">Sem ativos registados.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
          {data.map((slice) => (
            <Cell key={slice.name} fill={slice.color} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
