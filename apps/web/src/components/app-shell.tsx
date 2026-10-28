'use client';

import { useQueryClient } from '@bolsillo/api-client';
import {
  ArrowLeftRight,
  House,
  ListOrdered,
  LogOut,
  type LucideIcon,
  Plus,
  Tags,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { authStrings } from '@/features/auth/strings';
import { authClient } from '@/lib/auth-client';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const NAV: NavItem[] = [
  { href: '/', label: 'Inicio', icon: House },
  { href: '/transactions', label: 'Movimientos', icon: ListOrdered },
  { href: '/accounts', label: 'Cuentas', icon: Wallet },
  { href: '/categories', label: 'Categorías', icon: Tags },
];

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();

  const signOut = async () => {
    await authClient.signOut();
    queryClient.clear();
    router.replace('/sign-in');
    router.refresh();
  };

  return (
    <div className="flex min-h-full flex-1">
      <aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col gap-6 border-r p-4 md:flex">
        <Link href="/" className="px-2 text-xl font-semibold tracking-tight">
          Bolsillo
        </Link>
        <div className="flex flex-col gap-2">
          <Link href="/transactions/new" className={buttonVariants({ size: 'lg' })}>
            <Plus data-icon="inline-start" />
            Nuevo movimiento
          </Link>
          <Link href="/transfer" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
            <ArrowLeftRight data-icon="inline-start" />
            Transferencia
          </Link>
        </div>
        <nav aria-label="Principal" className="flex flex-col gap-1">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(pathname, href) ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-muted',
                isActive(pathname, href) && 'bg-muted font-medium',
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-2 border-t pt-4">
          {session ? (
            <p className="truncate px-2 text-sm text-muted-foreground">{session.user.name}</p>
          ) : null}
          <Button variant="ghost" className="justify-start" onClick={signOut}>
            <LogOut data-icon="inline-start" />
            {authStrings.signOut}
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col pb-20 md:pb-0">
        <header className="flex items-center justify-between border-b px-4 py-3 md:hidden">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            Bolsillo
          </Link>
          <Button variant="ghost" size="icon" onClick={signOut} aria-label={authStrings.signOut}>
            <LogOut />
          </Button>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 p-4 md:p-8">{children}</main>
      </div>

      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-5 border-t bg-background md:hidden"
      >
        {NAV.slice(0, 2).map((item) => (
          <BottomLink key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}
        <Link
          href="/transactions/new"
          aria-label="Nuevo movimiento"
          className="flex min-h-14 items-center justify-center"
        >
          <span className="flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Plus className="size-5" aria-hidden="true" />
          </span>
        </Link>
        {NAV.slice(2).map((item) => (
          <BottomLink key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}
      </nav>
    </div>
  );
}

function BottomLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex min-h-14 flex-col items-center justify-center gap-1 text-xs text-muted-foreground',
        active && 'font-medium text-foreground',
      )}
    >
      <Icon className="size-5" aria-hidden="true" />
      {item.label}
    </Link>
  );
}
