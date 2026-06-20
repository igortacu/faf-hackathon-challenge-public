import { NotLandedGate } from "@/features/map/components/not-landed-gate";
import { ZoneEventLog } from "@/features/map/components/zone-event-log";
import { ZoneId } from "@/features/map/constants";
import { useZoneEvents } from "@/features/map/hooks/use-zone-events";
import { useLanded } from "@/features/airport/hooks/use-airport";
import { useIsAdmin, useGuest } from "@/stores/session-selectors";
import { useMenu } from "@/features/crab/hooks/use-menu";
import { usePlaceOrder } from "@/features/crab/hooks/use-place-order";
import crabArt from "@/assets/zones/crab.svg";

export function CrabPanel() {
  const isAdmin = useIsAdmin();
  const events = useZoneEvents(ZoneId.Crab);
  const landed = useLanded();
  const guest = useGuest();

  const { data, isLoading } = useMenu();
  const order = usePlaceOrder(guest?.id ?? "", guest?.name ?? "");

  if (isAdmin) {
    return <ZoneEventLog events={events} />;
  }

  if (!landed || !guest) {
    return <NotLandedGate />;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <img src={crabArt} alt="Mr. Crab" className="h-14 w-14" />
        <div>
          <h3 className="font-semibold">The Crusty Crab</h3>
          <p className="text-sm text-muted-foreground">Mr. Crab welcomes you!</p>
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Heating the grill…</p>}

      <ul className="flex flex-col gap-2">
        {data?.items.map((item) => {
          const soldOut = !item.available;
          return (
            <li
              key={item.id}
              className="flex items-center justify-between rounded-md border p-2"
            >
              <div>
                <span className="font-medium">
                  {item.emoji} {item.name}
                </span>
                <span className="ml-2 text-xs text-muted-foreground">{item.price} 🐚</span>
                {item.remaining !== null && !soldOut && (
                  <span className="ml-2 text-xs text-amber-600">
                    {item.remaining} left
                  </span>
                )}
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </div>
              <button
                className="rounded-md bg-red-500 px-3 py-1 text-sm text-white disabled:opacity-50"
                disabled={soldOut || order.isPending}
                onClick={() => order.mutate([{ item_id: item.id, qty: 1 }])}
              >
                {soldOut ? "Sold out" : "Order"}
              </button>
            </li>
          );
        })}
      </ul>

      <ZoneEventLog events={events} />
    </div>
  );
}
