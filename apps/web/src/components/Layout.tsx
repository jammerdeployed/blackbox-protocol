import React from 'react';
import { Shield, Settings } from 'lucide-react';
import { cs } from '../lib/locales/cs';

export const Layout: React.FC<{ children: React.ReactNode; onOpenSettings?: () => void }> = ({
  children,
  onOpenSettings,
}) => {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      <header className="flex items-center justify-between p-4 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Shield className="w-6 h-6 text-red-500" />
          <h1 className="text-xl font-bold tracking-widest text-slate-100">WITNESS</h1>
        </div>
        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title={cs.config}
          >
            <Settings className="w-5 h-5" />
          </button>
        )}
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
