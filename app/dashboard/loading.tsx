export default function DashboardLoading() {
  return (
    <div className="flex animate-pulse flex-col gap-8">
      <div className="h-8 w-48 rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
        <div className="h-96 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
        <div className="flex flex-col gap-3">
          <div className="h-20 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-20 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-20 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
        </div>
      </div>
    </div>
  );
}
