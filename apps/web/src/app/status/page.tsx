import type { Metadata } from 'next';
import { HealthStatus } from '@/features/health/health-status';

export const metadata: Metadata = { title: 'Estado · Bolsillo' };

/** Public system status (API and database), from phase 0. */
export default function StatusPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-3xl font-semibold tracking-tight">Bolsillo</h1>
      <HealthStatus />
    </main>
  );
}
