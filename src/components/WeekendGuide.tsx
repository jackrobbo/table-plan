import { RECIPES } from '@/data';
import MealImage from '@/components/MealImage';
import type { Profile } from '@/lib/profile';
import { computeTargets } from '@/lib/targets';

const byId = new Map(RECIPES.map((r) => [r.id, r]));

/** Saturday and Sunday aren't planned yet: a daily target to aim for, and the meals you like to cook from. */
export default function WeekendGuide({ profile, onOpen }: { profile: Profile; onOpen: (id: string) => void }) {
  const t = computeTargets(profile.goal ?? 'lose', profile.stats);
  const favourites = profile.likedRecipes.map((id) => byId.get(id)).filter((r): r is NonNullable<typeof r> => !!r && r.c !== 'snack')
    .sort((a, b) => b.p / b.k - a.p / a.k).slice(0, 6);
  return (
    <div className="card weekend">
      <h3>Weekends</h3>
      <p className="muted" style={{ margin: '4px 0 8px' }}>Sat and Sun are yours: we don&apos;t plan or shop for them yet. As a guide, aim for</p>
      <div className="tags"><span className="p">≥ {t.protein}g protein</span><span>{t.band[0].toLocaleString('en-GB')}–{t.band[1].toLocaleString('en-GB')} kcal</span></div>
      {favourites.length > 0 && <>
        <p className="group-title">Your favourites</p>
        <div className="rgrid">
          {favourites.map((r) => (
            <button key={r.id} className="rcard" onClick={() => onOpen(r.id)}>
              {r.img ? <MealImage r={r} size="thumb" sizes="(max-width: 430px) 45vw, 200px" /> : <span className="emoji">{r.e}</span>}
              <span className="nm">{r.n}</span><span className="muted">{r.p}g · {r.k} kcal</span>
            </button>
          ))}
        </div>
      </>}
    </div>
  );
}
