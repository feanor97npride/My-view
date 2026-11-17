"use client";

import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

const STATUS_COLORS = ["var(--s1)", "var(--s2)", "var(--s3)", "var(--s4)", "var(--s5)", "var(--s6)", "var(--s7)"];
const tick = { fill: "var(--mute)", fontSize: 12 };
const tip = {
  contentStyle: { background: "var(--card)", border: "1px solid var(--line)", borderRadius: 12, color: "var(--ink)" },
  itemStyle: { color: "var(--ink)" },
  labelStyle: { color: "var(--ink)", fontWeight: 600 },
};

export function StatusPie({ data }: { data: { name: string; value: number }[] }) {
  return (
    <div className="h-64 w-full" role="img" aria-label="Tarefas abertas por status">
      <ResponsiveContainer>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={88} paddingAngle={2} stroke="var(--card)">
            {data.map((_, i) => <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />)}
          </Pie>
          <Tooltip {...tip} />
          <Legend
            formatter={(value, entry) => (
              <span style={{ color: "var(--ink)" }}>
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
          <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={tick} stroke="var(--line)" />
          <YAxis allowDecimals={false} tick={tick} stroke="var(--line)" />
          <Tooltip {...tip} cursor={{ fill: "var(--primary-soft)" }} />
          <Bar dataKey="value" name="E-mails" radius={[8, 8, 0, 0]}>
            {data.map((d) => <Cell key={d.name} fill={`var(--cat-${d.name}, var(--cat-informativo))`} />)}
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
          <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={tick} stroke="var(--line)" />
          <YAxis allowDecimals={false} tick={tick} stroke="var(--line)" />
          <Tooltip {...tip} />
          <Line type="monotone" dataKey="n" name="Concluídas" stroke="var(--trend)" strokeWidth={3} dot={{ r: 4, fill: "var(--card)", stroke: "var(--trend)", strokeWidth: 2 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
