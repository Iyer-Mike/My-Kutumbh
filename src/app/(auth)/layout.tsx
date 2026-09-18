export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex-1 flex flex-col items-center justify-center min-h-screen px-4 py-safe">
      {children}
    </main>
  );
}
