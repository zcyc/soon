import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Manrope } from 'next/font/google';
import { Suspense } from 'react';
import Header from '@/components/header';
import Footer from '@/components/footer';
import { ThemeProvider } from '@/contexts/theme-context';
import { AuthProvider } from '@/contexts/auth-context';
import I18nProvider from '@/components/i18n-provider';
import { getServerDetectedLocale } from '@/lib/locale-detection';
import { getServerInitialTheme } from '@/lib/server-theme-detection';

export const metadata: Metadata = {
  title: 'SOON - Screen Recording Made Simple',
  description: 'Record your screen, camera, and audio with SOON - the simple and powerful screen recording tool.'
};

export const viewport: Viewport = {
  maximumScale: 1
};

const manrope = Manrope({ 
  subsets: ['latin'],
  display: 'swap',
  fallback: ['system-ui', 'arial']
});

async function LayoutInner({ children }: { children: React.ReactNode }) {
  // Get the server-detected locale and initial theme for SSR consistency
  // This is now inside a Suspense boundary
  const detectedLocale = await getServerDetectedLocale();
  const initialTheme = await getServerInitialTheme();
  
  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `
            document.documentElement.lang = '${detectedLocale === 'zh' ? 'zh-CN' : 'en'}';
            document.documentElement.setAttribute('data-detected-locale', '${detectedLocale}');
            document.documentElement.setAttribute('data-initial-theme', '${initialTheme.actualMode}');
            ${initialTheme.shouldApplyDarkClass ? "document.documentElement.classList.add('dark');" : "document.documentElement.classList.remove('dark');"}
            document.documentElement.style.setProperty('--primary', '${initialTheme.themeColor.primary}');
            document.documentElement.style.setProperty('--primary-foreground', '${initialTheme.themeColor.primaryForeground}');
          `,
        }}
      />
      <ThemeProvider>
        <I18nProvider initialLocale={detectedLocale}>
          <AuthProvider>
            <div className="flex flex-col min-h-screen">
              <Header />
              <main className="flex-1">
                {children}
              </main>
              <Footer />
            </div>
          </AuthProvider>
        </I18nProvider>
      </ThemeProvider>
    </>
  );
}

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  // Use default values for initial render, then update via Suspense
  // suppressHydrationWarning allows client-side script to update these attributes
  return (
    <html
      lang="en"
      className={manrope.className}
      style={{ 
        scrollbarGutter: 'stable',
        '--primary': '142 76% 36%',
        '--primary-foreground': '0 0% 98%'
      } as React.CSSProperties}
      suppressHydrationWarning
    >
      <body className="min-h-[100dvh] bg-background text-foreground" style={{ width: '100vw', maxWidth: '100%', overflowX: 'hidden' }}>
        <Suspense fallback={
          <div className="flex items-center justify-center min-h-screen">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        }>
          <LayoutInner>{children}</LayoutInner>
        </Suspense>
      </body>
    </html>
  );
}
