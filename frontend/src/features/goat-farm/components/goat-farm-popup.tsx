import { IconCheese, IconClock, IconMilk, IconX } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { useBuyGoatItem } from "@/features/goat-farm/hooks/use-buy-goat-item";
import { useGoatStock } from "@/features/goat-farm/hooks/use-goat-stock";
import type { GoatStockItem } from "@/features/goat-farm/types";
import { useGuest } from "@/stores/session-selectors";

interface GoatFarmPopupProps {
  open: boolean;
  onClose: () => void;
}

function formatRestock(seconds: number) {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const rest = safeSeconds % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function itemIcon(item: GoatStockItem) {
  return item.id === "goat_cheese" ? (
    <IconCheese className="size-8" aria-hidden="true" />
  ) : (
    <IconMilk className="size-8" aria-hidden="true" />
  );
}

export function GoatFarmPopup({ open, onClose }: GoatFarmPopupProps) {
  const guest = useGuest();
  const stock = useGoatStock(open);
  const purchase = useBuyGoatItem(guest?.id ?? "");
  const {
    data: stockData,
    dataUpdatedAt,
    error: stockError,
    isError,
    isLoading,
    refetch,
  } = stock;
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!open) {
      return;
    }

    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, [open]);

  const secondsUntilRestock =
    stockData && dataUpdatedAt > 0
      ? Math.max(
          0,
          stockData.seconds_until_restock -
            Math.floor((nowMs - dataUpdatedAt) / 1000)
        )
      : null;

  useEffect(() => {
    if (!open || secondsUntilRestock === null) {
      return;
    }

    if (secondsUntilRestock <= 0) {
      const timeout = window.setTimeout(() => {
        void refetch();
      }, 250);

      return () => window.clearTimeout(timeout);
    }

  }, [open, refetch, secondsUntilRestock]);

  if (!open) {
    return null;
  }

  const panel = (
    <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-end p-4 sm:p-6">
      <section className="pointer-events-auto relative flex h-[min(860px,calc(100vh-2rem))] w-[min(980px,calc(100vw-2rem))] flex-col overflow-hidden rounded-[28px] border-[10px] border-[#9b5d25] bg-[#0a120d] text-white shadow-2xl ring-4 ring-[#d08a36]/60 sm:h-[min(900px,calc(100vh-3rem))] sm:w-[min(960px,58vw)]">
        <div className="pointer-events-none absolute inset-0 border-[10px] border-[#5f3519]/70" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[repeating-linear-gradient(90deg,rgba(181,104,33,0.2)_0,rgba(181,104,33,0.2)_3px,transparent_3px,transparent_70px)]" />
        <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-emerald-700/20" />

        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          className="absolute right-7 top-7 z-10 size-14 rounded-full border-2 border-amber-300/70 bg-amber-600/80 text-amber-50 shadow-lg hover:bg-amber-500"
          onClick={onClose}
          aria-label="Close goat farm"
        >
          <IconX className="size-7" aria-hidden="true" />
        </Button>

        <div className="relative px-8 pb-8 pt-14 sm:px-14 sm:pb-10 sm:pt-16">
          <p className="mb-5 text-sm font-semibold uppercase tracking-wide text-emerald-300">
            Mountain Goat Farm
          </p>
          <h2 className="max-w-[680px] text-5xl font-black leading-none sm:text-6xl">
            Fresh goat milk and cheese
          </h2>
          <p className="mt-6 max-w-[680px] text-xl leading-relaxed text-white/72">
            Kiki can pick up farm goods from the mountain herd. Stock is shared
            across guests and restocks every 60 seconds.
          </p>
        </div>

        <div className="relative flex flex-1 flex-col gap-5 px-8 pb-8 sm:px-14 sm:pb-14">
          <div className="flex items-center justify-between gap-4 rounded-t-[22px] bg-emerald-400 px-6 py-4 text-emerald-950">
            <h3 className="text-xl font-black uppercase tracking-wide">
              Farm shelf
            </h3>
            <div className="flex items-center gap-2 rounded-full bg-white/28 px-4 py-2 text-sm font-bold">
              <IconClock className="size-5" aria-hidden="true" />
              <span>
                Restock in{" "}
                {secondsUntilRestock !== null
                  ? formatRestock(secondsUntilRestock)
                  : "--:--"}
              </span>
            </div>
          </div>

          <div className="rounded-b-[22px] border border-emerald-300/15 bg-black/25">
            {isLoading && (
              <p className="p-8 text-lg text-white/70">Checking the farm shelf...</p>
            )}

            {isError && (
              <p className="m-6 rounded-md border border-red-400/40 bg-red-500/10 p-5 text-base text-red-100">
                {stockError.message}
              </p>
            )}

            <ul className="flex flex-col">
              {stockData?.items.map((item) => {
                const soldOut = item.stock <= 0;
                return (
                  <li
                    key={item.id}
                    className="grid grid-cols-[auto_1fr_auto] items-center gap-5 border-b border-white/10 p-6 last:border-b-0 sm:p-7"
                  >
                    <div className="flex size-20 shrink-0 items-center justify-center rounded-[18px] bg-amber-200 text-amber-950 shadow-inner">
                      {itemIcon(item)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-2xl font-black leading-tight">
                        {item.name}
                      </p>
                      <p className="mt-2 text-base text-white/65">
                        {item.stock} of {item.max_stock} available
                      </p>
                      <div className="mt-4 h-3 max-w-[420px] overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-emerald-400"
                          style={{
                            width: `${Math.max(
                              0,
                              Math.min(100, (item.stock / item.max_stock) * 100)
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="lg"
                      className="h-12 rounded-full bg-emerald-400 px-8 text-base font-black text-emerald-950 hover:bg-emerald-300"
                      disabled={!guest || soldOut || purchase.isPending}
                      onClick={() => purchase.mutate(item.id)}
                    >
                      {soldOut ? "Sold out" : "Buy"}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </div>

          {!guest && (
            <p className="rounded-md border border-amber-300/30 bg-amber-300/10 px-5 py-4 text-base text-amber-100">
              Select a guest before buying farm goods.
            </p>
          )}
        </div>
      </section>
    </div>
  );

  return createPortal(panel, document.body);
}
