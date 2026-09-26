import type { ReactNode } from "react";

type StatCardProps = {
  label: string;
  value: string | number;
  hint: string;
  icon: ReactNode;
  tone: "teal" | "green" | "amber" | "blue";
};

export function StatCard({ label, value, hint, icon, tone }: StatCardProps) {
  return (
    <article className={`stat tone-${tone}`}>
      <div className="stat-icon" aria-hidden="true">
        {icon}
      </div>
      <div>
        <p className="stat-label">{label}</p>
        <p className="stat-value">{value}</p>
        <p className="stat-hint">{hint}</p>
      </div>
    </article>
  );
}
