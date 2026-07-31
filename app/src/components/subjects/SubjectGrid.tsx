import type { SubjectListItem } from "@bluelearn/schemas";
import { SubjectCard } from "@/components/cards/SubjectCard";
import { Route as SubjectRoute } from "@/routes/subjects.$slug";

type SubjectsGridProps = {
  subjects: Array<SubjectListItem>;
};

export const SubjectsGrid = ({ subjects }: SubjectsGridProps) => {
  return (
    <div className="my-4 grid grid-cols-1 gap-6 md:my-0 md:ml-4 lg:grid-cols-2">
      {subjects.map((subject) => {
        const s = {
          ...subject,
          stats: [
            { label: "Objectives", data: subject.objectives_total },
            { label: "Guides", data: subject.guides_total },
          ],
        };
        return <SubjectCard key={s.slug} subject={s} to={SubjectRoute.to} />;
      })}
    </div>
  );
};
