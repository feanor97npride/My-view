"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type DayLoad = { day: string; ocupado: number; livre: number };

export default function WeekChart({ data }: { data: DayLoad[] }) {
  return (
    <div className="h-64 w-full" role="img" aria-label="Horas ocupadas e livres por dia da semana">
      <ResponsiveContainer>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="day" />
          <YAxis unit="h" />
          <Tooltip formatter={(v) => `${Number(v).toFixed(1)}h`} />
          <Legend formatter={(value) => <span style={{ color: "var(--foreground)" }}>{value}</span>} />
          <Bar dataKey="ocupado" stackId="a" fill="#3b82f6" name="Ocupado" />
          <Bar dataKey="livre" stackId="a" fill="#d1d5db" name="Livre (de 12h)" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
