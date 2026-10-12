"use server";

import { revalidatePath } from "next/cache";
import { syncOctopusData, type SyncResult } from "@/lib/sync";

export type SyncResponse = { ok: true; result: SyncResult } | { ok: false; error: string };

export async function syncAction(): Promise<SyncResponse> {
  try {
    const result = await syncOctopusData();
    revalidatePath("/");
    return { ok: true, result };
  } catch (err) {
    console.error("Octopus sync failed", err);
    return { ok: false, error: err instanceof Error ? err.message : "Sync failed" };
  }
}
