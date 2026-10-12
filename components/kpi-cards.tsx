import { Leaf, PiggyBank, PoundSterling, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PLUNGE_THRESHOLD_P, type Summary } from "@/lib/analytics";
import { cn, pence, pounds } from "@/lib/format";

function Card({ icon: Icon, label, value, detail, good }: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  good?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-sm text-fg-muted">
        <Icon className="size-4" aria-hidden />
        {label}
      </div>
      <p className="mt-2 font-mono text-2xl font-semibold tabular-nums">{value}</p>
      <p className={cn("mt-1 text-sm", good === undefined ? "text-fg-muted" : good ? "text-accent" : "text-peak")}>
        {detail}
      </p>
    </div>
  );
}

export function KpiCards({ summary: s }: { summary: Summary }) {
  const saved = s.savingsP >= 0;
  return (
    <section aria-label="Key metrics" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Card
        icon={PoundSterling}
        label={`Agile spend · ${s.days} day${s.days === 1 ? "" : "s"}`}
        value={pounds(s.agileCostP)}
        detail={`${saved ? "Saved" : "Cost"} ${pounds(Math.abs(s.savingsP))} / ${Math.abs(s.savingsPct).toFixed(0)}% ${saved ? "vs" : "more than"} SVT (${pounds(s.svtCostP)})`}
        good={saved}
      />
      <Card
        icon={Zap}
        label="Average unit price"
        value={pence(s.avgAgileRateP)}
        detail={`vs ${pence(s.svtRateP)} flat · ${s.totalKwh.toFixed(1)} kWh used`}
        good={s.avgAgileRateP <= s.svtRateP}
      />
      <Card
        icon={Leaf}
        label="Used in cheap slots"
        value={`${s.cheapPct.toFixed(0)}%`}
        detail={`${s.negativeKwh.toFixed(1)} kWh at negative prices`}
      />
      <Card
        icon={PiggyBank}
        label={`Plunge yield (<${PLUNGE_THRESHOLD_P}p)`}
        value={`${s.plungeKwh.toFixed(1)} kWh`}
        detail={`${pounds(s.plungeSavingP)} saved or earned vs SVT`}
        good={s.plungeSavingP > 0 ? true : undefined}
      />
    </section>
  );
}
