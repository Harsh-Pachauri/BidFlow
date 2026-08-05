import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  muted?: boolean;
}

export function Card({ className = "", muted = false, children, ...props }: CardProps) {
  const base = muted ? "border-slate-100 bg-slate-50/60" : "border-slate-200 bg-white shadow-sm";
  return (
    <div className={`rounded-xl border ${base} ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`border-b border-slate-200 px-5 py-4 ${className}`}>{children}</div>;
}

export function CardBody({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`px-5 py-4 ${className}`}>{children}</div>;
}
