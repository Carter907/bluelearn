export const ChangeRow = ({
  label,
  badge,
}: {
  label: string;
  badge?: React.ReactNode;
}) => {
  return (
    <li className="flex items-center justify-between gap-2 text-xs">
      <span className="min-w-0 truncate">{label}</span>
      {badge}
    </li>
  );
};
