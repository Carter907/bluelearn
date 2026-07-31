import type { SubjectListItem } from "@bluelearn/schemas";

type Subjects = Array<SubjectListItem>;

type SubjectsGroupedByChar = Map<string, Subjects>;

const FIRST_LETTER_NUMBER_SUBJECT_GROUP = "#";

export const getSubjectsGroupedByChar = (
  subjects: Subjects
): SubjectsGroupedByChar => {
  const grouped: SubjectsGroupedByChar = new Map();
  const isAlphabet = /^[a-z]$/i;

  if (subjects.length === 0) return grouped;

  const sorted = [...subjects].sort((a, b) => {
    const firstA = a.name.at(0) ?? "";
    const firstB = b.name.at(0) ?? "";

    const aIsNum = /^\d/.test(firstA);
    const bIsNum = /^\d/.test(firstB);

    if (aIsNum === bIsNum) {
      return firstA.localeCompare(firstB);
    }

    return aIsNum ? -1 : 1;
  });

  for (const subject of sorted) {
    const first = subject.name.at(0)?.toUpperCase() ?? "";

    const key = isAlphabet.test(first)
      ? first
      : FIRST_LETTER_NUMBER_SUBJECT_GROUP;

    const currentSubjects = grouped.get(key) ?? [];

    grouped.set(key, [...currentSubjects, subject]);
  }

  return grouped;
};
