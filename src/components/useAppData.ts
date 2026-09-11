"use client";

import { useEffect, useState } from "react";
import { emptyData, loadData } from "@/lib/store";
import type { AppData } from "@/lib/types";

export function useAppData() {
  const [data, setData] = useState<AppData>(emptyData());
  const [ready, setReady] = useState(false);

  const refresh = () => {
    setData(loadData());
    setReady(true);
  };

  useEffect(() => {
    refresh();
    const onStorage = () => refresh();
    window.addEventListener("storage", onStorage);
    window.addEventListener("studdiebuddie-update", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("studdiebuddie-update", onStorage);
    };
  }, []);

  return { data, ready, refresh };
}

export function notifyDataChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("studdiebuddie-update"));
  }
}
