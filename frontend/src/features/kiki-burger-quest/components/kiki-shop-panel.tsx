import { IconX } from "@tabler/icons-react";
import { useMemo } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { useMenu } from "@/features/crab/hooks/use-menu";
import { useGoatStock } from "@/features/goat-farm/hooks/use-goat-stock";
import { canAfford } from "@/features/kiki-burger-quest/lib/kiki-wallet";

// A shop item normalised across the crab menu and the goat farm so the panel
// can render either source with one card layout.
interface ShopItem {
  id: string;
  label: string;
  icon: string;
  // Meow price Kiki pays from her wallet.
  price: number;
  available: boolean;
  detail: string;
}

interface KikiShopPanelProps {
  open: boolean;
  // Which island shop Kiki is standing in.
  shop: "crab" | "goat";
  // The survival need this trip is meant to satisfy (drives the subtitle).
  need: "hunger" | "thirst";
  meows: number;
  // The goat farm has no meow prices of its own, so its goods use this flat
  // island rate. The crab menu already carries integer prices we treat as meows.
  fallbackPrice: number;
  onBuy: (item: { label: string; icon: string; price: number }) => void;
  onClose: () => void;
}

const NEED_SUBTITLE: Record<"hunger" | "thirst", string> = {
  hunger: "Kiki is hungry — buy a meal to refill her hunger bar.",
  thirst: "Kiki is thirsty — buy a drink to refill her thirst bar.",
};

const SHOP_THEME = {
  crab: {
    title: "The Crusty Crab",
    border: "border-[#b8472a]",
    ring: "ring-[#f08a5d]/60",
    accent: "bg-orange-400 text-orange-950",
    buy: "bg-orange-400 text-orange-950 hover:bg-orange-300",
  },
  goat: {
    title: "Mountain Goat Farm",
    border: "border-[#9b5d25]",
    ring: "ring-[#d08a36]/60",
    accent: "bg-emerald-400 text-emerald-950",
    buy: "bg-emerald-400 text-emerald-950 hover:bg-emerald-300",
  },
} as const;

export function KikiShopPanel({
  open,
  shop,
  need,
  meows,
  fallbackPrice,
  onBuy,
  onClose,
}: KikiShopPanelProps) {
  const menu = useMenu();
  const goat = useGoatStock(open && shop === "goat");
  const theme = SHOP_THEME[shop];

  const items = useMemo<ShopItem[]>(() => {
    if (shop === "crab") {
      return (menu.data?.items ?? []).map((item) => ({
        id: item.id,
        label: item.name,
        icon: item.emoji,
        price: item.price,
        available: item.available && (item.remaining ?? 1) > 0,
        detail: item.description,
      }));
    }

    return (goat.data?.items ?? []).map((item) => ({
      id: item.id,
      label: item.name,
      icon: item.id === "goat_cheese" ? "🧀" : "🥛",
      price: fallbackPrice,
      available: item.stock > 0,
      detail: `${item.stock} of ${item.max_stock} on the shelf`,
    }));
  }, [fallbackPrice, goat.data, menu.data, shop]);

  const isLoading = shop === "crab" ? menu.isLoading : goat.isLoading;

  if (!open) {
    return null;
  }

  const panel = (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-end p-4 sm:p-6">
      <section
        className={`pointer-events-auto relative flex h-[min(860px,calc(100vh-2rem))] w-[min(960px,calc(100vw-2rem))] flex-col overflow-hidden rounded-[28px] border-[10px] bg-[#0a0f14] text-white shadow-2xl ring-4 sm:w-[min(960px,58vw)] ${theme.border} ${theme.ring}`}
      >
        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          className="absolute right-7 top-7 z-10 size-14 rounded-full border-2 border-white/40 bg-black/50 text-white shadow-lg hover:bg-black/70"
          onClick={onClose}
          aria-label="Leave shop"
        >
          <IconX className="size-7" aria-hidden="true" />
        </Button>

        <div className="relative px-8 pb-6 pt-14 sm:px-14 sm:pt-16">
          <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-white/60">
            Kiki goes shopping
          </p>
          <h2 className="max-w-[680px] text-5xl font-black leading-none sm:text-6xl">
            {theme.title}
          </h2>
          <p className="mt-5 max-w-[680px] text-xl leading-relaxed text-white/70">
            {NEED_SUBTITLE[need]}
          </p>
          <div
            className={`mt-6 inline-flex items-center gap-2 rounded-full px-5 py-2 text-lg font-black ${theme.accent}`}
          >
            🐾 {meows} meows
          </div>
        </div>

        <div className="relative flex flex-1 flex-col gap-4 overflow-y-auto px-8 pb-8 sm:px-14 sm:pb-14">
          {isLoading && (
            <p className="p-6 text-lg text-white/70">Looking over the shelf...</p>
          )}

          <ul className="flex flex-col">
            {items.map((item) => {
              const affordable = canAfford(meows, item.price);
              const disabled = !item.available || !affordable;
              return (
                <li
                  key={item.id}
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-5 border-b border-white/10 p-5 last:border-b-0 sm:p-6"
                >
                  <div className="flex size-20 shrink-0 items-center justify-center rounded-[18px] bg-white/10 text-4xl shadow-inner">
                    {item.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-2xl font-black leading-tight">
                      {item.label}
                    </p>
                    <p className="mt-1 line-clamp-2 text-base text-white/60">
                      {item.detail}
                    </p>
                    <p className="mt-2 text-base font-bold text-amber-200">
                      {item.price} meows
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="lg"
                    className={`h-12 rounded-full px-8 text-base font-black ${theme.buy}`}
                    disabled={disabled}
                    onClick={() =>
                      onBuy({
                        label: item.label,
                        icon: item.icon,
                        price: item.price,
                      })
                    }
                  >
                    {!item.available
                      ? "Sold out"
                      : affordable
                        ? "Buy"
                        : "Too pricey"}
                  </Button>
                </li>
              );
            })}
          </ul>

          {!isLoading && items.length === 0 && (
            <p className="rounded-md border border-white/15 bg-white/5 px-5 py-4 text-base text-white/70">
              The shelf is empty right now. Try again in a moment.
            </p>
          )}
        </div>
      </section>
    </div>
  );

  return createPortal(panel, document.body);
}
