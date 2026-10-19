import React from 'react';
import { Play, RotateCw, Trash2, CheckCircle2, AlertTriangle, Radio } from 'lucide-react';
import { getPlaybackUrl } from '../lib/api';
import { cs } from '../lib/locales/cs';

export interface DisplaySession {
  id: string;
  date: string | number;
  duration?: number;
  chunkCount: number;
  status?: string;
}

interface Props {
  sessions: DisplaySession[];
  apiUrl: string;
  onRefresh?: () => void;
  onClear?: () => void;
  isLoading?: boolean;
}

export const SessionList: React.FC<Props> = ({ sessions, apiUrl, onRefresh, onClear, isLoading }) => {
  if (sessions.length === 0 && !onRefresh) return null;

  const renderStatusBadge = (status?: string) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
            <CheckCircle2 className="w-2.5 h-2.5" /> {cs.statusCompleted}
          </span>
        );
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800 animate-pulse">
            <Radio className="w-2.5 h-2.5" /> {cs.statusActive}
          </span>
        );
      case 'INTERRUPTED':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-rose-950 text-rose-400 border border-rose-800">
            <AlertTriangle className="w-2.5 h-2.5" /> {cs.statusInterrupted}
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full max-w-md mt-6 p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-200">{cs.recentRecordings}</h2>
        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              title={cs.refreshSessions}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
            >
              <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          )}
          {onClear && sessions.length > 0 && (
            <button
              onClick={onClear}
              title={cs.clearHistory}
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {sessions.length === 0 ? (
        <p className="text-xs text-slate-500 text-center py-4">{cs.noRecordings}</p>
      ) : (
        <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
          {sessions.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between p-3 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 rounded-lg transition-all"
            >
              <div className="flex flex-col gap-1 min-w-0 pr-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-200 truncate">
                    {new Date(s.date).toLocaleTimeString()} · {new Date(s.date).toLocaleDateString()}
                  </span>
                  {renderStatusBadge(s.status)}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                  <span>ID: {s.id.substring(0, 8)}...</span>
                  <span>•</span>
                  <span>
                    {s.chunkCount} {cs.fragments}
                  </span>
                  {typeof s.duration === 'number' && s.duration > 0 && (
                    <>
                      <span>•</span>
                      <span>
                        {s.duration}s {cs.durationSec}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <a
                href={getPlaybackUrl(apiUrl, s.id)}
                target="_blank"
                rel="noreferrer"
                title={cs.play}
                className="flex-shrink-0 p-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-full transition-all hover:scale-105"
              >
                <Play className="w-4 h-4 fill-emerald-400" />
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
