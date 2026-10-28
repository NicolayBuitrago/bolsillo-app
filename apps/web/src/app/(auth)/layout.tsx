import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
      <p className="text-2xl font-semibold tracking-tight">Bolsillo</p>
      {children}
    </main>
  );
}
