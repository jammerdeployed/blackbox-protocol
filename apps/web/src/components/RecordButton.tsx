import React from 'react';
import { Camera, Square, Radio } from 'lucide-react';
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

  return (
    <div className="w-full max-w-sm p-7 bg-slate-900/80 border border-slate-800/90 rounded-2xl shadow-2xl backdrop-blur-md text-center flex flex-col items-center">
      {/* Top Status Pill */}
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-xs text-emerald-400 font-medium mb-4">
        {isRecording ? (
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
        ) : (
          <Radio className="w-3 h-3 text-emerald-400" />
        )}
        <span className="text-[11px] tracking-wide">{isRecording ? t.liveUploading : t.statusArmed}</span>
      </div>

      {/* Main Title & Subtitle */}
      <h2 className="text-xl font-bold text-slate-100 mb-1.5">
        {isRecording ? formatTime(duration) : t.triggerTitle}
      </h2>
      <p className="text-xs text-slate-400 max-w-xs mb-8 leading-relaxed">
        {isRecording ? t.liveUploading : t.triggerDescription}
      </p>

      {/* Big Tactical Record Trigger */}
      <div className="relative flex items-center justify-center mb-6">
        {isRecording ? (
          <div className="relative">
            <div className="absolute -inset-3 bg-red-600/30 rounded-full animate-ping"></div>
            <div className="p-2 border-2 border-dashed border-red-500/70 rounded-full">
              <button
                onClick={onStop}
                title={t.stopBtn}
                aria-label={t.stopBtn}
                className="w-24 h-24 bg-gradient-to-tr from-red-600 to-rose-600 rounded-full flex flex-col items-center justify-center text-white shadow-xl shadow-red-950/60 hover:scale-105 active:scale-95 transition-all"
              >
                <Square className="w-7 h-7 fill-white mb-1" />
                <span className="text-[10px] font-bold tracking-widest uppercase">{t.stopBtn}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="p-2.5 border-2 border-dashed border-red-500/40 rounded-full hover:border-red-500/80 transition-colors">
            <button
              onClick={onStart}
              title={t.triggerBtn}
              aria-label={t.triggerBtn}
              className="w-24 h-24 bg-gradient-to-tr from-red-600 to-rose-500 rounded-full flex flex-col items-center justify-center text-white shadow-xl shadow-red-950/60 hover:scale-105 active:scale-95 transition-all group"
            >
              <Camera className="w-8 h-8 mb-1 group-hover:scale-110 transition-transform" />
              <span className="text-[10px] font-bold tracking-widest uppercase">{t.triggerBtn}</span>
            </button>
          </div>
        )}
      </div>

      {/* Bottom Security Guarantee */}
      <div className="inline-flex items-center gap-1.5 text-xs text-slate-400">
        <span className="w-1.5 h-1.5 rounded-full border border-slate-400"></span>
        <span className="text-[11px]">{t.evidenceSecured}</span>
      </div>
    </div>
  );
};
