import type { Metadata } from 'next';
import { TxProvider } from '../components/tx-store';
import AppShell from '../components/AppShell';
import './globals.css';

export const metadata: Metadata = {
  title: 'Clint X — AI Execution Workspace',
  description: 'Clint X — universal AI execution platform. Agents, platform connections, approvals, audit.',
  icons: {
    icon: '/favicon.png',
    apple: '/apple-touch-icon.png',
  },
};

const THEME_INIT = `(function(){try{var t=localStorage.getItem('clintx-theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <TxProvider>
          <AppShell>{children}</AppShell>
        </TxProvider>
      </body>
    </html>
  );
}
