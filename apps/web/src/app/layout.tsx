import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Providers } from './providers';
import './globals.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'Bolsillo',
  description: 'Finanzas personales con captura automática de movimientos',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es-CO" className={cn('h-full font-sans antialiased', geist.variable)}>
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
