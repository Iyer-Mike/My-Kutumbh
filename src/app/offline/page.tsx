export default function OfflinePage() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center min-h-screen px-4 text-center">
      <h1 className="font-[family-name:var(--font-dm-serif)] text-2xl text-(--color-text) mb-2">
        You&apos;re offline
      </h1>
      <p className="text-sm text-(--color-muted)">
        Check your connection and try again.
      </p>
    </main>
  );
}
