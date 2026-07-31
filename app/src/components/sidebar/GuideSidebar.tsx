import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import type { Guide, GuideReference } from "@bluelearn/schemas";
import type { LucideIcon } from "lucide-react";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { extractHeadings } from "@/lib/guideUtils";

export type Action = {
  icon: LucideIcon;
  label: string;
};

type PropTypes = {
  guide: Guide;
  slug: string;
  sidebarActions?: React.ReactNode;
  reviewSection?: React.ReactNode;
};

export const GuideSidebar = ({
  guide,
  slug,
  sidebarActions,
  reviewSection,
}: PropTypes) => {
  const headings = useMemo(
    () => extractHeadings(guide.body ?? ""),
    [guide.body]
  );

  return (
    <aside className="h-[calc(100vh-70px)] overflow-y-auto border-r px-6 py-6">
      {sidebarActions}

      {/* Prerequisites */}
      <CollapsibleSection title={<p className="ml-auto">Prerequisites</p>}>
        <ul className="space-y-2">
          {guide.prerequisites.map((prereq: GuideReference) => (
            <li
              key={prereq.slug}
              className="text-sm text-muted-foreground hover:text-foreground"
              style={{
                paddingLeft: 6,
              }}
            >
              <Link
                to="/guides/$slug"
                params={{ slug: prereq.slug }}
                state={{
                  breadcrumbOrigin: {
                    type: "guide",
                    title: guide.title,
                    path: `/guides/${slug}`,
                  },
                }}
              >
                {prereq.title}
              </Link>
            </li>
          ))}
        </ul>
      </CollapsibleSection>

      {/* TOC */}
      <CollapsibleSection
        title={<p className="ml-auto">Table of Contents</p>}
        defaultOpen={true}
      >
        <ul className="space-y-2">
          {headings.map((h, idx) => (
            <li
              key={idx}
              className="cursor-pointer text-sm text-muted-foreground hover:text-foreground"
              style={{
                paddingLeft:
                  h.level === 1
                    ? 6
                    : h.level === 2
                      ? 12
                      : h.level === 3
                        ? 24
                        : 28,
              }}
            >
              {h.text}
            </li>
          ))}
        </ul>
      </CollapsibleSection>

      {reviewSection}
    </aside>
  );
};
