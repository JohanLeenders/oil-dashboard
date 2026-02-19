import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'OIL - Oranjehoen Intelligence Layer',
  description: 'Commerciële cockpit voor vierkantsverwaarding en massabalans',
};

/**
 * Inline script that runs BEFORE React hydration to prevent FOUC (flash of unstyled content).
 * Reads localStorage and applies the 'dark' class to <html> immediately.
 */
const darkModeScript = `
(function() {
  try {
    var stored = localStorage.getItem('oil-dark-mode');
    if (stored === 'true' || (stored === null && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    }
  } catch(e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="nl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: darkModeScript }} />
      </head>
      <body className="min-h-screen bg-gray-50 dark:bg-gray-950 dark:text-gray-100 font-sans antialiased transition-colors">
        {children}
      </body>
    </html>
  );
}
