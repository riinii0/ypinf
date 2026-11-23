import { DISCLAIMER_TEXT } from "@/lib/labels";
import { Info } from "lucide-react";

export function Disclaimer({ className = "" }: { className?: string }) {
  return (
    <aside
      aria-label="안내 및 면책 문구"
      className={`flex items-start gap-2 rounded-xl border border-navy/10 bg-white px-4 py-3 text-xs leading-relaxed text-navy/70 ${className}`}
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-navy/50" aria-hidden="true" />
      <p>{DISCLAIMER_TEXT}</p>
    </aside>
  );
}
