"use client";

import { useEffect, useState, useTransition } from "react";
import { CheckCircle2, Loader2, RefreshCw, XCircle } from "lucide-react";
import { syncAction } from "@/app/actions";
import { cn } from "@/lib/format";

type Toast = { ok: boolean; message: string };

export function SyncButton() {
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(id);
  }, [toast]);

  const sync = () =>
    startTransition(async () => {
      const res = await syncAction();
      setToast(
        res.ok
          ? {
              ok: true,
              message: `Synced ${res.result.consumptionRows} readings and ${res.result.rateRows} rates (${res.result.mode} data).`,
            }
          : { ok: false, message: res.error },
      );
    });

  return (
    <>
      <button
        type="button"
        onClick={sync}
        disabled={pending}
        className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md bg-accent px-4 text-sm font-medium text-bg transition-colors hover:bg-accent/90 disabled:cursor-wait disabled:opacity-70"
      >
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}
        {pending ? "Syncing…" : "Sync from Octopus"}
      </button>
      <div role="status" aria-live="polite" className="fixed right-4 bottom-4 z-50 max-w-sm">
        {toast && (
          <div
            className={cn(
              "flex items-start gap-2 rounded-lg border bg-card p-3 text-sm shadow-lg",
              toast.ok ? "border-accent/40" : "border-peak/50",
            )}
          >
            {toast.ok ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
            ) : (
              <XCircle className="mt-0.5 size-4 shrink-0 text-peak" aria-hidden />
            )}
            <span>{toast.message}</span>
          </div>
        )}
      </div>
    </>
  );
}
