import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { ToastProvider } from "@/lib/toast";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "BlueRock RCM",
  description: "Relationship automation CRM for life insurance agencies",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
