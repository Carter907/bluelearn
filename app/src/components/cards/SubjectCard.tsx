import { Link } from "@tanstack/react-router";
import type { Subject } from "@/types/subjects";

import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Footer } from "@/components/cards/Footer";

import { Route as SubjectRoute } from "@/routes/subjects.$slug";

type SubjectProp = Subject & {
  stats?: Array<{ label: string; data: number }>;
  actionBtns?: React.ReactNode;
};

type PropTypes = {
  subject: SubjectProp;
};

export const SubjectCard = ({ subject }: PropTypes) => {
  return (
    <Card className="group rounded-md bg-background shadow-none transition-colors hover:bg-muted">
      {/* Header */}
      <CardHeader className="p-6">
        <div className="flex items-center justify-between">
          <p className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
            Subject
          </p>
          {subject.status && (
            <Badge
              variant="outline"
              className="mono-micro rounded-full border border-badge-border bg-badge tracking-[0.08em] text-badge-foreground"
            >
              {subject.status}
            </Badge>
          )}
        </div>

        <Link to={SubjectRoute.to} params={{ slug: subject.slug }}>
          <h3 className="line-clamp-2 text-xl font-semibold tracking-tight">
            {subject.name}
          </h3>
        </Link>

        <p className="max-w-2xl text-sm text-muted-foreground">
          {subject.summary}
        </p>
      </CardHeader>

      {/* Footer */}
      {(subject.stats || subject.actionBtns) && (
        <Footer
          data={{ stats: subject.stats, actionBtns: subject.actionBtns }}
        />
      )}
    </Card>
  );
};
