export const ChangeSection = ({
  count,
  empty,
  children,
}: {
  count: number;
  empty: string;
  children: React.ReactNode;
}) => {
  return (
    <div className="space-y-2">
      {count === 0 ? (
        <p className="text-xs text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-3">{children}</ul>
      )}
    </div>
  );
};
