import { HealthStatus } from '@/features/health/health-status';

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-3xl font-semibold tracking-tight">Bolsillo</h1>
      <HealthStatus />
    </main>
  );
}
