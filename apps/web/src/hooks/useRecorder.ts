import { useState, useRef, useEffect } from 'react';
import { WitnessRecorder } from '../lib/recorder';
import { ChunkUploader } from '../lib/uploader';
import { getCurrentPosition, GeoPosition } from '../lib/geo';
import { finalizeSession } from '../lib/api';
import type { AlertPreferences } from '@blackbox-protocol/shared';

export function useRecorder(
  apiUrl: string,
  token: string,
  alerts?: AlertPreferences,
  onSessionFinished?: (sessionId: string) => void
) {
  const [isRecording, setIsRecording] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [chunkCount, setChunkCount] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const recorderRef = useRef<WitnessRecorder | null>(null);
  const uploaderRef = useRef<ChunkUploader | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    uploaderRef.current = new ChunkUploader(apiUrl, token);
    uploaderRef.current.onError = (msg) => setError(msg);

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

      let uploader = uploaderRef.current;
      if (!uploader) {
        uploader = new ChunkUploader(apiUrl, token);
        uploaderRef.current = uploader;
      }
      uploader.setCredentials(apiUrl, token);

      let currentPos: GeoPosition | null = null;
      // GPS lookup in background (non-blocking for user gesture)
      getCurrentPosition()
        .then((pos) => {
          currentPos = pos;
        })
        .catch((err) => console.warn('GPS background acquisition failed:', err));

      const recorder = new WitnessRecorder((chunk, seq) => {
        const metadata = {
          latitude: currentPos?.latitude,
          longitude: currentPos?.longitude,
          mimeType: recorder.mimeType,
          alerts,
        };
        uploader?.upload(recorder.sessionId!, seq, chunk, metadata);
        setChunkCount(seq + 1);
      });

      const sid = await recorder.start();
      recorderRef.current = recorder;
      setSessionId(sid);
      setIsRecording(true);
      setChunkCount(0);
      setDuration(0);
      setStream(recorder.stream);

      timerRef.current = window.setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);

      const sessions = JSON.parse(localStorage.getItem('sessions') || '[]');
      sessions.unshift({
        id: sid,
        date: new Date().toISOString(),
        duration: 0,
        chunkCount: 0,
      });
      localStorage.setItem('sessions', JSON.stringify(sessions));
    } catch (err: any) {
      console.error('Failed to start recording:', err);
      setError(err.message || String(err));
    }
  };

  const stopRecording = async () => {
    if (!recorderRef.current?.isRecording) return;

    recorderRef.current.stop();
    setIsRecording(false);
    setStream(null);
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
        console.error('Finalize session failed:', err);
      } finally {
        onSessionFinished?.(sessionId);
      }
    }
  };

  return {
    isRecording,
    sessionId,
    chunkCount,
    duration,
    stream,
    startRecording,
    stopRecording,
    error,
  };
}
