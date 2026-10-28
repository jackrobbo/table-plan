'use client';
import { createPortal } from 'react-dom';
import { Heart, ThumbsDown } from 'lucide-react';

/** "How was it?": asked when a meal is ticked off as eaten and hasn't been rated yet. A like keeps it in the mix; "Not for me" stops it being planned. */
export default function RateSheet({ meal, onLike, onNever, onClose }: { meal: string; onLike: () => void; onNever: () => void; onClose: () => void }) {
  return createPortal(
    <div className="sheet-wrap" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="rate-title" onClick={(e) => e.stopPropagation()}>
        <div className="grab" />
        <h2 id="rate-title" style={{ fontSize: 22 }}>How Was It?</h2>
        <p className="muted" style={{ margin: '4px 0 0' }}>{meal}. Your rating shapes the meals we plan next.</p>
        <div className="sheet-foot">
          <button className="btn" onClick={onLike}><Heart size={18} aria-hidden style={{ marginRight: 8 }} />Liked It</button>
          <button className="btn ghost" onClick={onNever}><ThumbsDown size={18} aria-hidden style={{ marginRight: 8 }} />Not for Me</button>
          <button className="linkbtn" onClick={onClose}>Not Now</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
