import { useEffect, useMemo, useState } from "react";

import kikiLeft from "@/assets/kiki/kikiLL.png";
import kikiRight from "@/assets/kiki/kikiRR.png";
import { Button } from "@/components/ui/button";
import { MAP_H, MAP_W } from "@/features/map/constants";
import { OctopusOraclePanel } from "@/features/octopus-oracle/components/octopus-oracle-panel";
import {
  canBuyBurger,
  rewardForOracleResult,
  spendBurgerMeows,
} from "@/features/kiki-burger-quest/lib/kiki-burger-quest";

type QuestPhase =
  | "idle_at_crab"
  | "needs_meows"
  | "walking_to_octopus"
  | "at_octopus"
  | "failed_task"
  | "earned_meows"
  | "walking_to_crab"
  | "ready_to_buy"
  | "burger_received";

interface KikiBurgerQuestProps {
  mapW: number;
  mapH: number;
}

const CRAB_POSITION = { x: 1220, y: 1250 };
const OCTOPUS_POSITION = { x: 2825, y: 450 };
const WALK_DURATION_MS = 3200;
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

function phaseMessage(phase: QuestPhase, meows: number) {
  switch (phase) {
    case "idle_at_crab":
      return "Kiki wants a burger.";
    case "needs_meows":
      return "Kiki needs 100 meows first. The octopus has a task.";
    case "walking_to_octopus":
      return "Kiki is going to the Octopus Oracle.";
    case "at_octopus":
      return "Complete an oracle task to earn 100 meows.";
    case "failed_task":
      return "Kiki did not earn the meows yet. Try again.";
    case "earned_meows":
      return `Kiki earned ${meows} meows. Time to buy the burger.`;
    case "walking_to_crab":
      return "Kiki is going back to The Crusty Crab.";
    case "ready_to_buy":
      return "Kiki has 100 meows and can buy the burger.";
    case "burger_received":
      return "Burger received. Kiki is delighted.";
  }
}

export function KikiBurgerQuest({ mapW, mapH }: KikiBurgerQuestProps) {
  const [phase, setPhase] = useState<QuestPhase>("idle_at_crab");
  const [position, setPosition] = useState(CRAB_POSITION);
  const [direction, setDirection] = useState<"left" | "right">("right");
  const [meows, setMeows] = useState(0);
  const [oracleOpen, setOracleOpen] = useState(false);
  const [lastTrialPassed, setLastTrialPassed] = useState<boolean | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  const scaleX = mapW / MAP_W;
  const scaleY = mapH / MAP_H;
  const scale = Math.min(scaleX, scaleY);
  const kikiSrc = direction === "right" ? kikiRight : kikiLeft;
  const x = position.x * scaleX;
  const y = position.y * scaleY;

  const canRequestBurger = phase === "idle_at_crab" || phase === "burger_received";
  const canRetryTask = phase === "failed_task";
  const canPayForBurger = phase === "ready_to_buy" && canBuyBurger(meows);

  const speech = useMemo(() => phaseMessage(phase, meows), [meows, phase]);

  function startWalkToOctopus() {
    setDirection("right");
    setPhase("walking_to_octopus");
    setPosition(OCTOPUS_POSITION);
  }

  function startWalkToCrab() {
    setDirection("left");
    setPhase("walking_to_crab");
    setPosition(CRAB_POSITION);
  }

  function requestBurger() {
    setMeows(0);
    setLastTrialPassed(null);
    setPhase("needs_meows");
  }

  function buyBurger() {
    setMeows((current) => spendBurgerMeows(current));
    setPhase("burger_received");
    setShowConfetti(true);
  }

  useEffect(() => {
    if (phase === "needs_meows") {
      const timeout = window.setTimeout(startWalkToOctopus, 1300);
      return () => window.clearTimeout(timeout);
    }

    if (phase === "walking_to_octopus") {
      const timeout = window.setTimeout(() => {
        setPhase("at_octopus");
        setOracleOpen(true);
      }, WALK_DURATION_MS);
      return () => window.clearTimeout(timeout);
    }

    if (phase === "earned_meows") {
      const timeout = window.setTimeout(startWalkToCrab, 1200);
      return () => window.clearTimeout(timeout);
    }

    if (phase === "walking_to_crab") {
      const timeout = window.setTimeout(() => {
        setPhase("ready_to_buy");
      }, WALK_DURATION_MS);
      return () => window.clearTimeout(timeout);
    }
  }, [phase]);

  useEffect(() => {
    if (!showConfetti) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setShowConfetti(false);
    }, CONFETTI_DURATION_MS);

    return () => window.clearTimeout(timeout);
  }, [showConfetti]);

  function handleOracleClose() {
    setOracleOpen(false);

    if (lastTrialPassed === true) {
      setPhase("earned_meows");
      return;
    }

    if (lastTrialPassed === false) {
      setPhase("failed_task");
    }
  }

  function handleTrialResult(passed: boolean) {
    setLastTrialPassed(passed);
    if (passed) {
      setMeows((current) => current + rewardForOracleResult(true));
    }
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
        <div className="mb-5 w-[560px] rounded-[28px] border-4 border-pink-100/80 bg-black/55 px-8 py-7 text-center text-3xl font-black leading-tight text-pink-50 shadow-2xl backdrop-blur-[2px]">
          <p>{speech}</p>
          <p className="mt-4 text-xl text-emerald-200">{meows} meows</p>
        </div>
        <img
          src={kikiSrc}
          alt="Kiki"
          draggable={false}
          className="mx-auto select-none drop-shadow-xl"
          style={{ width: Math.max(130, 230 * scale) }}
        />
        <div className="mt-3 flex justify-center gap-3">
          {canRequestBurger && (
            <Button
              type="button"
              size="lg"
              className="min-h-24 rounded-[36px] border-4 border-pink-100/80 bg-pink-300 px-14 text-5xl font-black text-pink-950 shadow-2xl hover:bg-pink-200"
              onClick={requestBurger}
            >
              Request burger
            </Button>
          )}
          {canRetryTask && (
            <Button
              type="button"
              size="lg"
              className="min-h-24 rounded-[36px] border-4 border-cyan-100/80 bg-cyan-300 px-14 text-5xl font-black text-cyan-950 shadow-2xl hover:bg-cyan-200"
              onClick={() => {
                setLastTrialPassed(null);
                setPhase("at_octopus");
                setOracleOpen(true);
              }}
            >
              Try task again
            </Button>
          )}
          {canPayForBurger && (
            <Button
              type="button"
              size="lg"
              className="min-h-24 rounded-[36px] border-4 border-amber-100/80 bg-amber-300 px-14 text-5xl font-black text-amber-950 shadow-2xl hover:bg-amber-200"
              onClick={buyBurger}
            >
              Pay 100 meows
            </Button>
          )}
        </div>
      </div>

      <OctopusOraclePanel
        open={oracleOpen}
        onClose={handleOracleClose}
        onTrialResult={handleTrialResult}
      />

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
