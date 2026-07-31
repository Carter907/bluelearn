import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

import { Calendar, Clock, User } from "lucide-react";
import type { Guide } from "@bluelearn/schemas";
import type { GuideType } from "@/types/guides";
import type { ReactElement } from "react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components//ui/badge";
import { CodeBlock } from "@/components/CodeBlock";

import { formatDate, formatDuration } from "@/lib/guideUtils";

const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    img: [...(defaultSchema.attributes?.img ?? []), "width", "height"],
  },
};

// Tags only render as a name badge here, and a guide under review can carry
// subjects whose slug is not minted yet, so either identifier will do.
type ReaderTag = { id?: string; slug?: string; name: string };

export type ReaderGuide = Omit<Guide, "tags"> & { tags: Array<ReaderTag> };

type PropTypes = {
  guide: ReaderGuide;
  guideType?: GuideType;
};

export const GuideReader = ({ guide, guideType }: PropTypes) => {
  const created = new Date(guide.created_at);
  const createdLabel = Number.isNaN(created.getTime())
    ? guide.created_at
    : formatDate(created);

  return (
    <>
      <header className="mb-5">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">{guide.title}</h1>
          {guideType && (
            <Badge
              key={guideType}
              variant="outline"
              className="mono-micro rounded-full border bg-badge tracking-[0.08em] text-badge-foreground"
            >
              {guideType}
            </Badge>
          )}
        </div>

        <div className="mono-micro my-2 flex flex-wrap items-center gap-2.5 text-muted-foreground/80">
          {guide.author && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3 text-muted-foreground/75" />@
              {guide.author}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3 text-muted-foreground/75" />
            {createdLabel}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3 text-muted-foreground/75" />
            {formatDuration(guide.duration_minutes)}
          </span>
        </div>

        {guide.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {guide.tags.map((tag: ReaderTag) => (
              <Badge
                key={tag.id ?? tag.slug ?? tag.name}
                variant="outline"
                className="mono-micro rounded-full border bg-badge tracking-[0.08em] text-badge-foreground"
              >
                {tag.name}
              </Badge>
            ))}
          </div>
        )}

        {guide.summary && (
          <p className="mt-3 text-sm whitespace-pre-line text-muted-foreground">
            {guide.summary}
          </p>
        )}
      </header>

      <Separator className="mb-8" />

      <article className="markdown">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[
            rehypeRaw,
            [rehypeSanitize, sanitizeSchema],
            rehypeKatex,
          ]}
          components={{
            pre({ children }) {
              const child = children as ReactElement<{
                className?: string;
                children?: React.ReactNode;
              }>;

              const code = String(child.props.children).replace(/\n$/, "");
              const language = child.props.className?.replace("language-", "");

              return <CodeBlock code={code} language={language} />;
            },

            code({ children, className }) {
              if (className) {
                return <code className={className}>{children}</code>;
              }

              return (
                <code className="rounded bg-muted px-1 py-0.5 font-mono">
                  {children}
                </code>
              );
            },
          }}
        >
          {guide.body ?? ""}
        </ReactMarkdown>
      </article>
    </>
  );
};
