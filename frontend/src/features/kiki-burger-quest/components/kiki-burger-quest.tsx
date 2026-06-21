import { useEffect, useRef, useState } from "react";

import kikiLeft from "@/assets/kiki/kikiLL.png";
import kikiRight from "@/assets/kiki/kikiRR.png";
import { Button } from "@/components/ui/button";
import { MAP_H, MAP_W } from "@/features/map/constants";
import { OctopusOraclePanel } from "@/features/octopus-oracle/components/octopus-oracle-panel";
import { KikiShopPanel } from "@/features/kiki-burger-quest/components/kiki-shop-panel";
import {
  canPayForNeed,
  isCritical,
  NEED_CONFIG,
  NEED_PRICE_MEOWS,
  type NeedKind,
} from "@/features/kiki-burger-quest/lib/kiki-survival";
import {
  levelForEarnings,
  levelProgress,
  nextLevel,
  rewardForOracleResult,
} from "@/features/kiki-burger-quest/lib/kiki-wallet";
import { useKikiActions, useKikiWallet } from "@/stores/session-selectors";

// Where Kiki travels (MAP_W=3200, MAP_H=2000). These match the on-map markers:
// crab zone position, the goat farm marker, and the octopus marker.
const CRAB_POSITION = { x: 1080, y: 1240 };
const GOAT_POSITION = { x: 2480, y: 700 };
const OCTOPUS_POSITION = { x: 2850, y: 185 };
// Kiki idles on the boardwalk just below the Crusty Crab.
const HOME_POSITION = { x: 1080, y: 1480 };

const SHOP_POSITION: Record<NeedKind, { x: number; y: number }> = {
  hunger: CRAB_POSITION,
  thirst: GOAT_POSITION,
};

// Kiki's state machine. She idles at home (bars draining) until you send her to
// eat or drink. If she is broke she detours to the Octopus to earn meows first,
// then continues on to the shop.
type Mode =
  | "idle"
  | "detour_to_octopus"
  | "at_octopus"
  | "walking_to_shop"
  | "at_shop"
  | "walking_home";

interface KikiBurgerQuestProps {
  mapW: number;
  mapH: number;
}

const WALK_DURATION_MS = 3200;
const DRAIN_TICK_MS = 1000;
const CONFETTI_DURATION_MS = 3000;
const CONFETTI_COLORS = [
  "#f472b6",
  "#fde047",
  "#34d399",
  "#60a5fa",
  "#fb7185",
  "#facc15",
  "#2dd4bf",
  "#c084fc",
  "#fb923c",
  "#38bdf8",
  "#f9a8d4",
  "#a3e635",
  "#f97316",
];
const CONFETTI_PIECES = Array.from({ length: 120 }, (_, index) => ({
  left: `${(index * 37) % 100}%`,
  top: `${(index * 23) % 96}%`,
  delay: `${(index * 29) % 260}ms`,
  duration: `${2600 + ((index * 41) % 420)}ms`,
  color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
  rotate: `${(index * 47) % 360}deg`,
  width: `${10 + (index % 4) * 4}px`,
  height: `${16 + (index % 5) * 5}px`,
  drift: `${index % 2 === 0 ? 1 : -1}${18 + (index % 7) * 7}px`,
}));

