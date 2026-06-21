export type OracleColor = "blue" | "red" | "violet" | "amber";

export interface OracleQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
}

export const BLUE_TRIAL_QUESTIONS: OracleQuestion[] = [
  {
    id: "pineapple-home",
    question: "Who lives in a pineapple under the sea?",
    options: ["Sandy Cheeks", "SpongeBob SquarePants", "Patrick Star"],
    correctIndex: 1,
  },
  {
    id: "moon-landing",
    question: "In what year did humans first land on the Moon?",
    options: ["1969", "1977", "1984"],
    correctIndex: 0,
  },
  {
    id: "octopus-arms",
    question: "How many arms does an octopus have?",
    options: ["Six", "Eight", "Ten"],
    correctIndex: 1,
  },
];

export const RED_TRIAL_SEQUENCE: OracleColor[] = ["blue", "red", "violet", "amber"];

// The four pearls the reflex trial uses. Each round shuffles these into a fresh
// order for the player to memorize and repeat.
export const RED_TRIAL_COLORS: OracleColor[] = [
  "blue",
  "red",
  "violet",
  "amber",
];

// A random permutation of the four pearls (Fisher–Yates). Optionally seeded with
// an injected random fn so the shuffle is testable.
export function randomSequence(random: () => number = Math.random): OracleColor[] {
  const colors = [...RED_TRIAL_COLORS];
  for (let i = colors.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [colors[i], colors[j]] = [colors[j], colors[i]];
  }
  return colors;
}

export function evaluateQuiz(results: boolean[]) {
  const correct = results.filter(Boolean).length;

  return {
    passed: correct >= 2,
    correct,
  };
}

export function evaluateSequence(
  expected: OracleColor[],
  actual: OracleColor[]
): boolean {
  return (
    expected.length === actual.length &&
    expected.every((color, index) => color === actual[index])
  );
}
