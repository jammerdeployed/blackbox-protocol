import React from 'react';
import { Play } from 'lucide-react';
import { getPlaybackUrl } from '../lib/api';

interface Session {
  id: string;
  date: string;
  duration: number;
  chunkCount: number;
}

interface Props {
  sessions: Session[];
  apiUrl: string;
}

export const SessionList: React.FC<Props> = ({ sessions, apiUrl }) => {
  if (sessions.length === 0) return null;

  return (
    <div className="w-full max-w-md mt-8 p-4">
      <h2 className="text-xl font-semibold mb-4 text-slate-200">Past Sessions</h2>
      <div className="space-y-3">
        {sessions.map(s => (
          <div key={s.id} className="flex items-center justify-between p-4 bg-slate-800 rounded-lg">
            <div className="flex flex-col">
              <span className="text-sm font-medium">{new Date(s.date).toLocaleString()}</span>
              <span className="text-xs text-slate-400">ID: {s.id.substring(0, 8)}...</span>
              <span className="text-xs text-slate-400">{s.duration}s • {s.chunkCount} chunks</span>
            </div>
            <a
              href={getPlaybackUrl(apiUrl, s.id)}
              target="_blank"
              rel="noreferrer"
              className="p-3 bg-slate-700 rounded-full hover:bg-slate-600 transition-colors"
            >
              <Play className="w-5 h-5 text-green-400 fill-green-400" />
            </a>
          </div>
        ))}
      </div>
    </div>
  );
};
