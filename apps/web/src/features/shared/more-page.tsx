'use client';

import {
  Activity,
  ArrowLeftRight,
  ChartColumn,
  ChevronRight,
  PiggyBank,
  Repeat,
  Tags,
} from 'lucide-react';
import Link from 'next/link';

const LINKS = [
  { href: '/budgets', label: 'Presupuestos', icon: PiggyBank },
  { href: '/recurring', label: 'Pagos recurrentes', icon: Repeat },
  { href: '/reports', label: 'Reportes y exportar CSV', icon: ChartColumn },
  { href: '/transfer', label: 'Transferencia', icon: ArrowLeftRight },
  { href: '/categories', label: 'Categorías', icon: Tags },
  { href: '/status', label: 'Estado del sistema', icon: Activity },
];

/** Narrow screens: sections that do not fit in the bottom bar. */
export function MorePage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Más</h1>
      <nav aria-label="Más secciones">
        <ul className="divide-y rounded-xl ring-1 ring-foreground/10">
          {LINKS.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link href={href} className="flex min-h-14 items-center gap-3 px-4 hover:bg-muted">
                <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
                <span className="flex-1">{label}</span>
                <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
