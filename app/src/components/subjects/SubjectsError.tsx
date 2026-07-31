export const SubjectsLoadError = () => {
  return (
    <p className="text-sm text-muted-foreground">
      Subjects could not be loaded. Try again shortly.
    </p>
  );
};

export const NoSubjectsError = () => {
  return <p className="text-sm text-muted-foreground">No subjects yet.</p>;
};
