import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ShieldCheck, Lock, ExternalLink, Github, FileText, CheckCircle2 } from 'lucide-react';
import { WitnessLogo } from './WitnessLogo';
import { useTranslation } from '../lib/locales';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'architecture' | 'threat' | 'compliance'>('architecture');

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <WitnessLogo className="w-6 h-6" />
            <div>
              <h2 className="text-base font-bold text-slate-100">{t.privacyTitle}</h2>
              <p className="text-[11px] text-slate-400">{t.privacySubtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title={t.closeSettings}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/30 px-5 gap-4">
          <button
            type="button"
            onClick={() => setActiveTab('architecture')}
            className={`py-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'architecture'
                ? 'border-red-500 text-red-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>{t.privacyTabArchitecture}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('threat')}
            className={`py-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'threat'
                ? 'border-red-500 text-red-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{t.privacyTabThreatModel}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('compliance')}
            className={`py-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'compliance'
                ? 'border-red-500 text-red-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{t.privacyTabCompliance}</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs leading-relaxed text-slate-300">
          {activeTab === 'architecture' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
                <div className="flex items-center gap-2 text-slate-100 font-semibold text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <h3>{t.privacySection1Title}</h3>
                </div>
                <p className="text-slate-400 pl-6">{t.privacySection1Desc}</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
                <div className="flex items-center gap-2 text-slate-100 font-semibold text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <h3>{t.privacySection2Title}</h3>
                </div>
                <p className="text-slate-400 pl-6">{t.privacySection2Desc}</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
                <div className="flex items-center gap-2 text-slate-100 font-semibold text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <h3>{t.privacySection3Title}</h3>
                </div>
                <p className="text-slate-400 pl-6">{t.privacySection3Desc}</p>
              </div>
            </div>
          )}

          {activeTab === 'threat' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
                <div className="flex items-center gap-2 text-rose-400 font-semibold text-sm">
                  <ShieldCheck className="w-4 h-4 text-rose-400" />
                  <h3>{t.privacySection4Title}</h3>
                </div>
                <p className="text-slate-400 pl-6">{t.privacySection4Desc}</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
                <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
                  <Lock className="w-4 h-4 text-amber-400" />
                  <h3>{t.privacySection3Title}</h3>
                </div>
                <p className="text-slate-400 pl-6">{t.privacySection3Desc}</p>
              </div>

              <div className="p-3 bg-red-950/30 border border-red-900/50 rounded-lg text-slate-300">
                <span className="font-semibold text-red-400">Zero Single Point of Failure: </span>
                Video chunks are sent as discrete HTTP/2 PUT streams directly to Cloudflare R2 with zero buffering in Worker memory.
              </div>
            </div>
          )}

          {activeTab === 'compliance' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
                <div className="flex items-center gap-2 text-slate-100 font-semibold text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <h3>{t.privacySection5Title}</h3>
                </div>
                <p className="text-slate-400 pl-6">{t.privacySection5Desc}</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-3">
                <h4 className="font-semibold text-slate-200">{t.openSourceAudit}</h4>
                <div className="flex flex-wrap gap-2 pt-1">
                  <a
                    href="https://github.com/jammerdeployed/blackbox-protocol/blob/main/PRIVACY.md"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                    <span>{t.privacyReadFullPolicy}</span>
                    <ExternalLink className="w-3 h-3 text-slate-500" />
                  </a>
                  <a
                    href="https://github.com/jammerdeployed/blackbox-protocol/blob/main/SECURITY.md"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                    <span>{t.privacyReadSecurity}</span>
                    <ExternalLink className="w-3 h-3 text-slate-500" />
                  </a>
                  <a
                    href="https://github.com/jammerdeployed/blackbox-protocol"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                  >
                    <Github className="w-3.5 h-3.5 text-slate-400" />
                    <span>GitHub</span>
                    <ExternalLink className="w-3 h-3 text-slate-500" />
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between">
          <a
            href="https://github.com/jammerdeployed/blackbox-protocol"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
          >
            <Github className="w-4 h-4" />
            <span>Witness Protocol (MIT License)</span>
          </a>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white rounded-lg text-xs font-semibold tracking-wide transition-all shadow-md shadow-red-950/40"
          >
            {t.privacyClose}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
