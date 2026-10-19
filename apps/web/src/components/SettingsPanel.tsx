import React, { useState } from 'react';
import { Settings, Save, Bell, X } from 'lucide-react';
import { cs } from '../lib/locales/cs';

interface Props {
  onSave: (url: string, token: string, chatId: string, discordEnabled: boolean) => void;
  initUrl: string;
  initToken: string;
  initChatId: string;
  initDiscordEnabled?: boolean;
  onClose?: () => void;
}

export const SettingsPanel: React.FC<Props> = ({
  onSave,
  initUrl,
  initToken,
  initChatId,
  initDiscordEnabled = true,
  onClose,
}) => {
  const [url, setUrl] = useState(initUrl);
  const [token, setToken] = useState(initToken);
  const [chatId, setChatId] = useState(initChatId);
  const [discordEnabled, setDiscordEnabled] = useState(initDiscordEnabled);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(url, token, chatId, discordEnabled);
  };

  return (
    <div className="w-full max-w-md p-6 bg-slate-800 rounded-xl mt-4 shadow-xl border border-slate-700">
      <div className="flex items-center justify-between mb-6 text-slate-200">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-red-500" />
          <h2 className="text-lg font-semibold">{cs.systemConfig}</h2>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            title={cs.closeSettings}
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-slate-400 mb-1">{cs.apiUrlLabel}</label>
          <input
            type="text"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-md p-2 text-white focus:outline-none focus:border-red-500 text-sm"
            placeholder="https://witness-ingestion.<subdomain>.workers.dev"
          />
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-1">{cs.authTokenLabel}</label>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-md p-2 text-white focus:outline-none focus:border-red-500 text-sm"
            placeholder="Bearer token"
          />
        </div>

        <div className="pt-2 border-t border-slate-700/60">
          <div className="flex items-center gap-2 mb-3 text-slate-300">
            <Bell className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-medium">{cs.alertRouting}</span>
          </div>

          <label className="flex items-center gap-3 p-2 bg-slate-900/60 rounded-md border border-slate-700/40 cursor-pointer hover:bg-slate-900 transition-colors mb-3">
            <input
              type="checkbox"
              checked={discordEnabled}
              onChange={(e) => setDiscordEnabled(e.target.checked)}
              className="w-4 h-4 rounded text-red-600 focus:ring-red-500 bg-slate-800 border-slate-600"
            />
            <span className="text-sm text-slate-200">{cs.discordAlert}</span>
          </label>

          <div>
            <label className="block text-xs text-slate-400 mb-1">{cs.telegramChatIdLabel}</label>
            <input
              type="text"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-md p-2 text-white focus:outline-none focus:border-red-500 text-xs"
              placeholder={cs.telegramChatIdPlaceholder}
            />
          </div>
        </div>

        <button
          type="submit"
          className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 p-2.5 rounded-md font-medium text-white transition-colors mt-6 shadow-md"
        >
          <Save className="w-4 h-4" />
          {cs.saveAndConnect}
        </button>
      </form>
    </div>
  );
};