function NeedBar({
  kind,
  value,
}: {
  kind: NeedKind;
  value: number;
}) {
  const config = NEED_CONFIG[kind];
  const critical = isCritical(value);
  return (
    <div className="text-left">
      <div className="flex items-center justify-between text-2xl font-black">
        <span>
          {config.icon} {config.label}
        </span>
        <span className={critical ? "text-red-300" : "text-pink-100/80"}>
          {Math.round(value)}%
        </span>
      </div>
      <div className="mt-2 h-6 overflow-hidden rounded-full bg-white/15">
        <div
          className={`h-full rounded-full transition-all ${
            critical ? "bg-red-400" : "bg-emerald-400"
          }`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

export function KikiBurgerQuest({ mapW, mapH }: KikiBurgerQuestProps) {
  const wallet = useKikiWallet();
  const { kikiEarn, kikiSpend, kikiRefill, kikiDrain } = useKikiActions();

  const [mode, setMode] = useState<Mode>("idle");
  const [position, setPosition] = useState(HOME_POSITION);
  const [direction, setDirection] = useState<"left" | "right">("right");
  // Which need Kiki is currently trying to satisfy (the shop she's headed to).
  const [activeNeed, setActiveNeed] = useState<NeedKind | null>(null);
  const [statusLine, setStatusLine] = useState("Kiki is relaxing on the boardwalk.");
  const [showConfetti, setShowConfetti] = useState(false);
  const lastTrialPassed = useRef<boolean | null>(null);

  const scaleX = mapW / MAP_W;
  const scaleY = mapH / MAP_H;
  const scale = Math.min(scaleX, scaleY);
  const kikiSrc = direction === "right" ? kikiRight : kikiLeft;
  const x = position.x * scaleX;
  const y = position.y * scaleY;

  const level = levelForEarnings(wallet.lifetimeMeows);
  const upcoming = nextLevel(wallet.lifetimeMeows);
  const progress = levelProgress(wallet.lifetimeMeows);
  const isIdle = mode === "idle";

  function walkTo(
    target: { x: number; y: number },
    nextMode: Mode,
    line: string
  ) {
    setDirection(target.x >= position.x ? "right" : "left");
    setPosition(target);
    setMode(nextMode);
    setStatusLine(line);
  }

  // Send Kiki to satisfy a need. If she can't afford it, she detours to the
  // Octopus to earn meows, then carries on to the shop.
  function pursueNeed(need: NeedKind) {
    setActiveNeed(need);
    const config = NEED_CONFIG[need];

    if (canPayForNeed(wallet.meows)) {
      walkTo(
        SHOP_POSITION[need],
        "walking_to_shop",
        `Kiki heads off to ${config.verb.toLowerCase()}.`
      );
      return;
    }

    lastTrialPassed.current = null;
    walkTo(
      OCTOPUS_POSITION,
      "detour_to_octopus",
      "No meows! Kiki visits the Octopus to earn some."
    );
  }

  // Bars drain on a steady tick while Kiki is alive and the page is open.
  useEffect(() => {
    const interval = window.setInterval(() => {
      kikiDrain(DRAIN_TICK_MS / 1000);
    }, DRAIN_TICK_MS);
    return () => window.clearInterval(interval);
  }, [kikiDrain]);

  // Movement state machine: resolve each leg of the trip after the walk delay.
  useEffect(() => {
    if (mode === "detour_to_octopus") {
      const timeout = window.setTimeout(() => {
        setMode("at_octopus");
        setStatusLine("Play Blue or Red Pill to win 100 meows.");
      }, WALK_DURATION_MS);
      return () => window.clearTimeout(timeout);
    }

    if (mode === "walking_to_shop") {
      const timeout = window.setTimeout(() => {
        setMode("at_shop");
        setStatusLine("Kiki browses the shelf.");
      }, WALK_DURATION_MS);
      return () => window.clearTimeout(timeout);
    }

    if (mode === "walking_home") {
      const timeout = window.setTimeout(() => {
        setActiveNeed(null);
        setMode("idle");
        setStatusLine("Kiki is relaxing on the boardwalk.");
      }, WALK_DURATION_MS);
      return () => window.clearTimeout(timeout);
    }
  }, [mode]);

  useEffect(() => {
    if (!showConfetti) {
      return;
    }
    const timeout = window.setTimeout(
      () => setShowConfetti(false),
      CONFETTI_DURATION_MS
    );
    return () => window.clearTimeout(timeout);
  }, [showConfetti]);

  function handleTrialResult(passed: boolean) {
    lastTrialPassed.current = passed;
    if (passed) {
      kikiEarn(rewardForOracleResult(true));
    }
  }

  function handleOracleClose() {
    // Won meows: continue to the shop Kiki originally set out for.
    if (lastTrialPassed.current === true && activeNeed) {
      const config = NEED_CONFIG[activeNeed];
      walkTo(
        SHOP_POSITION[activeNeed],
        "walking_to_shop",
        `Meows in paw! Kiki goes to ${config.verb.toLowerCase()}.`
      );
      return;
    }
    // Lost or closed: head home with the need still unmet.
    walkTo(HOME_POSITION, "walking_home", "No meows this time. Kiki heads home.");
  }

  function handleShopBuy(item: { label: string; icon: string; price: number }) {
    if (!activeNeed) {
      return;
    }
    kikiSpend(item.price, `${item.icon} ${item.label}`);
    kikiRefill(activeNeed);
    setShowConfetti(true);
    const verb = activeNeed === "hunger" ? "ate" : "drank";
    walkTo(HOME_POSITION, "walking_home", `Kiki ${verb} a ${item.label}!`);
  }

  function handleShopClose() {
    walkTo(HOME_POSITION, "walking_home", "Kiki leaves the shop.");
  }

  return (
    <>
      <div
        className="pointer-events-auto absolute z-10"
        style={{
          left: x,
          top: y,
          transform: "translate(-50%, -100%)",
          transition: `left ${WALK_DURATION_MS}ms ease-in-out, top ${WALK_DURATION_MS}ms ease-in-out`,
        }}
      >
        {/* Survival HUD: status, bars, wallet, level */}
        <div className="mb-6 w-[760px] rounded-[36px] border-[6px] border-pink-100/80 bg-black/55 px-12 py-9 text-center text-pink-50 shadow-2xl backdrop-blur-[2px]">
          <p className="text-5xl font-black leading-tight">{statusLine}</p>

          <div className="mt-7 grid gap-5">
            <NeedBar kind="hunger" value={wallet.hunger} />
            <NeedBar kind="thirst" value={wallet.thirst} />
          </div>

          <div className="mt-7 flex items-center justify-center gap-5 text-2xl font-black">
            <span className="rounded-full bg-amber-300/90 px-7 py-2 text-amber-950">
              🐾 {wallet.meows} meows
            </span>
            <span className="rounded-full bg-pink-200/90 px-7 py-2 text-pink-950">
              Lv {level.level} · {level.title}
            </span>
          </div>
          <div className="mx-auto mt-4 h-4 max-w-[560px] overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-amber-300 transition-all"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
          {upcoming ? (
            <p className="mt-3 text-xl text-pink-100/70">
              {upcoming.threshold - wallet.lifetimeMeows} meows to{" "}
              {upcoming.title}
            </p>
          ) : (
            <p className="mt-3 text-xl text-amber-200">Max level reached!</p>
          )}
          {wallet.inventory.length > 0 && (
            <p className="mt-4 text-4xl" aria-label="Kiki's haul">
              {wallet.inventory
                .slice(0, 8)
                .map((entry) => entry.split(" ")[0])
                .join(" ")}
            </p>
          )}
        </div>

        <img
          src={kikiSrc}
          alt="Kiki"
          draggable={false}
          className="mx-auto select-none drop-shadow-xl"
          style={{ width: Math.max(130, 230 * scale) }}
        />

        {isIdle && (
          <div className="mt-3 flex justify-center gap-3">
            <Button
              type="button"
              size="lg"
              className="min-h-24 rounded-[36px] border-4 border-orange-100/80 bg-orange-300 px-10 text-4xl font-black text-orange-950 shadow-2xl hover:bg-orange-200"
              onClick={() => pursueNeed("hunger")}
            >
              🍔 Eat
            </Button>
            <Button
              type="button"
              size="lg"
              className="min-h-24 rounded-[36px] border-4 border-sky-100/80 bg-sky-300 px-10 text-4xl font-black text-sky-950 shadow-2xl hover:bg-sky-200"
              onClick={() => pursueNeed("thirst")}
            >
              🥛 Drink
            </Button>
          </div>
        )}
      </div>

      <OctopusOraclePanel
        open={mode === "at_octopus"}
        onClose={handleOracleClose}
        onTrialResult={handleTrialResult}
      />

      {activeNeed && (
        <KikiShopPanel
          open={mode === "at_shop"}
          shop={NEED_CONFIG[activeNeed].shop}
          need={activeNeed}
          meows={wallet.meows}
          fallbackPrice={NEED_PRICE_MEOWS}
          onBuy={handleShopBuy}
          onClose={handleShopClose}
        />
      )}

      {showConfetti && (
        <div
          className="pointer-events-none fixed inset-0 z-[80] overflow-hidden"
          aria-hidden="true"
        >
          <style>
            {`
              @keyframes kiki-confetti-fall {
                0% { transform: translate3d(0, -12vh, 0) rotate(0deg); opacity: 0; }
                8% { opacity: 1; }
                82% { opacity: 1; }
                100% { transform: translate3d(var(--confetti-drift), 92vh, 0) rotate(820deg); opacity: 0; }
              }

              @media (prefers-reduced-motion: reduce) {
                .kiki-confetti-piece {
                  animation-duration: 1ms !important;
                  opacity: 0.9;
                  transform: translateY(20vh) !important;
                }
              }
            `}
          </style>
          {CONFETTI_PIECES.map((piece, index) => (
            <span
              key={`${piece.left}-${piece.top}-${piece.color}`}
              className="kiki-confetti-piece absolute rounded-sm shadow-lg"
              style={{
                left: piece.left,
                top: piece.top,
                width: piece.width,
                height: piece.height,
                backgroundColor: piece.color,
                transform: `rotate(${piece.rotate})`,
                animation: `kiki-confetti-fall ${piece.duration} cubic-bezier(0.18, 0.74, 0.36, 1) ${piece.delay} both`,
                marginLeft: `${index % 2 === 0 ? 18 : -18}px`,
                "--confetti-drift": piece.drift,
              } as React.CSSProperties}
            />
          ))}
        </div>
      )}
    </>
  );
}
