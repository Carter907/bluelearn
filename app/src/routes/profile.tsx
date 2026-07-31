import { createFileRoute, useNavigate } from "@tanstack/react-router";
import type {
  ActivityFilters,
  ActivitySort,
  ActivityStatusFilter,
  ActivityTypeFilter,
  ProfilePageData,
} from "@/lib/profile";
import {
  ACTIVITY_SORTS,
  ACTIVITY_STATUS_FILTERS,
  ACTIVITY_TYPE_FILTERS,
  activityStatusLabel,
  activityTypeLabel,
  filterActivity,
  getInitials,
  loadProfilePage,
} from "@/lib/profile";
import { formatDate } from "@/lib/guideUtils";
import { cn } from "@/lib/utils";
import { usePagination } from "@/lib/usePagination";
import { Pagination } from "@/components/Pagination";
import {
  ChoiceColumnFilter,
  DateColumnFilter,
  TextColumnFilter,
} from "@/components/ActivityColumnFilters";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

import { Badge } from "@/components/ui/badge";

type ProfileSearch = ActivityFilters & { page?: number };

function validString(value: unknown) {
  return typeof value === "string" && value ? value : undefined;
}

function validDate(value: unknown) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : undefined;
}

function validArray(value: unknown, allowed: ReadonlyArray<string>) {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? [value]
      : [];
  return raw.filter(
    (item): item is string => typeof item === "string" && allowed.includes(item)
  );
}

export const Route = createFileRoute("/profile")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): ProfileSearch => {
    const page = Number(search.page);
    const type = validArray(
      search.type,
      ACTIVITY_TYPE_FILTERS.map((f) => f.value)
    ) as Array<ActivityTypeFilter>;
    const status = validArray(
      search.status,
      ACTIVITY_STATUS_FILTERS.map((f) => f.value)
    ) as Array<ActivityStatusFilter>;
    return {
      type: type.length ? type : undefined,
      status: status.length ? status : undefined,
      title: validString(search.title),
      summary: validString(search.summary),
      from: validDate(search.from),
      to: validDate(search.to),
      sort: ACTIVITY_SORTS.includes(search.sort as ActivitySort)
        ? (search.sort as ActivitySort)
        : undefined,
      page: Number.isInteger(page) && page > 1 ? page : undefined,
    };
  },
  loader: ({ abortController }) => loadProfilePage(abortController.signal),
  component: RouteComponent,
  pendingComponent: () => <ProfileMessage>Loading profile...</ProfileMessage>,
  errorComponent: ({ error }) => (
    // TODO: improve error component - add greyscale mascot with "X" eyes
    <ProfileMessage tone="error">{error.message}</ProfileMessage>
  ),
});

function ProfileMessage({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "muted" | "error";
}) {
  return (
    <div className="mx-auto max-w-7xl border-x bg-background px-8 py-10 lg:px-16">
      <p
        className={
          tone === "error"
            ? "text-sm text-red-600"
            : "text-sm text-muted-foreground"
        }
      >
        {children}
      </p>
    </div>
  );
}

const PAGE_SIZE = 10;

type ActivityRow = ProfilePageData["activity"][number];
function rowTarget(row: ActivityRow) {
  if (row.content_kind === "review")
    return row.base_slug
      ? { to: "/guides/$slug", params: { slug: row.base_slug } }
      : null;
  if (
    row.content_kind === "guide" &&
    row.status === "published" &&
    row.base_slug
  )
    return { to: "/guides/$slug", params: { slug: row.base_slug } };
  // A draft on a guide that is already published is an edit, not a new guide.
  if (
    row.content_kind === "guide" &&
    row.status === "draft" &&
    row.revision_id &&
    row.base_slug &&
    row.target_slug
  )
    return {
      to: "/guides/$slug/$variantSlug/edit",
      params: { slug: row.base_slug, variantSlug: row.target_slug },
      search: { draft: row.revision_id },
    };
  if (row.content_kind === "guide" && row.status === "draft" && row.revision_id)
    return { to: "/contribute", search: { draft: row.revision_id } };
  if (
    row.content_kind === "objective" &&
    row.status === "published" &&
    row.target_slug
  )
    return { to: "/objectives/$slug", params: { slug: row.target_slug } };
  if (
    row.content_kind === "objective" &&
    row.status === "draft" &&
    row.revision_id
  )
    return {
      to: "/contribute",
      search: { draft: row.revision_id, kind: "objective" as const },
    };
  return null;
}

