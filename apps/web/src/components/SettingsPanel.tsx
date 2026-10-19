import React, { useState } from 'react';
import { Settings, Save, Bell, X, Send, Mail, MessageSquare } from 'lucide-react';
import { useTranslation } from '../lib/locales';

export interface SettingsFormData {
  url: string;
  token: string;
  chatId: string;
  emailAddress: string;
  discordEnabled: boolean;
  telegramEnabled: boolean;
  emailEnabled: boolean;
}

interface Props {
  onSave: (data: SettingsFormData) => void;
  initUrl: string;
  initToken: string;
  initChatId?: string;
  initEmailAddress?: string;
  initDiscordEnabled?: boolean;
  initTelegramEnabled?: boolean;
  initEmailEnabled?: boolean;
  onClose?: () => void;
}

export const SettingsPanel: React.FC<Props> = ({
  onSave,
  initUrl,
  initToken,
  initChatId = '',
  initEmailAddress = '',
  initDiscordEnabled = true,
  initTelegramEnabled = true,
  initEmailEnabled = false,
  onClose,
}) => {
  const { t } = useTranslation();
  const [url, setUrl] = useState(initUrl);
  const [token, setToken] = useState(initToken);
  const [chatId, setChatId] = useState(initChatId);
  const [emailAddress, setEmailAddress] = useState(initEmailAddress);
  const [discordEnabled, setDiscordEnabled] = useState(initDiscordEnabled);
  const [telegramEnabled, setTelegramEnabled] = useState(initTelegramEnabled);
  const [emailEnabled, setEmailEnabled] = useState(initEmailEnabled);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      url,
      token,
      chatId,
      emailAddress,
      discordEnabled,
      telegramEnabled,
      emailEnabled,
    });
  };

  return (
    <div className="w-full max-w-md p-6 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl">
      <div className="flex items-center justify-between mb-5 text-slate-200">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-red-500" />
          <h2 className="text-base font-bold text-slate-100">{t.systemConfig}</h2>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title={t.closeSettings}
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">{t.apiUrlLabel}</label>
          <input
            type="text"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-red-500 text-xs font-mono"
            placeholder="https://witness-ingestion.<subdomain>.workers.dev"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">{t.authTokenLabel}</label>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-red-500 text-xs font-mono"
            placeholder="Bearer token"
          />
        </div>

        <div className="pt-3 border-t border-slate-800 space-y-3">
          <div className="flex items-center gap-2 text-slate-300">
            <Bell className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-semibold uppercase tracking-wider">{t.alertRouting}</span>
          </div>

          {/* Discord Webhook Option */}
          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg transition-colors">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={discordEnabled}
                onChange={(e) => setDiscordEnabled(e.target.checked)}
                className="w-4 h-4 rounded text-red-600 focus:ring-red-500 bg-slate-900 border-slate-700"
              />
              <div className="flex items-center gap-2 text-slate-200">
                <MessageSquare className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-medium">{t.discordAlert}</span>
              </div>
            </label>
          </div>

          {/* Telegram Bot Option */}
          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg space-y-2 transition-colors">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={telegramEnabled}
                onChange={(e) => setTelegramEnabled(e.target.checked)}
                className="w-4 h-4 rounded text-red-600 focus:ring-red-500 bg-slate-900 border-slate-700"
              />
              <div className="flex items-center gap-2 text-slate-200">
                <Send className="w-4 h-4 text-sky-400" />
                <span className="text-xs font-medium">{t.telegramAlert}</span>
              </div>
            </label>
            {telegramEnabled && (
              <div className="pl-7 pt-1 space-y-1.5">
                <p className="text-[11px] text-slate-400 leading-snug">
                  {t.telegramDefaultNotice}
                </p>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">{t.telegramChatIdLabel}</label>
                  <input
                    type="text"
                    value={chatId}
                    onChange={(e) => setChatId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-md p-2 text-slate-200 focus:outline-none focus:border-red-500 text-xs"
                    placeholder={t.telegramChatIdPlaceholder}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Email Option */}
          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg space-y-2 transition-colors">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={emailEnabled}
                onChange={(e) => setEmailEnabled(e.target.checked)}
                className="w-4 h-4 rounded text-red-600 focus:ring-red-500 bg-slate-900 border-slate-700"
              />
              <div className="flex items-center gap-2 text-slate-200">
                <Mail className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-medium">{t.emailAlert}</span>
              </div>
            </label>
            {emailEnabled && (
              <div className="pl-7 pt-1 space-y-1.5">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">{t.emailAddressLabel}</label>
                  <input
                    type="email"
                    value={emailAddress}
                    onChange={(e) => setEmailAddress(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-md p-2 text-slate-200 focus:outline-none focus:border-red-500 text-xs"
                    placeholder={t.emailPlaceholder}
                  />
                </div>
                <p className="text-[10px] text-slate-500 leading-snug">
                  {t.emailNotice}
                </p>
              </div>
            )}
          </div>
        </div>

        <button
          type="submit"
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 p-2.5 rounded-lg font-medium text-white text-xs tracking-wider uppercase transition-all shadow-lg shadow-red-950/50 mt-5"
        >
          <Save className="w-4 h-4" />
          {t.saveAndConnect}
        </button>
      </form>
    </div>
  );
};
