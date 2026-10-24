import { PRICES_META } from '@/data';
import { describeEstimate, shortDate, staleness } from '@/lib/pricing/refresh';

/** Honest, dated price line. Pass a total for "≈ £x"; omit it for a freshness-only note. */
export default function PriceNote({ totalPence, now }: { totalPence?: number; now?: Date }) {
  const { checkedAt, unavailable } = PRICES_META;
  const level = staleness(checkedAt, now);
  const d = totalPence != null ? describeEstimate(totalPence, checkedAt, now) : null;
  return (
    <div className={'note' + (level === 'stale' ? ' warn-note' : '')}>
      <b>{d ? d.text : `Estimated Morrisons prices, ${checkedAt ? `checked ${shortDate(checkedAt)}` : 'not yet checked'}`}</b>
      {d?.warning && <><br />{d.warning}</>}
      {!d && level === 'stale' && <><br />Prices may be out of date.</>}
      {unavailable.length > 0 && <><br />{unavailable.length} item{unavailable.length > 1 ? 's' : ''} may be unavailable right now.</>}
    </div>
  );
}
