import type { Metadata } from "next";
import { AuthProvider } from "@/context/AuthContext";
import "./globals.css";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Retro Recipe Book",
  description: "Your personal, AI-powered recipe collection",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <Navbar />
          <div className="container">
            {children}
          </div>
          <footer className="footer-container">
            <div className="footer-image-box">
              <img src="/foodwars.jpg" alt="Food Wars" className="footer-image" />
            </div>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
