import {
  IconBrain,
  IconCircleCheck,
  IconRipple,
  IconSparkles,
  IconX,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import {
  BLUE_TRIAL_QUESTIONS,
  evaluateQuiz,
  evaluateSequence,
  randomSequence,
  type OracleColor,
} from "@/features/octopus-oracle/lib/octopus-oracle";

type OracleMode = "choice" | "blue" | "red" | "result";

// The reflex trial flashes the target order, then takes the player's taps.
type RedPhase = "watch" | "input";

// Timing for the watch phase: each pearl lights for FLASH_ON, then a gap.
const FLASH_ON_MS = 620;
const FLASH_GAP_MS = 260;

interface OctopusOraclePanelProps {
  open: boolean;
  onClose: () => void;
  onTrialResult?: (passed: boolean) => void;
}

interface ResultState {
  passed: boolean;
  title: string;
  message: string;
}

const COLOR_STYLES: Record<OracleColor, string> = {
  blue: "bg-sky-400 text-sky-950",
  red: "bg-red-500 text-red-50",
  violet: "bg-violet-500 text-violet-50",
  amber: "bg-amber-300 text-amber-950",
};

function colorLabel(color: OracleColor) {
  return color[0].toUpperCase() + color.slice(1);
}

export function OctopusOraclePanel({
  open,
  onClose,
  onTrialResult,
}: OctopusOraclePanelProps) {
  const [mode, setMode] = useState<OracleMode>("choice");
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [sequenceInput, setSequenceInput] = useState<OracleColor[]>([]);
  const [result, setResult] = useState<ResultState | null>(null);
  // Reflex trial state: the shuffled target, whether we're flashing or taking
  // input, and which pearl is currently lit during the watch phase (-1 = none).
  const [redTarget, setRedTarget] = useState<OracleColor[]>([]);
  const [redPhase, setRedPhase] = useState<RedPhase>("watch");
  const [flashIndex, setFlashIndex] = useState(-1);

  // Drive the watch-phase animation: light each pearl in turn, then hand control
  // to the player. Runs only while the red trial is mid-flash.
  useEffect(() => {
    if (mode !== "red" || redPhase !== "watch" || redTarget.length === 0) {
      return;
    }

    // flashIndex is reset to -1 by startRedTrial/replayRedSequence before this
    // effect runs, so the watch loop can start straight into scheduling.
    let step = 0;
    const timers: number[] = [];

    const lightNext = () => {
      if (step >= redTarget.length) {
        setFlashIndex(-1);
        timers.push(window.setTimeout(() => setRedPhase("input"), FLASH_GAP_MS));
        return;
      }
      const current = step;
      setFlashIndex(current);
      timers.push(
        window.setTimeout(() => {
          setFlashIndex(-1);
          step += 1;
          timers.push(window.setTimeout(lightNext, FLASH_GAP_MS));
        }, FLASH_ON_MS)
      );
    };

    timers.push(window.setTimeout(lightNext, FLASH_GAP_MS));
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [mode, redPhase, redTarget]);

  if (!open) {
    return null;
  }

  function startRedTrial() {
    setSequenceInput([]);
    setRedTarget(randomSequence());
    setFlashIndex(-1);
    setRedPhase("watch");
    setMode("red");
  }

  function replayRedSequence() {
    setSequenceInput([]);
    setFlashIndex(-1);
    setRedPhase("watch");
  }

  function resetToChoice() {
    setMode("choice");
    setAnswers({});
    setSequenceInput([]);
    setResult(null);
    setRedTarget([]);
    setRedPhase("watch");
    setFlashIndex(-1);
  }

  function closePanel() {
    resetToChoice();
    onClose();
  }

  function finishBlueTrial() {
    const quizResult = evaluateQuiz(
      BLUE_TRIAL_QUESTIONS.map(
        (question) => answers[question.id] === question.correctIndex
      )
    );

    setResult(
      quizResult.passed
        ? {
            passed: true,
            title: "Kiki keeps a clear mind",
            message: `The oracle accepts ${quizResult.correct} of 3 answers and lets Kiki pass through the tide gate.`,
          }
        : {
            passed: false,
            title: "The oracle clouds Kiki's thoughts",
            message: `Only ${quizResult.correct} of 3 answers were right. The tide whispers in circles. Try again when Kiki is ready.`,
          }
    );
    onTrialResult?.(quizResult.passed);
    setMode("result");
  }

  function chooseColor(color: OracleColor) {
    // Taps only count once the watch phase is over.
    if (redPhase !== "input") {
      return;
    }

    const nextInput = [...sequenceInput, color];
    setSequenceInput(nextInput);

    if (nextInput.length !== redTarget.length) {
      return;
    }

    const passed = evaluateSequence(redTarget, nextInput);
    setResult(
      passed
        ? {
            passed: true,
            title: "Kiki reads the current",
            message:
              "The red pill sharpens Kiki's reflexes. The octopus opens a bright path through the waves.",
          }
        : {
            passed: false,
            title: "Ink everywhere",
            message:
              "Kiki lost the pattern, and the oracle fills the water with harmless ink. Reset the sequence and try again.",
          }
    );
    onTrialResult?.(passed);
    setMode("result");
  }

  const answeredCount = Object.keys(answers).length;

  const panel = (
    <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-end p-4 sm:p-6">
      <section className="pointer-events-auto relative flex h-[min(920px,calc(100vh-2rem))] w-[min(1120px,calc(100vw-2rem))] flex-col overflow-hidden rounded-[28px] border-[10px] border-[#24475b] bg-[#041018] text-white shadow-2xl ring-4 ring-cyan-300/40 sm:h-[min(940px,calc(100vh-3rem))] sm:w-[min(1120px,70vw)]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[repeating-radial-gradient(circle_at_20%_20%,rgba(34,211,238,0.18)_0,rgba(34,211,238,0.18)_2px,transparent_2px,transparent_42px)]" />
        <div className="pointer-events-none absolute -right-20 -top-20 size-56 rounded-full bg-cyan-300/10" />

        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          className="absolute right-7 top-7 z-10 size-14 rounded-full border-2 border-cyan-200/70 bg-cyan-950/80 text-cyan-50 shadow-lg hover:bg-cyan-800"
          onClick={closePanel}
          aria-label="Close octopus oracle"
        >
          <IconX className="size-7" aria-hidden="true" />
        </Button>

        <div className="relative px-10 pb-8 pt-16 sm:px-16 sm:pt-18">
          <p className="mb-5 text-base font-semibold uppercase tracking-wide text-cyan-200">
            Kiki's Octopus Oracle
          </p>
          <h2 className="max-w-[860px] text-6xl font-black leading-none sm:text-7xl">
            Choose the pill the tide offers
          </h2>
          <p className="mt-6 max-w-[860px] text-2xl leading-relaxed text-white/72">
            The octopus guards two trials for Kiki: a blue memory test and a red
            reflex pattern.
          </p>
        </div>

        <div className="relative flex flex-1 flex-col gap-6 overflow-y-auto px-10 pb-10 sm:px-16 sm:pb-16">
          {mode === "choice" && (
            <div className="grid gap-5 lg:grid-cols-2">
              <button
                type="button"
                className="rounded-[22px] border border-sky-300/40 bg-sky-500/15 p-8 text-left shadow-lg transition hover:bg-sky-500/25 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200/70"
                onClick={() => setMode("blue")}
              >
                <IconBrain className="mb-6 size-14 text-sky-200" aria-hidden="true" />
                <h3 className="text-4xl font-black">Blue pill</h3>
                <p className="mt-4 text-xl leading-relaxed text-white/70">
                  Answer 3 questions. Kiki needs at least 2 correct answers to
                  satisfy the oracle.
                </p>
              </button>

              <button
                type="button"
                className="rounded-[22px] border border-red-300/40 bg-red-500/15 p-8 text-left shadow-lg transition hover:bg-red-500/25 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-200/70"
                onClick={startRedTrial}
              >
                <IconRipple className="mb-6 size-14 text-red-200" aria-hidden="true" />
                <h3 className="text-4xl font-black">Red pill</h3>
                <p className="mt-4 text-xl leading-relaxed text-white/70">
                  Watch the oracle flash four pearls, then tap them back in the
                  exact order before the ink spreads.
                </p>
              </button>
            </div>
          )}

          {mode === "blue" && (
            <div className="rounded-[22px] border border-cyan-300/20 bg-black/25">
              <div className="flex items-center justify-between gap-4 rounded-t-[22px] bg-sky-400 px-8 py-5 text-sky-950">
                <h3 className="text-2xl font-black uppercase tracking-wide">
                  Memory trial
                </h3>
                <span className="rounded-full bg-white/30 px-5 py-2 text-base font-black">
                  {answeredCount}/3 answered
                </span>
              </div>

              <div className="flex flex-col divide-y divide-white/10">
                {BLUE_TRIAL_QUESTIONS.map((question, questionIndex) => (
                  <fieldset key={question.id} className="p-7">
                    <legend className="text-2xl font-black">
                      {questionIndex + 1}. {question.question}
                    </legend>
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      {question.options.map((option, optionIndex) => {
                        const selected = answers[question.id] === optionIndex;
                        return (
                          <button
                            type="button"
                            key={option}
                            className={`rounded-full border px-5 py-4 text-lg font-bold transition ${
                              selected
                                ? "border-sky-200 bg-sky-300 text-sky-950"
                                : "border-white/15 bg-white/5 text-white hover:bg-white/10"
                            }`}
                            onClick={() =>
                              setAnswers((current) => ({
                                ...current,
                                [question.id]: optionIndex,
                              }))
                            }
                          >
                            {option}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                ))}
              </div>

              <div className="flex justify-end gap-3 border-t border-white/10 p-7">
                <Button type="button" variant="outline" className="h-12 px-6 text-base" onClick={resetToChoice}>
                  Back
                </Button>
                <Button
                  type="button"
                  className="h-12 bg-sky-300 px-6 text-base font-black text-sky-950 hover:bg-sky-200"
                  disabled={answeredCount < BLUE_TRIAL_QUESTIONS.length}
                  onClick={finishBlueTrial}
                >
                  Ask the oracle
                </Button>
              </div>
            </div>
          )}

          {mode === "red" && (
            <div className="rounded-[22px] border border-red-300/20 bg-black/25">
              <div className="flex items-center justify-between gap-4 rounded-t-[22px] bg-red-500 px-8 py-5 text-red-50">
                <h3 className="text-2xl font-black uppercase tracking-wide">
                  Reflex trial
                </h3>
                <span className="rounded-full bg-white/25 px-5 py-2 text-base font-black">
                  {redPhase === "watch"
                    ? "Watch the pearls"
                    : `Your turn · ${sequenceInput.length}/${redTarget.length}`}
                </span>
              </div>

              <div className="p-8">
                <p className="text-xl text-white/72">
                  {redPhase === "watch"
                    ? "The oracle is flashing the order. Watch closely…"
                    : "Tap the four pearls in the exact order they lit up."}
                </p>

                {/* The four pearls. During the watch phase the active one lights
                    up; during input they sit dim as a reference board. */}
                <div className="mt-6 flex flex-wrap justify-center gap-6">
                  {redTarget.map((color, index) => {
                    const lit = redPhase === "watch" && flashIndex === index;
                    return (
                      <div
                        key={`${color}-${index}`}
                        className={`flex size-28 items-center justify-center rounded-full text-3xl font-black shadow-lg transition-all duration-150 ${
                          lit
                            ? `scale-110 ring-4 ring-white ${COLOR_STYLES[color]}`
                            : "scale-95 bg-white/10 text-white/30"
                        }`}
                      >
                        {lit ? "●" : "?"}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {(Object.keys(COLOR_STYLES) as OracleColor[]).map((color) => (
                    <button
                      type="button"
                      key={color}
                      disabled={redPhase !== "input"}
                      className={`rounded-full px-6 py-5 text-xl font-black transition hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/40 disabled:cursor-not-allowed disabled:opacity-40 ${COLOR_STYLES[color]}`}
                      onClick={() => chooseColor(color)}
                    >
                      {colorLabel(color)}
                    </button>
                  ))}
                </div>

                <div className="mt-6 flex min-h-12 flex-wrap items-center gap-3 text-lg font-bold text-white/70">
                  Kiki's answer:
                  {sequenceInput.length === 0 ? (
                    <span className="text-white/40">No pearls chosen yet</span>
                  ) : (
                    sequenceInput.map((color, index) => (
                      <span
                        key={`${color}-${index}`}
                        className={`rounded-full px-4 py-2 text-base ${COLOR_STYLES[color]}`}
                      >
                        {colorLabel(color)}
                      </span>
                    ))
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-white/10 p-7">
                <Button type="button" variant="outline" className="h-12 px-6 text-base" onClick={resetToChoice}>
                  Back
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 px-6 text-base"
                  disabled={redPhase === "watch"}
                  onClick={replayRedSequence}
                >
                  Watch again
                </Button>
              </div>
            </div>
          )}

          {mode === "result" && result && (
            <div
              className={`rounded-[22px] border p-10 ${
                result.passed
                  ? "border-emerald-300/40 bg-emerald-400/15"
                  : "border-amber-300/40 bg-amber-400/15"
              }`}
            >
              <IconCircleCheck
                className={`mb-6 size-16 ${
                  result.passed ? "text-emerald-200" : "text-amber-200"
                }`}
                aria-hidden="true"
              />
              <h3 className="text-5xl font-black">{result.title}</h3>
              <p className="mt-5 max-w-[820px] text-2xl leading-relaxed text-white/75">
                {result.message}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button
                  type="button"
                  className="h-12 bg-cyan-300 px-6 text-base font-black text-cyan-950 hover:bg-cyan-200"
                  onClick={resetToChoice}
                >
                  Try another pill
                </Button>
                <Button type="button" variant="outline" className="h-12 px-6 text-base" onClick={closePanel}>
                  Return to island
                </Button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 text-base text-cyan-100/70">
            <IconSparkles className="size-5" aria-hidden="true" />
            The oracle resets when Kiki leaves the panel.
          </div>
        </div>
      </section>
    </div>
  );

  return createPortal(panel, document.body);
}
