import React from 'react';
import { Shield } from 'lucide-react';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      <header className="flex items-center gap-2 p-4 bg-slate-900 border-b border-slate-800">
        <Shield className="w-6 h-6 text-red-500" />
        <h1 className="text-xl font-bold tracking-widest text-slate-100">WITNESS</h1>
      </header>
      <main className="flex-1 flex flex-col items-center w-full">
        {children}
      </main>
      <footer className="p-4 text-center text-xs text-slate-500 border-t border-slate-900">
        Witness Protocol MVP v0.1.0
      </footer>
    </div>
  );
};
