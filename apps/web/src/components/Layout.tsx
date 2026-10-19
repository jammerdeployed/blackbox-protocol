import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Shield, Settings, Globe, Lock, X } from 'lucide-react';
import { useTranslation } from '../lib/locales';

export const Layout: React.FC<{ children: React.ReactNode; onOpenSettings?: () => void }> = ({
  children,
  onOpenSettings,
}) => {
  const { t, locale, changeLocale } = useTranslation();
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      <header className="flex items-center justify-between p-4 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Shield className="w-6 h-6 text-red-500" />
          <h1 className="text-xl font-bold tracking-widest text-slate-100">WITNESS</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => changeLocale(locale === 'en' ? 'cs' : 'en')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
            title="Switch Language / Přepnout jazyk"
          >
            <Globe className="w-3.5 h-3.5 text-slate-400" />
            <span className="uppercase">{locale}</span>
          </button>
          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title={t.config}
            >
              <Settings className="w-5 h-5" />
            </button>
          )}
        </div>
      </header>
      <main className="flex-1 flex flex-col items-center w-full">
        {children}
      </main>
      <footer className="p-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 border-t border-slate-900 px-6">
        <span>Witness Protocol v0.1.0 · Sovereign Edge Evidence</span>
        <button
          type="button"
          onClick={() => setIsPrivacyOpen(true)}
          className="hover:text-slate-300 flex items-center gap-1 text-[11px] underline underline-offset-2 transition-colors"
        >
          <Lock className="w-3 h-3 text-emerald-500" />
          {t.privacyLink}
        </button>
      </footer>

      {isPrivacyOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-100 font-semibold text-base">
                  <Shield className="w-5 h-5 text-red-500" />
                  <h3>{t.privacyTitle}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPrivacyOpen(false)}
                  className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
                <p className="flex items-start gap-2">
                  <span className="text-emerald-400 font-bold">•</span>
                  <span>{t.privacyText1}</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-emerald-400 font-bold">•</span>
                  <span>{t.privacyText2}</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-emerald-400 font-bold">•</span>
                  <span>{t.privacyText3}</span>
                </p>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsPrivacyOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-medium transition-colors"
                >
                  {t.privacyClose}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
