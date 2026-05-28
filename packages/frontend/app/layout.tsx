import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AMDOX ERP",
  description: "AMDOX ERP System",
  manifest: "/manifest.json",
};

export const viewport = {
  themeColor: "#3b82f6",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className={`${inter.className} min-h-full`}>
        <QueryProvider>
          <AuthProvider>
            {children}
            <Toaster position="top-right" richColors />
            <script
              dangerouslySetInnerHTML={{
                __html: `
                  if ('serviceWorker' in navigator) {
                    window.addEventListener('load', function() {
                      navigator.serviceWorker.register('/sw.js').then(function(registration) {
                        console.log('ServiceWorker registration successful with scope: ', registration.scope);
                        // Ensure updates are applied immediately
                        registration.update();
                      }, function(err) {
                        console.log('ServiceWorker registration failed: ', err);
                      });
                    });
                  }
                `,
              }}
            />
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}