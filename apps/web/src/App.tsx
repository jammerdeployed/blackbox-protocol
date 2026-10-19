import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Layout } from './components/Layout';
import { SettingsPanel } from './components/SettingsPanel';
import { RecordButton } from './components/RecordButton';
import { StatusBar } from './components/StatusBar';
import { SessionList } from './components/SessionList';
import { useRecorder } from './hooks/useRecorder';
import { useUploadStatus } from './hooks/useUpload';
import type { AlertPreferences } from '@blackbox-protocol/shared';

export default function App() {
  const [apiUrl, setApiUrl] = useState(localStorage.getItem('apiUrl') || '');
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [chatId, setChatId] = useState(localStorage.getItem('chatId') || '');
  const [discordAlert, setDiscordAlert] = useState(localStorage.getItem('discordAlert') !== 'false');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [sessions, setSessions] = useState<any[]>([]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setSessions(JSON.parse(localStorage.getItem('sessions') || '[]'));
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const alertPreferences: AlertPreferences = useMemo(
    () => ({
      discord: discordAlert,
      telegram: Boolean(chatId.trim()),
      email: false,
    }),
    [discordAlert, chatId]
  );

  const { isRecording, duration, chunkCount, startRecording, stopRecording, error } = useRecorder(
    apiUrl,
    token,
    alertPreferences
  );
  const { uploadStats } = useUploadStatus();

  const handleSaveSettings = (u: string, t: string, c: string, d: boolean) => {
    localStorage.setItem('apiUrl', u);
    localStorage.setItem('token', t);
    localStorage.setItem('chatId', c);
    localStorage.setItem('discordAlert', String(d));
    setApiUrl(u);
    setToken(t);
    setChatId(c);
    setDiscordAlert(d);
    setIsSettingsOpen(false);
  };

  const isConfigured = Boolean(apiUrl && token);

  return (
    <Layout onOpenSettings={isConfigured ? () => setIsSettingsOpen(true) : undefined}>
      {!isConfigured ? (
        <div className="p-4 w-full flex justify-center">
          <SettingsPanel
            onSave={handleSaveSettings}
            initUrl={apiUrl}
            initToken={token}
            initChatId={chatId}
            initDiscordEnabled={discordAlert}
          />
        </div>
      ) : (
        <>
          {isRecording && (
            <StatusBar
              chunkCount={chunkCount}
              duration={duration}
              isOnline={isOnline}
              totalBytes={uploadStats.totalBytes}
            />
          )}
          <div className="flex-1 flex flex-col items-center justify-center w-full p-4">
            {error && (
              <div className="mb-4 text-red-400 bg-red-900/30 p-2 rounded max-w-md w-full text-center text-sm border border-red-800">
                {error}
              </div>
            )}
            <div className="py-12">
              <RecordButton
                isRecording={isRecording}
                duration={duration}
                onStart={startRecording}
                onStop={stopRecording}
              />
            </div>
            {!isRecording && <SessionList sessions={sessions} apiUrl={apiUrl} />}
          </div>

          {/* Modal popup using React createPortal as required by project guidelines */}
          {isSettingsOpen &&
            typeof document !== 'undefined' &&
            createPortal(
              <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
                <SettingsPanel
                  onSave={handleSaveSettings}
                  initUrl={apiUrl}
                  initToken={token}
                  initChatId={chatId}
                  initDiscordEnabled={discordAlert}
                  onClose={() => setIsSettingsOpen(false)}
                />
              </div>,
              document.body
            )}
        </>
      )}
    </Layout>
  );
}
