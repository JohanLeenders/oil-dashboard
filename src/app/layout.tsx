import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'OIL - Oranjehoen Intelligence Layer',
  description: 'Commerciële cockpit voor vierkantsverwaarding en massabalans',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="nl">
      <body className="min-h-screen bg-gray-50 font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
