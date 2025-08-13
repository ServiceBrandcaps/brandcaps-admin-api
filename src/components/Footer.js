// components/Footer.js
"use client";

export default function Footer() {
  return (
    <footer className="bg-black text-white">
      <div className="max-w-7xl mx-auto px-4 py-4 flex flex-row items-center justify-center">
        <span>© {new Date().getFullYear()} Brandcaps. Todos los derechos reservados.</span>
      </div>
    </footer>
  );
}
