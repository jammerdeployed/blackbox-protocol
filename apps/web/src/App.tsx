import { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { SettingsPanel } from './components/SettingsPanel';
import { RecordButton } from './components/RecordButton';
import { StatusBar } from './components/StatusBar';
import { SessionList } from './components/SessionList';
import { useRecorder } from './hooks/useRecorder';
import { useUploadStatus } from './hooks/useUpload';

export default function App() {
  const [apiUrl, setApiUrl] = useState(localStorage.getItem('apiUrl') || '');
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [chatId, setChatId] = useState(localStorage.getItem('chatId') || '');
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

  const { isRecording, duration, chunkCount, startRecording, stopRecording, error } = useRecorder(apiUrl, token);
  const { uploadStats } = useUploadStatus();

  const handleSaveSettings = (u: string, t: string, c: string) => {
    localStorage.setItem('apiUrl', u);
    localStorage.setItem('token', t);
    localStorage.setItem('chatId', c);
    setApiUrl(u);
    setToken(t);
    setChatId(c);
  };

  const isConfigured = apiUrl && token;

  return (
    <Layout>
      {!isConfigured ? (
        <div className="p-4 w-full flex justify-center">
          <SettingsPanel onSave={handleSaveSettings} initUrl={apiUrl} initToken={token} initChatId={chatId} />
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
            {error && <div className="mb-4 text-red-400 bg-red-900/30 p-2 rounded max-w-md w-full text-center text-sm">{error}</div>}
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
        </>
      )}
    </Layout>
  );
}
