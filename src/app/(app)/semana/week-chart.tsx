"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type DayLoad = { day: string; ocupado: number; livre: number };

const tick = { fill: "var(--mute)", fontSize: 12 };

export default function WeekChart({ data }: { data: DayLoad[] }) {
  return (
    <div className="h-64 w-full" role="img" aria-label="Horas ocupadas e livres por dia da semana">
      <ResponsiveContainer>
        <BarChart data={data}>
          <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="day" tick={tick} stroke="var(--line)" />
          <YAxis unit="h" tick={tick} stroke="var(--line)" />
          <Tooltip
            formatter={(v) => `${Number(v).toFixed(1)}h`}
            cursor={{ fill: "var(--primary-soft)" }}
            contentStyle={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 12, color: "var(--ink)" }}
            itemStyle={{ color: "var(--ink)" }}
            labelStyle={{ color: "var(--ink)", fontWeight: 600 }}
          />
          <Legend formatter={(value) => <span style={{ color: "var(--ink)" }}>{value}</span>} />
          <Bar dataKey="ocupado" stackId="a" fill="var(--chart-busy)" name="Ocupado" />
          <Bar dataKey="livre" stackId="a" fill="var(--chart-free)" name="Livre (de 12h)" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
