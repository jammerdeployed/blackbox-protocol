import { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Layout } from './components/Layout';
import { SettingsPanel, type SettingsFormData } from './components/SettingsPanel';
import { RecordButton } from './components/RecordButton';
import { StatusBar } from './components/StatusBar';
import { SessionList, type DisplaySession } from './components/SessionList';
import { useRecorder } from './hooks/useRecorder';
import { useUploadStatus } from './hooks/useUpload';
import { fetchSessions } from './lib/api';
import type { AlertPreferences } from '@blackbox-protocol/shared';

export default function App() {
  const [apiUrl, setApiUrl] = useState(localStorage.getItem('apiUrl') || '');
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [chatId, setChatId] = useState(localStorage.getItem('chatId') || '');
  const [emailAddress, setEmailAddress] = useState(localStorage.getItem('emailAddress') || '');
  const [discordAlert, setDiscordAlert] = useState(localStorage.getItem('discordAlert') !== 'false');
  const [telegramAlert, setTelegramAlert] = useState(localStorage.getItem('telegramAlert') !== 'false');
  const [emailAlert, setEmailAlert] = useState(localStorage.getItem('emailAlert') === 'true');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [sessions, setSessions] = useState<DisplaySession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);

  const loadSessions = useCallback(async () => {
    if (!apiUrl) {
      setSessions(JSON.parse(localStorage.getItem('sessions') || '[]'));
      return;
    }
    setIsLoadingSessions(true);
    try {
      if (token) {
        const remote = await fetchSessions(apiUrl, token);
        const mapped: DisplaySession[] = remote.map((r) => ({
          id: r.id,
          date: r.created_at,
          chunkCount: r.total_chunks,
          status: r.status,
          duration: Math.round(r.total_chunks),
        }));
        setSessions(mapped);
        return;
      }
    } catch (e) {
      console.warn('Failed to fetch remote sessions, using local storage:', e);
    } finally {
      setIsLoadingSessions(false);
    }
    setSessions(JSON.parse(localStorage.getItem('sessions') || '[]'));
  }, [apiUrl, token]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    loadSessions();
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadSessions]);

  const handleClearSessions = () => {
    localStorage.removeItem('sessions');
    setSessions([]);
  };

  const alertPreferences: AlertPreferences = useMemo(
    () => ({
      discord: discordAlert,
      telegram: telegramAlert,
      email: emailAlert,
      chatId: chatId.trim() || undefined,
      emailAddress: emailAddress.trim() || undefined,
    }),
    [discordAlert, telegramAlert, emailAlert, chatId, emailAddress]
  );

  const { isRecording, duration, chunkCount, startRecording, stopRecording, error } = useRecorder(
    apiUrl,
    token,
    alertPreferences,
    loadSessions
  );
  const { uploadStats } = useUploadStatus();

  const handleSaveSettings = (data: SettingsFormData) => {
    localStorage.setItem('apiUrl', data.url);
    localStorage.setItem('token', data.token);
    localStorage.setItem('chatId', data.chatId);
    localStorage.setItem('emailAddress', data.emailAddress);
    localStorage.setItem('discordAlert', String(data.discordEnabled));
    localStorage.setItem('telegramAlert', String(data.telegramEnabled));
    localStorage.setItem('emailAlert', String(data.emailEnabled));
    setApiUrl(data.url);
    setToken(data.token);
    setChatId(data.chatId);
    setEmailAddress(data.emailAddress);
    setDiscordAlert(data.discordEnabled);
    setTelegramAlert(data.telegramEnabled);
    setEmailAlert(data.emailEnabled);
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
            initEmailAddress={emailAddress}
            initDiscordEnabled={discordAlert}
            initTelegramEnabled={telegramAlert}
            initEmailEnabled={emailAlert}
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
            {!isRecording && (
              <SessionList
                sessions={sessions}
                apiUrl={apiUrl}
                onRefresh={loadSessions}
                onClear={handleClearSessions}
                isLoading={isLoadingSessions}
              />
            )}
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
                  initEmailAddress={emailAddress}
                  initDiscordEnabled={discordAlert}
                  initTelegramEnabled={telegramAlert}
                  initEmailEnabled={emailAlert}
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
