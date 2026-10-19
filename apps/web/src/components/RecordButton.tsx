import React from 'react';
import { Camera, Square } from 'lucide-react';
import { useTranslation } from '../lib/locales';

interface Props {
  isRecording: boolean;
  duration: number;
  onStart: () => void;
  onStop: () => void;
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export const RecordButton: React.FC<Props> = ({ isRecording, duration, onStart, onStop }) => {
  const { t } = useTranslation();

  if (isRecording) {
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="text-4xl font-mono text-red-500">{formatTime(duration)}</div>
        <button
          onClick={onStop}
          title={t.stopBtn}
          aria-label={t.stopBtn}
          className="relative flex items-center justify-center w-24 h-24 bg-red-600 rounded-full shadow-lg hover:bg-red-700 transition-colors"
        >
          <div className="absolute inset-0 bg-red-600 rounded-full animate-ping opacity-75"></div>
          <Square className="w-10 h-10 text-white fill-white z-10" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-base font-semibold tracking-wider text-slate-400 uppercase">{t.triggerTitle}</div>
      <button
        onClick={onStart}
        title={t.triggerBtn}
        aria-label={t.triggerBtn}
        className="flex items-center justify-center w-24 h-24 bg-red-600 rounded-full shadow-lg hover:bg-red-500 transition-all hover:scale-105 active:scale-95"
      >
        <Camera className="w-12 h-12 text-white" />
      </button>
    </div>
  );
};
