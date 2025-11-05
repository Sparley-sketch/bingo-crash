import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Bingo Crash',
  description: 'Playable demo and admin on Vercel',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
