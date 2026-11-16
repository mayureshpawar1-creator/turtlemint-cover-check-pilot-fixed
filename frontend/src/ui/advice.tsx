/**
 * Shared pieces for the two one-screen boards (S7 cover plan, U6 policy board):
 * priority chips, the have-vs-need bar, the block pill, and the bottom sheets that hold every detail —
 * so the board itself never scrolls and the person never leaves it.
 */
import { useEffect, useRef, type ReactNode } from 'react';
import type { AdvicePriority, PickView, SourceId } from '@cover-check/shared';
import { PRIORITY_LABEL } from '@cover-check/shared';
import { IconAlert, IconCheck, IconClock, IconHeadset, IconInfo, IconLink, IconQuestion, IconSparkle, IconUpload } from './icons';
import { SourceLine } from './charts';

const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;
/** Keeps "₹1.25 Cr" / "₹20 L" on one line. */
export const nb = (s: string) => s.replace(/(₹[\d.,]+) (Cr|L)\b/g, '$1 $2');

export function PriorityChip({ p }: { p: AdvicePriority }) {
  return <span className={`prio prio--${p}`}>{p === 'done' ? <IconCheck size={11} /> : null}{PRIORITY_LABEL[p]}</span>;
}

/** Have-vs-need bar: green for what you have, hatched red for the rest. Status is in words too, never colour alone. */
export function HaveBar({ pct, label }: { pct: number | null; label: ReactNode }) {
  return (
    <div className="havebar" role="img" aria-label={typeof label === 'string' ? label : undefined}>
      <span className="havebar__track">{pct === null ? <span className="havebar__unknown" /> : <span className="havebar__fill" style={{ width: `${pct}%` }} />}</span>
      <span className="havebar__lbl">{label}</span>
    </div>
  );
}

/** The one action on a block: price once Turtlemint enters one, otherwise the way into the details. */
export function BlockPill({ label, price, onClick }: { label: string; price?: PickView['price']; onClick(): void }) {
  return (
    <button className="pricepill" onClick={onClick}>
      {price ? <span><small>From</small> <b className="num">{rupees(price.fromInr)}</b>/{price.per === 'month' ? 'mo' : 'yr'}</span> : <span>{label}</span>}
      <span aria-hidden="true">→</span>
    </button>
  );
}
export const pillLabel = (p: PickView) => (p.kind === 'keep' ? 'See why' : p.kind === 'check' ? 'Check my policy' : 'See plan details');

function Sheet({ onClose, labelledBy, children }: { onClose(): void; labelledBy: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby={labelledBy} tabIndex={-1} ref={ref} onClick={(e) => e.stopPropagation()}>
        <span className="sheet__handle" aria-hidden="true" />
        {children}
      </div>
    </div>
  );
}
const Close = ({ onClose }: { onClose(): void }) => <button className="sheet__x" onClick={onClose} aria-label="Close">×</button>;

