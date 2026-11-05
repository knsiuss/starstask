export function ClassUnlinkedNotice() {
  return (
    <div className="border-border bg-muted rounded-2xl border p-6 text-sm">
      <p className="font-medium">Not linked to a university yet</p>
      <p className="text-muted-foreground mt-1">
        This class is not linked to a university in the academic registry, so
        the new academic domains (offerings, enrollments, normalized attendance,
        announcements) have no data here. A platform operator can link the class
        once the university is activated.
      </p>
    </div>
  );
}
