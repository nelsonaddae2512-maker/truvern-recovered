import React from "react";

export function SiteHeader(){
  return (
    <header className="px-6 py-4 border-b">
      <nav className="max-w-6xl mx-auto flex items-center gap-6">
        <a href="/" className="font-semibold">Truvern</a>
        <a href="/buyers">Buyers</a>
        <a href="/vendors">Vendors</a>
        <a href="/features">Features</a>
        <a href="/trust">Trust Network</a>
      </nav>
    </header>
  );
}



