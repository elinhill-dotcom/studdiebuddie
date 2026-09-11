/** Språk för förhörschatt / frågegenerering */

export type TutorLang = "sv" | "en" | "es" | "de";

export function tutorLangFromSubject(subject?: string | null): TutorLang {
  switch (subject) {
    case "Engelska":
      return "en";
    case "Spanska":
      return "es";
    case "Tyska":
      return "de";
    default:
      return "sv";
  }
}

export function tutorLangLabel(lang: TutorLang) {
  switch (lang) {
    case "en":
      return "engelska";
    case "es":
      return "spanska";
    case "de":
      return "tyska";
    default:
      return "svenska";
  }
}

/** Om flera läxor: använd målspråk bara om alla delar samma språkämmne */
export function tutorLangFromSubjects(subjects: Array<string | undefined>) {
  const langs = subjects.map((s) => tutorLangFromSubject(s));
  if (langs.length && langs.every((l) => l === langs[0]) && langs[0] !== "sv") {
    return langs[0];
  }
  return "sv" as TutorLang;
}
