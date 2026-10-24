'use client';
import { useState } from 'react';
import type { Recipe } from '@/data';
import { mealImageSrc, mealImageSrcSet } from '@/lib/images';

/**
 * A meal's header photo. Until it arrives (or if the meal has none, or the file fails) the tile shows the emoji on the photo's
 * average colour, so layout never jumps and nothing is ever blank. The photo fades in over the placeholder.
 */
export default function MealImage({ r, size, sizes }: { r: Pick<Recipe, 'id' | 'e' | 'img'>; size: 'hero' | 'sheet' | 'thumb'; sizes: string }) {
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const photo = r.img && state !== 'failed';
  return (
    <div className={`mealimg ${size}`} style={r.img ? { background: r.img.c } : undefined} aria-hidden={photo ? undefined : true}>
      {(!photo || state === 'loading') && <span className="emoji">{r.e}</span>}
      {photo && (
        <img
          ref={(el) => { if (el && el.complete && el.naturalWidth) setState('ready'); }}   // already in the cache before React attached onLoad
          className={state === 'ready' ? 'in' : ''} src={mealImageSrc(r.id)} srcSet={mealImageSrcSet(r.id)} sizes={sizes}
          alt={r.img!.a} loading="lazy" decoding="async" onLoad={() => setState('ready')} onError={() => setState('failed')}
        />
      )}
    </div>
  );
}
