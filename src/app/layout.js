// src/app/layout.js
"use client";
import "../styles/globals.css";
import { AuthProvider } from "../context/AuthContext";
import Navbar from "../components/NavBar";
import Footer from "../components/Footer";

export default function RootLayout({ children }) {
  return (
    <AuthProvider>
      <html lang="es">
        <body className="flex flex-col min-h-screen">
          <Navbar />
          <main className="flex-grow">
            <body suppressHydrationWarning>{children}</body>
          </main>
          <Footer />
        </body>
      </html>
    </AuthProvider>
  );
}
