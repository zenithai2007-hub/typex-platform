import type { Metadata } from 'next';
import Shell from '../components/Shell';
import './globals.css';

export const metadata: Metadata = {
  title: 'Clint X — Control Center',
  description: 'Universal AI execution platform — agents, tasks, approvals, audit.',
  icons: {
    icon: '/favicon.png',
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
