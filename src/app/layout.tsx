import type { Metadata } from 'next';
import { Inter, JetBrains_Mono, Playfair_Display } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-brand' });

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
    <html lang="nl" className="dark">
      <body className={`${inter.variable} ${jetbrains.variable} ${playfair.variable} min-h-screen antialiased`}>
        {children}
      </body>
    </html>
  );
}
