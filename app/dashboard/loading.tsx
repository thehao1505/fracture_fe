export default function DashboardLoading() {
  return (
    <div className="flex animate-pulse flex-col gap-8">
      <div className="h-8 w-48 rounded-xl bg-zinc-200/70 dark:bg-white/10" />
      <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
        <div className="h-96 rounded-2xl bg-zinc-200/70 dark:bg-white/10" />
        <div className="flex flex-col gap-3">
          <div className="h-20 rounded-2xl bg-zinc-200/70 dark:bg-white/10" />
          <div className="h-20 rounded-2xl bg-zinc-200/70 dark:bg-white/10" />
          <div className="h-20 rounded-2xl bg-zinc-200/70 dark:bg-white/10" />
        </div>
      </div>
    </div>
  );
}
