import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Bingo Crash',
  description: 'Playable demo and admin on Vercel',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
