'use client';
import { useStatus } from '@/lib/status';

/** One line under the header for things no single screen owns: no connection, or a save that didn't go through. */
export default function StatusBanner() {
  const s = useStatus();
  if (!s) return null;
  return (
    <div className="status-banner" role="status">
      {s.kind === 'offline'
        ? <>Can&apos;t reach Table Plan right now. Check your connection. <button className="linkbtn" onClick={() => location.reload()}>Try Again</button></>
        : <>Your latest change couldn&apos;t be saved. It will save with your next change, or check your connection.</>}
    </div>
  );
}
