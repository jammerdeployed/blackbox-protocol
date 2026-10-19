import React, { useState } from 'react';
import { Settings, Globe, Lock, Radio, Github } from 'lucide-react';
import { WitnessLogo } from './WitnessLogo';
import { PrivacyModal } from './PrivacyModal';
import { useTranslation } from '../lib/locales';

export const Layout: React.FC<{
  children: React.ReactNode;
  onOpenSettings?: () => void;
  isPrivacyOpen?: boolean;
  onOpenPrivacy?: () => void;
  onClosePrivacy?: () => void;
}> = ({
  children,
  onOpenSettings,
  isPrivacyOpen: externalPrivacyOpen,
  onOpenPrivacy,
  onClosePrivacy,
}) => {
  const { t, locale, changeLocale } = useTranslation();
  const [internalPrivacyOpen, setInternalPrivacyOpen] = useState(false);
  const isPrivacyOpen = externalPrivacyOpen ?? internalPrivacyOpen;
  const handleOpenPrivacy = onOpenPrivacy ?? (() => setInternalPrivacyOpen(true));
  const handleClosePrivacy = onClosePrivacy ?? (() => setInternalPrivacyOpen(false));

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      <header className="flex items-center justify-between p-4 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <WitnessLogo className="w-6 h-6" />
          <span className="text-base font-bold tracking-wider text-slate-100">Witness</span>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-800/80 border border-slate-700/60 text-[11px] text-emerald-400 font-medium">
            <Radio className="w-3 h-3 text-emerald-400" />
            <span>{t.statusReady}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => changeLocale(locale === 'en' ? 'cs' : 'en')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/70 transition-colors"
            title="Switch Language / Přepnout jazyk"
          >
            <Globe className="w-3.5 h-3.5 text-slate-400" />
            <span className="uppercase">{locale}</span>
          </button>
          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700/70 transition-colors"
              title={t.config}
            >
              <Settings className="w-3.5 h-3.5 text-slate-400" />
              <span>{t.config}</span>
            </button>
          )}
        </div>
      </header>
      <main className="flex-1 flex flex-col items-center justify-center w-full">
        {children}
      </main>
      <footer className="p-3.5 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs border-t border-slate-900 px-6 bg-slate-950/90">
        <div className="flex items-center gap-2 text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="font-medium text-slate-300">{t.footerText}</span>
          <span className="text-slate-600 hidden sm:inline">·</span>
          <span className="text-slate-500 hidden sm:inline">v0.1.0</span>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="https://github.com/jammerdeployed/blackbox-protocol"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent hover:border-slate-800 transition-colors"
          >
            <Github className="w-3.5 h-3.5" />
            <span>GitHub</span>
          </a>
          <button
            type="button"
            onClick={handleOpenPrivacy}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 font-medium transition-all shadow-sm"
          >
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>{t.privacyLink}</span>
          </button>
        </div>
      </footer>

      <PrivacyModal isOpen={isPrivacyOpen} onClose={handleClosePrivacy} />
    </div>
  );
};