/** A plan we suggest, or our advice not to buy (keep) / to check first (check). */
export function PlanSheet({ p, onClose, onAdvisor, onSite, onUpload }: { p: PickView; onClose(): void; onAdvisor(): void; onSite(): void; onUpload(): void }) {
  return (
    <Sheet onClose={onClose} labelledBy="sheet-title">
      <div className="sheet__head">
        <span className={`pickbadge${p.kind === 'plan' ? '' : ' pickbadge--advice'}`}><IconSparkle size={13} />{p.kind === 'plan' ? 'Turtlemint pick' : 'Our advice'}</span>
        <Close onClose={onClose} />
      </div>
      <h2 id="sheet-title">{p.product ?? p.title}{p.amount ? <span className="sheet__amt num"> · {p.amount}</span> : null}</h2>
      {p.insurer ? <p className="sheet__insurer">{p.insurer}</p> : null}
      <p className="sheet__tag">{p.tagline}</p>
      <p className="sheet__why"><b>For you:</b> {nb(p.why)}</p>
      <ul className="ticks ticks--lg">{p.points.map((x) => <li key={x}><IconCheck size={15} />{x}</li>)}</ul>
      {p.tips.length ? (
        <ul className="sheet__tips" aria-label="Good to know">
          {p.tips.slice(0, 3).map((x) => <li key={x}><IconInfo size={15} />{nb(x)}</li>)}
        </ul>
      ) : null}
      {p.sourceId ? <SourceLine id={p.sourceId} /> : null}
      {p.kind === 'plan' ? (
        <>
          <div className="sheet__price">
            {p.price
              ? <><span><small>Starting from</small><b className="num">{rupees(p.price.fromInr)}</b>/{p.price.per}</span>{p.price.note ? <small>{p.price.note}</small> : null}</>
              : <small>Your price depends on age, city and cover. Your advisor gets you the exact quote on the call.</small>}
          </div>
          <button className="btn btn--primary" onClick={onAdvisor}><IconHeadset size={18} />Talk to advisor about this</button>
          <a className="btn btn--ghost sheet__site" href={p.url} target="_blank" rel="noopener" onClick={onSite}><IconLink size={15} />View on Turtlemint</a>
        </>
      ) : p.kind === 'check' ? (
        <>
          <button className="btn btn--primary" onClick={onUpload}><IconUpload size={18} />Upload my policy</button>
          <button className="btn btn--ghost sheet__site" onClick={onAdvisor}><IconHeadset size={15} />Or ask an advisor to check it</button>
        </>
      ) : (
        <button className="btn btn--secondary" onClick={onAdvisor}><IconHeadset size={18} />Questions? Talk to an advisor</button>
      )}
    </Sheet>
  );
}

export type InfoTone = 'good' | 'watch' | 'risk' | 'unknown' | 'later' | 'skip';
const TONE_ICON: Record<InfoTone, ReactNode> = {
  good: <IconCheck size={14} />, watch: <IconClock size={14} />, risk: <IconAlert size={14} />, unknown: <IconQuestion size={14} />,
  later: <IconClock size={14} />, skip: <IconInfo size={14} />,
};
export const toneIcon = (t: InfoTone) => TONE_ICON[t];

/** Plain words about one thing: a policy check, or why a block can wait / isn't for them. */
export function InfoSheet({ title, status, lines, todo, page, sourceId, onClose, onAdvisor }: {
  title: string; status?: { tone: InfoTone; text: string }; lines: string[]; todo?: string | null; page?: number | null; sourceId?: SourceId;
  onClose(): void; onAdvisor(): void;
}) {
  return (
    <Sheet onClose={onClose} labelledBy="info-title">
      <div className="sheet__head">
        {status ? <span className={`statuschip statuschip--${status.tone}`}>{TONE_ICON[status.tone]}{status.text}</span> : <span />}
        <Close onClose={onClose} />
      </div>
      <h2 id="info-title">{title}</h2>
      {lines.map((l) => <p key={l} className="sheet__tag">{nb(l)}</p>)}
      {todo ? <p className="sheet__why"><b>What we’d do:</b> {nb(todo)}</p> : null}
      {page ? <p className="sheet__page"><span className="pagechip">p. {page}</span>Read from page {page} of your policy</p> : null}
      {sourceId ? <SourceLine id={sourceId} /> : null}
      <button className="btn btn--secondary" onClick={onAdvisor}><IconHeadset size={18} />Talk to an advisor about this</button>
    </Sheet>
  );
}

/** The whole policy in plain words, every line with its page. Scrolls inside the sheet only. */
export function PlainSheet({ sections, onClose }: { sections: { title: string; lines: { text: string; page: number | null; found: boolean }[] }[]; onClose(): void }) {
  return (
    <Sheet onClose={onClose} labelledBy="plain-title">
      <div className="sheet__head"><span className="pickbadge pickbadge--advice">Read from your document</span><Close onClose={onClose} /></div>
      <h2 id="plain-title">Your policy in plain words</h2>
      <div className="plain plain--sheet">
        {sections.map((sec) => (
          <section key={sec.title}>
            <h3>{sec.title}</h3>
            <ul>{sec.lines.map((l, k) => <li key={k} className={l.found ? '' : 'missing'}>{l.text}{l.page ? <span className="pagechip">p. {l.page}</span> : null}</li>)}</ul>
          </section>
        ))}
      </div>
      <p className="advice__note">Every line shows the page it came from. Anything we couldn’t find says so — nothing is guessed.</p>
    </Sheet>
  );
}
