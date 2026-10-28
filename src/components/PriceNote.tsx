import CountUp from '@/components/CountUp';
import MorrisonsLogo from '@/components/RetailerLogo';
import { PRICES_META } from '@/data';
import { describeEstimate, shortDate, staleness } from '@/lib/pricing/refresh';

/** Honest, dated price line. Pass a total for "≈ £x"; omit it for a freshness-only note. */
export default function PriceNote({ totalPence, now }: { totalPence?: number; now?: Date }) {
  const { checkedAt, unavailable } = PRICES_META;
  const level = staleness(checkedAt, now);
  const d = totalPence != null ? describeEstimate(totalPence, checkedAt, now) : null;
  const checked = checkedAt ? `Checked ${shortDate(checkedAt)}` : 'Not yet checked';
  const extra = (
    <>
      {d?.warning && <p className="pc-warn">{d.warning}</p>}
      {!d && level === 'stale' && <p className="pc-warn">Prices may be out of date.</p>}
      {unavailable.length > 0 && <p className="pc-warn">{unavailable.length} item{unavailable.length > 1 ? 's' : ''} may be unavailable right now.</p>}
    </>
  );
  if (totalPence == null) {
    return (
      <div className={'pricecard slim' + (level === 'stale' ? ' stale' : '')}>
        <span className="pc-lbl">Estimated Morrisons Prices</span><span className="pc-sub">{checked}</span>
        {extra}
      </div>
    );
  }
  return (
    <div className={'pricecard' + (level === 'stale' ? ' stale' : '')}>
      <div className="pc-main">
        <span className="pc-amt"><CountUp value={totalPence} ms={1000} format={(p) => `£${(p / 100).toFixed(2)}`} /></span>
        <span className="pc-lbl"><MorrisonsLogo height={26} /><span>Estimated Total</span></span>
      </div>
      <span className="pc-sub">{checked}</span>
      {extra}
    </div>
  );
}
