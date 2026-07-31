import { Link } from "@tanstack/react-router";

import type { SubjectReference, SubjectReferences } from "@bluelearn/schemas";

import { CollapsibleSection } from "@/components/CollapsibleSection";

import { Route as SubjectRoute } from "@/routes/subjects.$slug";

type SubjectsGroupedByChar = Map<string, SubjectReferences>;

type SubjectsProps = {
  groupedSubject: SubjectsGroupedByChar;
};

export const SubjectSidebar = ({ groupedSubject }: SubjectsProps) => {
  return (
    <aside className="hidden overflow-y-auto border-r px-6 md:block">
      {Array.from(groupedSubject.entries()).map(([char, subjects]) => (
        <CollapsibleSection key={char} title={char}>
          <ul className="space-y-2">
            {subjects.map((subject: SubjectReference) => (
              <li
                key={subject.slug}
                className="pl-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                <Link to={SubjectRoute.to} params={{ slug: subject.slug }}>
                  {subject.name}
                </Link>
              </li>
            ))}
          </ul>
        </CollapsibleSection>
      ))}
    </aside>
  );
};
