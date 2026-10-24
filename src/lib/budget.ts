import { BUDGET_LIMITS, type Budget } from './content/macros';

export const BUDGETS: Budget[] = ['low', 'medium', 'high'];
export const BUDGET_LABEL: Record<Budget, string> = { low: '£ Low', medium: '££ Medium', high: '£££ High' };

/** £ / ££ / £££ marker for a meal's cost tier ('' for macros-only meals, which have none). */
export const tierMark = (b: Budget | null | undefined) => (b === 'low' ? '£' : b === 'medium' ? '££' : b === 'high' ? '£££' : '');

const pounds = (pence: number) => `£${(pence / 100).toFixed(2)}`;

/** What each spend setting means, in the same per-portion numbers the meal tiers are built from. */
export const budgetHelp = (b: Budget): string => {
  const L = BUDGET_LIMITS;
  if (b === 'low') return `Everyday meals only: dinners up to about ${pounds(L.dinner.low)} a portion, breakfasts and lunches up to ${pounds(L.lunch.low)}.`;
  if (b === 'medium') return `Skips the priciest meals: dinners up to about ${pounds(L.dinner.medium)} a portion, breakfasts and lunches up to ${pounds(L.lunch.medium)}.`;
  return 'Anything goes, including steak, salmon and prawns.';
};
