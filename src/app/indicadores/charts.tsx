"use client";

import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

const PALETTE = ["#3b82f6", "#f59e0b", "#10b981", "#8b5cf6", "#ef4444", "#14b8a6", "#6b7280"];
const CATEGORY_COLOR: Record<string, string> = {
  acao: "#8b5cf6", financeiro: "#10b981", agendamento: "#3b82f6", trabalho: "#f59e0b",
  pessoal: "#ec4899", aguardando: "#14b8a6", informativo: "#9ca3af",
};

export function StatusPie({ data }: { data: { name: string; value: number }[] }) {
  return (
    <div className="h-64 w-full" role="img" aria-label="Tarefas abertas por status">
      <ResponsiveContainer>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
            {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
          </Pie>
          <Tooltip />
          <Legend
            formatter={(value, entry) => (
              <span style={{ color: "var(--foreground)" }}>
                {value}: {(entry.payload as { value?: number } | undefined)?.value}
              </span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CategoryBars({ data }: { data: { name: string; value: number }[] }) {
  return (
    <div className="h-64 w-full" role="img" aria-label="E-mails por categoria nos últimos 7 dias">
      <ResponsiveContainer>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="value" name="E-mails">
            {data.map((d) => <Cell key={d.name} fill={CATEGORY_COLOR[d.name] ?? "#9ca3af"} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DoneTrend({ data }: { data: { day: string; n: number }[] }) {
  const rows = data.map((d) => ({ ...d, label: `${d.day.slice(8)}/${d.day.slice(5, 7)}` }));
  return (
    <div className="h-64 w-full" role="img" aria-label="Tarefas concluídas por dia nos últimos 14 dias">
      <ResponsiveContainer>
        <LineChart data={rows}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Line type="monotone" dataKey="n" name="Concluídas" stroke="#10b981" strokeWidth={2} dot />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