function ProfilePage({ profile, roles, stats, activity }: ProfilePageData) {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const setFilters = (next: Partial<ActivityFilters>) =>
    navigate({
      to: "/profile",
      search: (prev) => ({ ...prev, ...next, page: undefined }),
      replace: true,
    });

  const filtered = filterActivity(activity, search);
  const hasFilters = Boolean(
    search.type?.length ||
    search.status?.length ||
    search.title ||
    search.summary ||
    search.from ||
    search.to
  );

  const {
    page,
    totalPages,
    pageRows,
    start,
    goToPage,
    toFirst,
    onPrevious,
    onNext,
    toLast,
  } = usePagination(filtered, PAGE_SIZE, {
    page: search.page ?? 1,
    onPageChange: (next) =>
      navigate({
        to: "/profile",
        search: (prev) => ({ ...prev, page: next === 1 ? undefined : next }),
        replace: true,
      }),
  });

  // Hide review stat for non-verifiers.
  const isVerifier = roles.includes("verifier");
  const statsRows = [
    { label: "Upvotes", value: stats.upvotes },
    { label: "Downvotes", value: stats.downvotes },
    { label: "Contributions", value: stats.contributions },
    ...(isVerifier ? [{ label: "Reviews", value: stats.reviews }] : []),
  ];

  const initials = getInitials(profile.display_name || profile.username);

  return (
    <div className="mx-auto max-w-7xl border-x bg-background">
      <section className="border-b px-8 py-10 lg:px-16">
        <div className="mx-auto mb-6 flex w-full max-w-5xl flex-col items-center gap-8 px-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-5">
            <Avatar className="size-28 shrink-0 bg-muted">
              <AvatarImage />
              <AvatarFallback className="bg-muted text-2xl font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>

            <div className="flex flex-col">
              <h2 className="text-3xl font-bold">
                {profile.display_name ?? profile.username}
              </h2>
              <h3 className="mono-micro text-muted-foreground/80">
                @{profile.username}
              </h3>

              {roles.length > 0 && (
                <ul className="mt-2.5 flex flex-wrap items-center gap-2">
                  {roles.map((role) => (
                    <li key={role}>
                      <Badge
                        variant="outline"
                        className="mono-micro rounded-full border border-badge-border bg-badge tracking-[0.08em] text-badge-foreground"
                      >
                        {role}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <ul
            className={cn(
              "grid items-start gap-x-6",
              isVerifier ? "grid-cols-4" : "grid-cols-3"
            )}
          >
            {statsRows.map((stat) => (
              <li
                key={stat.label}
                className="flex min-w-24 flex-col items-center gap-1"
              >
                <h3 className="data-label leading-none">{stat.label}</h3>
                <p className="data-value text-2xl! leading-none">
                  {stat.value}
                </p>
              </li>
            ))}
          </ul>
        </div>

        <Separator className="mb-8 bg-border" />

        <div className="overflow-x-auto">
          <Table className="mx-auto w-full max-w-5xl">
            <TableHeader>
              <TableRow>
                <TableHead className="px-4 py-3 font-mono text-[14px] font-bold tracking-[0.08em] uppercase">
                  <ChoiceColumnFilter
                    label="Type"
                    field="type"
                    options={ACTIVITY_TYPE_FILTERS}
                    search={search}
                    setFilters={setFilters}
                  />
                </TableHead>
                <TableHead className="px-4 py-3 font-mono text-[14px] font-bold tracking-[0.08em] uppercase">
                  <TextColumnFilter
                    label="Title"
                    field="title"
                    search={search}
                    setFilters={setFilters}
                  />
                </TableHead>
                <TableHead className="px-4 py-3 font-mono text-[14px] font-bold tracking-[0.08em] uppercase">
                  <TextColumnFilter
                    label="Change Summary"
                    field="summary"
                    search={search}
                    setFilters={setFilters}
                  />
                </TableHead>
                <TableHead className="px-4 py-3 font-mono text-[14px] font-bold tracking-[0.08em] uppercase">
                  <DateColumnFilter search={search} setFilters={setFilters} />
                </TableHead>
                <TableHead className="px-4 py-3 font-mono text-[14px] font-bold tracking-[0.08em] uppercase">
                  <ChoiceColumnFilter
                    label="Status"
                    field="status"
                    options={ACTIVITY_STATUS_FILTERS}
                    search={search}
                    setFilters={setFilters}
                  />
                </TableHead>
                <TableHead className="px-4 py-3 font-mono text-[14px] font-bold tracking-[0.08em] uppercase">
                  Review Case
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="px-4 py-6 text-center text-sm text-muted-foreground"
                  >
                    {hasFilters
                      ? "No activity matches these filters."
                      : "No activity available yet."}
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map((row, index) => {
                  const target = rowTarget(row);
                  return (
                    <TableRow
                      key={`${row.content_kind}-${start + index}`}
                      className={target ? "cursor-pointer" : undefined}
                      onClick={target ? () => navigate(target) : undefined}
                    >
                      <TableCell className="px-4 py-3">
                        {activityTypeLabel(row)}
                      </TableCell>

                      <TableCell className="px-4 py-3">{row.title}</TableCell>

                      <TableCell className="px-4 py-3">
                        {row.change_summary}
                      </TableCell>

                      <TableCell className="mono-micro px-4 py-3">
                        {formatDate(new Date(row.created_at))}
                      </TableCell>

                      <TableCell className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className="mono-micro rounded-full border border-badge-border bg-badge tracking-[0.08em] text-badge-foreground"
                        >
                          {activityStatusLabel(row.status)}
                        </Badge>
                      </TableCell>

                      <TableCell className="px-4 py-3">
                        {row.review_case_id ? (
                          <Button
                            className="btn-pri"
                            size="lg"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate({
                                to: "/review/$caseId",
                                params: { caseId: row.review_case_id! },
                              });
                            }}
                          >
                            View case
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="mt-8">
            <Pagination
              activePageNo={page}
              onPageSelect={goToPage}
              toFirst={toFirst}
              onPrevious={onPrevious}
              onNext={onNext}
              toLast={toLast}
              totalPages={totalPages}
            />
          </div>
        )}
      </section>
    </div>
  );
}

function RouteComponent() {
  const data = Route.useLoaderData();
  return <ProfilePage {...data} />;
}
