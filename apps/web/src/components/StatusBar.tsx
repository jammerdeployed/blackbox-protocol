import { Wifi, WifiOff, Upload, Clock, HardDrive } from 'lucide-react';
import { useTranslation } from '../lib/locales';

interface Props {
  chunkCount: number;
  duration: number;
  isOnline: boolean;
  totalBytes: number;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const StatusBar: React.FC<Props> = ({ chunkCount, duration, isOnline, totalBytes }) => {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-between w-full p-2 bg-slate-900 border-b border-slate-800 text-sm">
      <div className="flex items-center gap-2">
        {isOnline ? <Wifi className="w-4 h-4 text-green-500" /> : <WifiOff className="w-4 h-4 text-red-500" />}
        <span className={isOnline ? 'text-green-500' : 'text-red-500'}>
          {isOnline ? t.onlineLink : 'Offline'}
        </span>
      </div>
      <div className="flex items-center gap-4 text-slate-300">
        <div className="flex items-center gap-1">
          <Upload className="w-4 h-4" />
          <span>{chunkCount}</span>
        </div>
        <div className="flex items-center gap-1">
          <HardDrive className="w-4 h-4" />
          <span>{formatBytes(totalBytes)}</span>
        </div>
        <div className="flex items-center gap-1">
          <Clock className="w-4 h-4" />
          <span>{duration}s</span>
        </div>
      </div>
    </div>
  );
};

