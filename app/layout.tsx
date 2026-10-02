import './globals.css';
import type { Metadata } from 'next';
import Toaster from '@/components/Toaster';
import QuickAddProvider from './quick-add/QuickAddProvider';
import React from 'react';

export const metadata: Metadata = {
  title: 'Clarity',
  description: '오프라인으로 사용하는 개인 일정과 할 일',
  manifest: '/manifest.webmanifest',
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0b1730' },
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
  ],
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: { url: '/icons/icon-192.png' },
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Clarity',
  },
  applicationName: 'Clarity',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="min-h-screen">
        <QuickAddProvider>
          <main className="w-full px-4 sm:px-6 lg:px-8">
            {children}
          </main>
          <Toaster />
        </QuickAddProvider>
      </body>
    </html>
  );
}
