import React, { useState } from 'react';
import { Settings, Save } from 'lucide-react';

interface Props {
  onSave: (url: string, token: string, chatId: string) => void;
  initUrl: string;
  initToken: string;
  initChatId: string;
}

export const SettingsPanel: React.FC<Props> = ({ onSave, initUrl, initToken, initChatId }) => {
  const [url, setUrl] = useState(initUrl);
  const [token, setToken] = useState(initToken);
  const [chatId, setChatId] = useState(initChatId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(url, token, chatId);
  };

  return (
    <div className="w-full max-w-md p-6 bg-slate-800 rounded-xl mt-8">
      <div className="flex items-center gap-2 mb-6 text-slate-200">
        <Settings className="w-5 h-5" />
        <h2 className="text-lg font-semibold">Configuration</h2>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-slate-400 mb-1">API URL</label>
          <input
            type="text"
            required
            value={url}
            onChange={e => setUrl(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-md p-2 text-white focus:outline-none focus:border-red-500"
            placeholder="https://api.example.com"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Auth Token</label>
          <input
            type="password"
            required
            value={token}
            onChange={e => setToken(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-md p-2 text-white focus:outline-none focus:border-red-500"
            placeholder="Bearer token"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Telegram Chat ID</label>
          <input
            type="text"
            value={chatId}
            onChange={e => setChatId(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-md p-2 text-white focus:outline-none focus:border-red-500"
            placeholder="Optional chat ID for alerts"
          />
        </div>
        <button
          type="submit"
          className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 p-2 rounded-md font-medium transition-colors"
        >
          <Save className="w-4 h-4" />
          Save Settings
        </button>
      </form>
    </div>
  );
};
