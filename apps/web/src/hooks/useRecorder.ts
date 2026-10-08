import { useState, useRef, useEffect } from 'react';
import { WitnessRecorder } from '../lib/recorder';
import { ChunkUploader } from '../lib/uploader';
import { getCurrentPosition, GeoPosition } from '../lib/geo';
import { finalizeSession } from '../lib/api';

export function useRecorder(apiUrl: string, token: string) {
  const [isRecording, setIsRecording] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [chunkCount, setChunkCount] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<WitnessRecorder | null>(null);
  const uploaderRef = useRef<ChunkUploader | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    uploaderRef.current = new ChunkUploader(apiUrl, token);
    uploaderRef.current.init().catch(err => setError(String(err)));
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recorderRef.current?.isRecording) {
        recorderRef.current.stop();
      }
    };
  }, [apiUrl, token]);

  const startRecording = async () => {
    try {
      setError(null);
      let pos: GeoPosition | null = null;
      try { pos = await getCurrentPosition(); } catch (e) { console.error(e); }
      
      let uploader = uploaderRef.current;
      if (!uploader) {
        uploader = new ChunkUploader(apiUrl, token);
        await uploader.init();
        uploaderRef.current = uploader;
      }

      const recorder = new WitnessRecorder((chunk, seq) => {
        uploader?.upload(recorder.sessionId!, seq, chunk, pos);
        setChunkCount(seq + 1);
      });
      
      const sid = await recorder.start();
      recorderRef.current = recorder;
      setSessionId(sid);
      setIsRecording(true);
      setChunkCount(0);
      setDuration(0);

      timerRef.current = window.setInterval(() => {
        setDuration(d => d + 1);
      }, 1000);

      const sessions = JSON.parse(localStorage.getItem('sessions') || '[]');
      sessions.unshift({ id: sid, date: new Date().toISOString(), duration: 0, chunkCount: 0 });
      localStorage.setItem('sessions', JSON.stringify(sessions));

    } catch (err) {
      setError(String(err));
    }
  };

  const stopRecording = async () => {
    if (!recorderRef.current?.isRecording) return;
    
    recorderRef.current.stop();
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (sessionId) {
      try {
        await finalizeSession(apiUrl, token, sessionId);
        const sessions = JSON.parse(localStorage.getItem('sessions') || '[]');
        const idx = sessions.findIndex((s: any) => s.id === sessionId);
        if (idx !== -1) {
          sessions[idx].duration = duration;
          sessions[idx].chunkCount = chunkCount;
          localStorage.setItem('sessions', JSON.stringify(sessions));
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  return { isRecording, sessionId, chunkCount, duration, error, startRecording, stopRecording };
}
