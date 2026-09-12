import type { QuizQuestion, QuizSession } from "./types";

/** Legacy mixed sessions cannot reliably attribute individual questions. */
export function belongsToHomework(q: QuizQuestion, s: QuizSession, id: string) {
  return q.homeworkId === id || (!q.homeworkId && s.homeworkIds.length === 1 && s.homeworkIds[0] === id);
}

export function homeworkPractice(sessions: QuizSession[], homeworkId: string) {
  const related = sessions.filter(s => s.homeworkIds.includes(homeworkId));
  const latest = new Map<string, { question: QuizQuestion; weak: boolean }>();
  let answered = 0;
  let correct = 0;
  for (const session of [...related].sort((a, b) => a.startedAt.localeCompare(b.startedAt))) {
    const answers = new Map(session.answers.map(a => [a.questionId, a]));
    for (const question of session.questions) {
      if (!belongsToHomework(question, session, homeworkId)) continue;
      const answer = answers.get(question.id);
      if (!answer || answer.pending) continue;
      answered++;
      if (answer.correct) correct++;
      const key = (question.expectedAnswer.trim() || question.prompt.trim()).toLocaleLowerCase();
      latest.set(key, { question, weak: !answer.correct || !!answer.needsPractice });
    }
  }
  const weakQuestions = [...latest.values()].filter(v => v.weak).map(v => v.question);
  return {
    sessions: related.filter(s => s.answers.length > 0).length,
    completed: related.filter(s => s.finishedAt).length,
    answered,
    percent: answered ? Math.round(correct / answered * 100) : null,
    weakQuestions,
  };
}
