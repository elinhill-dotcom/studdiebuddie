/**
 * Server-only tutor types. Never import from client components.
 */

export type TutorEvaluation =
  | "correct"
  | "partially_correct"
  | "incorrect"
  | "not_assessable";

export type TutorNextAction =
  | "next_question"
  | "small_hint"
  | "strong_hint"
  | "explain"
  | "clarify";

/** Internal model output — only student_message is meant for the chat UI. */
export type TutorTurn = {
  student_message: string;
  evaluation: TutorEvaluation;
  topic: string;
  next_action: TutorNextAction;
  confidence: number;
};

export type GeneratedQuestion = {
  prompt: string;
  expectedAnswer: string;
  tip?: string;
  topic?: string;
};

export type GenerateQuestionsResult = {
  questions: GeneratedQuestion[];
};
