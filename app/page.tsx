"use client";

import { useMemo, useState } from "react";
import type { Goal, PlannedDay, UserStats } from "@/lib/types";
import { RECIPES, COURSE_MIN } from "@/lib/recipes";
import { computeTargets } from "@/lib/targets";
import { buildPlan } from "@/lib/solver";
import { buildLedger } from "@/lib/ledger";
import { money } from "@/lib/money";
import AuthStatus from "@/app/_components/AuthStatus";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const COURSES: Array<[string, string]> = [
  ["breakfast", "Breakfasts"],
  ["lunch", "Lunches"],
  ["snack", "Snacks"],
  ["dinner", "Dinners"],
];
const DEFAULT_LIKED = ["BE", "BO", "BS", "LR", "LW", "LE", "SG", "SK", "SW", "DFR", "DPP", "DBT", "DHS", "DGY", "DCP"];

export default function Home() {
  const [step, setStep] = useState(1);
  const [goal, setGoal] = useState<Goal>("lose");
  const [hh, setHh] = useState(2);
  const [stats, setStats] = useState<UserStats>({ sex: "", age: 0, ht: 0, wt: 0, act: 1.375 });
  const [liked, setLiked] = useState<Set<string>>(new Set(DEFAULT_LIKED));
  const [plan, setPlan] = useState<PlannedDay[] | null>(null);

  const targets = useMemo(() => computeTargets(goal, stats), [goal, stats]);
  const likedRecipes = useMemo(() => RECIPES.filter((r) => liked.has(r.id)), [liked]);
  const canBuild = Object.keys(COURSE_MIN).every(
    (c) => likedRecipes.filter((r) => r.c === c).length >= COURSE_MIN[c]
  );

  const setStat = (k: keyof UserStats, v: string) =>
    setStats((s) => ({ ...s, [k]: k === "sex" ? (v as UserStats["sex"]) : Number(v) || 0 }));

  const toggleLike = (id: string) =>
    setLiked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const regenerate = () => setPlan(buildPlan(targets, RECIPES.filter((r) => liked.has(r.id))));

  const go = (n: number) => {
    if (n === 3) regenerate();
    setStep(n);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const ledger = useMemo(() => (plan ? buildLedger(plan, hh) : null), [plan, hh]);
  const anyOut = plan?.some((d) => d.out) ?? false;

  return (
    <div className="wrap">
      <AuthStatus />
      <p className="eyebrow">Table Plan · proof of concept</p>
      <h1>Your week, decided.</h1>
      <p className="muted" style={{ marginTop: 8 }}>
        Pick a goal, pick meals you actually like, and get a Mon–Fri plan that hits your numbers — with the
        shopping list priced at Morrisons, sized to real packs.
      </p>
      <div className="steps">
        {[1, 2, 3].map((i) => (
          <div key={i} className={"stepdot" + (i <= step ? " on" : "")} />
        ))}
      </div>

      {/* STEP 1 — goal + you */}
      {step === 1 && (
        <section>
          <h2>What&apos;s the goal?</h2>
          <div className="chips">
            {(["lose", "maintain", "gain"] as Goal[]).map((g) => (
              <button key={g} className={"chip" + (goal === g ? " on" : "")} onClick={() => setGoal(g)}>
                {g === "lose" ? "Lose weight" : g === "maintain" ? "Maintain" : "Build"}
              </button>
            ))}
          </div>

          <h3 style={{ marginBottom: 2 }}>
            About you <span className="muted" style={{ fontWeight: 400 }}>(optional — better numbers if you share)</span>
          </h3>
          <div className="grid2" style={{ marginTop: 10 }}>
            <div>
              <label className="f">Sex</label>
              <select value={stats.sex} onChange={(e) => setStat("sex", e.target.value)}>
                <option value="">Skip</option>
                <option value="f">Female</option>
                <option value="m">Male</option>
              </select>
            </div>
            <div>
              <label className="f">Age</label>
              <input type="number" inputMode="numeric" placeholder="e.g. 34" onChange={(e) => setStat("age", e.target.value)} />
            </div>
            <div>
              <label className="f">Height cm</label>
              <input type="number" inputMode="numeric" placeholder="e.g. 168" onChange={(e) => setStat("ht", e.target.value)} />
            </div>
            <div>
              <label className="f">Weight kg</label>
              <input type="number" inputMode="numeric" placeholder="e.g. 74" onChange={(e) => setStat("wt", e.target.value)} />
            </div>
            <div style={{ gridColumn: "1/-1" }}>
              <label className="f">Activity</label>
              <select value={stats.act} onChange={(e) => setStat("act", e.target.value)}>
                <option value="1.2">Mostly sitting</option>
                <option value="1.375">Lightly active</option>
                <option value="1.55">Active / training</option>
              </select>
            </div>
          </div>

          <h3 style={{ margin: "18px 0 2px" }}>Cooking dinners for</h3>
          <div className="chips">
            <button className={"chip" + (hh === 1 ? " on" : "")} onClick={() => setHh(1)}>Just me</button>
            <button className={"chip" + (hh === 2 ? " on" : "")} onClick={() => setHh(2)}>Two of us</button>
          </div>

          <div className="targets">
            <div className="ticketc"><span className="lbl">Daily calories</span><span className="big">{targets.band[0]}–{targets.band[1]}</span></div>
            <div className="ticketc"><span className="lbl">Protein floor</span><span className="big">{targets.protein}g</span></div>
          </div>
          <p className="muted">
            {targets.est
              ? "Using a sensible default — add your stats for a personal number. "
              : "Based on your stats. "}
            Every generated day is checked against this band.
          </p>

          <button className="btn" onClick={() => go(2)}>Pick your meals →</button>
          <p className="muted" style={{ marginTop: 14 }}>
            General nutrition guidance, not medical advice. If you have a medical condition or take medication, talk to
            your GP before changing your diet.
          </p>
        </section>
      )}

      {/* STEP 2 — the bank */}
      {step === 2 && (
        <section>
          <h2>Tick what you&apos;d happily eat</h2>
          <p className="muted">The planner only ever uses meals you&apos;ve picked.</p>
          {COURSES.map(([c, label]) => {
            const picked = likedRecipes.filter((r) => r.c === c).length;
            const ok = picked >= COURSE_MIN[c];
            return (
              <div key={c}>
                <div className="coursehead">
                  <h3>{label}</h3>
                  <span className={"need" + (ok ? " ok" : "")}>{picked} picked · need {COURSE_MIN[c]}+</span>
                </div>
                <div className="rgrid">
                  {RECIPES.filter((r) => r.c === c).map((r) => (
                    <button key={r.id} className={"rcard" + (liked.has(r.id) ? " on" : "")} onClick={() => toggleLike(r.id)}>
                      <span className="emoji">{r.e}</span>
                      <span className="nm">{r.n}</span>
                      <span className="mc">{r.p}g · {r.k} kcal</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          <button className="btn" disabled={!canBuild} onClick={() => go(3)}>Build my week →</button>{" "}
          <button className="btn ghost" onClick={() => go(1)}>← Back</button>
        </section>
      )}

      {/* STEP 3 — the plan + shop */}
      {step === 3 && plan && ledger && (
        <section>
          <h2>Monday to Friday, sorted</h2>
          <p className="muted">
            Target {targets.band[0]}–{targets.band[1]} kcal · ≥{targets.protein}g protein a day, dinners for{" "}
            {hh === 2 ? "two" : "one"}.{" "}
            {anyOut ? (
              <span className="warn">One or more days fell outside the band — pick a few more meals for more room.</span>
            ) : (
              "Every day checked against your band."
            )}
          </p>

          <div>
            {plan.map((d, i) => (
              <div key={i} className="day" style={d.out ? { borderLeftColor: "var(--danger)" } : undefined}>
                <h3>
                  {DAYS[i]} <span className="tot">{d.P}g protein · {d.K} kcal{d.out ? " ⚠︎" : ""}</span>
                </h3>
                {([["Breakfast", d.b], ["Lunch", d.l], ["Snack", d.s], ["Dinner", d.din]] as const).map(([slot, r]) => (
                  <div key={slot}>
                    <div className="meal">
                      <span className="slot">{slot}</span>
                      <span className="nm">{r.e} {r.n}</span>
                      <span className="mc">{r.p}g · {r.k}</span>
                    </div>
                    {r.m.length > 0 && (
                      <details className="method">
                        <summary>How to make it</summary>
                        <ol>{r.m.map((x, j) => <li key={j}>{x}</li>)}</ol>
                      </details>
                    )}
                  </div>
                ))}
                {d.tu && (
                  <div className="meal">
                    <span className="slot">Top-up</span>
                    <span className="nm">{d.tu.n}</span>
                    <span className="mc">{d.tu.p}g · {d.tu.k}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          <h2 style={{ marginTop: 26 }}>The shop</h2>
          <p className="muted">Every line links to the real Morrisons product. Estimated prices, Sept 2026.</p>
          <div className="sgroup">
            {ledger.lines.map((l, i) => (
              <div key={i} className="sitem">
                <span>
                  <a href={`https://groceries.morrisons.com/products/${l.slug}`} target="_blank" rel="noopener noreferrer">{l.name}</a>
                  <span className="use">{l.note}</span>
                </span>
                <span className="pr">{money(l.cost)}</span>
              </div>
            ))}
          </div>
          <div className="total"><span>Estimated weekly shop</span><span>{money(ledger.total)}</span></div>
          <p className="muted">
            ≈ {money(Math.round(ledger.total / 5))} per day, all meals included — before anything already in your cupboard.
          </p>

          <div className="note">
            <b>Store cupboard check</b> — staples this week&apos;s cooking dips into; buy only if you&apos;re out:
            <br />
            {ledger.cupboard.join(" · ")}
          </div>

          <button className="btn" onClick={regenerate}>↻ Regenerate week</button>{" "}
          <button className="btn ghost" onClick={() => go(2)}>← Change meals</button>
        </section>
      )}

      <footer>
        <p className="muted">
          Table Plan · proof of concept · recipe bank and prices proven on a live 4-week household rotation · not medical
          advice.
        </p>
      </footer>
    </div>
  );
}
