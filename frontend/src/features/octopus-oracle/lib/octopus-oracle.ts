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
