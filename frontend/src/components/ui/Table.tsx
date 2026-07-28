import type { HTMLAttributes, ReactNode, TableHTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";

export function Table({ children, className = "", ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto">
      <table className={`w-full text-left text-sm ${className}`} {...props}>
        {children}
      </table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
      {children}
    </thead>
  );
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-slate-100">{children}</tbody>;
}

// Rows with an onClick get cursor-pointer + hover automatically -- a page
// never has to remember to add those together, and never adds cursor-pointer
// to a row that isn't actually clickable.
export function Tr({ children, className = "", onClick, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={`${onClick ? "cursor-pointer hover:bg-slate-50" : ""} ${className}`}
      onClick={onClick}
      {...props}
    >
      {children}
    </tr>
  );
}

export function Th({ children, className = "", ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={`px-4 py-3 font-medium ${className}`} {...props}>
      {children}
    </th>
  );
}

interface TdProps extends TdHTMLAttributes<HTMLTableCellElement> {
  // A plain className override for text color/size isn't reliable here --
  // Tailwind's generated stylesheet order (not the order classes appear in
  // the string) decides which same-specificity utility wins, so a caller's
  // "text-slate-500" can silently lose to this component's own default.
  // A prop sidesteps that instead of fighting it.
  muted?: boolean;
}

export function Td({ children, className = "", muted = false, ...props }: TdProps) {
  const tone = muted ? "text-xs text-slate-500" : "text-slate-700";
  return (
    <td className={`px-4 py-3 ${tone} ${className}`} {...props}>
      {children}
    </td>
  );
}
