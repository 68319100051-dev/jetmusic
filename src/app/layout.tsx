import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { PlayerProvider } from "@/contexts/PlayerContext";
import { PWAProvider } from "@/contexts/PWAContext";
import { PlaylistProvider } from "@/contexts/PlaylistContext";
import { DiscoveryProvider } from "@/contexts/DiscoveryContext";
import { ModalProvider } from "@/contexts/ModalContext";
import { ToastProvider } from "@/contexts/ToastContext";
import SplashScreen from "@/components/SplashScreen";
import RootLayoutClient from "@/components/RootLayoutClient";
import WebGuard from "@/components/WebGuard";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Jet Music Premium",
  description: "Experience music like never before with Jet Music PWA",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon-v2.png",
    apple: "/icon-v2.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Jet Music",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#050505",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body className={inter.className}>
        <AuthProvider>
          <ToastProvider>
            <ModalProvider>
              <PlaylistProvider>
                <DiscoveryProvider>
                  <PlayerProvider>
                    <PWAProvider>
                      <WebGuard />
                      <SplashScreen />
                      <RootLayoutClient>
                        {children}
                      </RootLayoutClient>
                    </PWAProvider>
                  </PlayerProvider>
                </DiscoveryProvider>
              </PlaylistProvider>
            </ModalProvider>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
