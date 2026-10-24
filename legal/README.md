# Legal

The live pages are `src/app/privacy/page.tsx` and `src/app/terms/page.tsx` (written from the real data flows; prices and the free-trial
length come from `src/lib/billing/config.ts`). `privacy-notes.md` and `terms-notes.md` are the checklists they were written from.

Not legal advice: have a solicitor review both before the public launch, and add the business name and address and ICO registration number.
Change a statement in the policy only when the product changes (`tests/legal.test.ts` guards the key promises).
