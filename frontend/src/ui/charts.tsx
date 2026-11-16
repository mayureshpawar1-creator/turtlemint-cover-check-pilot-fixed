/**
 * Small, accessible charts for Cover Check. Plain SVG/HTML, no library.
 * Rules (dataviz method): bars ≤ 24px with 4px rounded data-ends, 2px surface gaps between segments,
 * text in ink tokens (never the series colour), direct labels + legend, a hover/focus readout, and a
 * visually-hidden table for screen readers. Status always ships with an icon and a word.
 */
import { useState, type ReactNode } from 'react';
import { SOURCES, type SourceId } from '@cover-check/shared';
import { IconAlert, IconCheck, IconQuestion } from './icons';

/** Categorical slots validated with scripts/validate_palette.js (light surface, stack order). */
export const SERIES = { government: 'var(--series-1)', group: 'var(--series-2)', individual: 'var(--series-3)' } as const;

const SrTable = ({ caption, rows }: { caption: string; rows: [string, string][] }) => (
  <table className="sr-only"><caption>{caption}</caption><tbody>{rows.map(([k, v]) => <tr key={k}><th scope="row">{k}</th><td>{v}</td></tr>)}</tbody></table>
);

export function SourceLine({ id }: { id: SourceId }) {
  const s = SOURCES[id];
  return <p className="source">Source: <a href={s.url} target="_blank" rel="noopener noreferrer">{s.label}</a>, {s.published}</p>;
}

export function ChartCard({ title, children, sourceId, caption }: { title: string; children: ReactNode; sourceId?: SourceId; caption?: string }) {
  return (
    <figure className="chart">
      <figcaption className="chart__title">{title}</figcaption>
      {children}
      {caption ? <p className="chart__caption">{caption}</p> : null}
      {sourceId ? <SourceLine id={sourceId} /> : null}
    </figure>
  );
}

/** Part-to-whole in one stacked bar, with the person's segment marked "You". */
export function ShareBar({ segments }: { segments: { key: string; label: string; pct: number; you: boolean }[] }) {
  const [hover, setHover] = useState<string | null>(null);
  const active = segments.find((s) => s.key === hover) ?? segments.find((s) => s.you) ?? segments[0]!;
  return (
    <div className="share">
      <div className="share__you" aria-hidden="true">
        {segments.map((s) => <span key={s.key} style={{ flexGrow: s.pct }}>{s.you ? <b>You ▾</b> : null}</span>)}
      </div>
      <div className="share__bar" role="img" aria-label={segments.map((s) => `${s.label} ${s.pct}%`).join(', ')}>
        {segments.map((s) => (
          <span key={s.key} tabIndex={0} className={`share__seg${s.you ? ' is-you' : ''}`}
            style={{ flexGrow: s.pct, background: SERIES[s.key as keyof typeof SERIES] ?? 'var(--ink-400)' }}
            onMouseEnter={() => setHover(s.key)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(s.key)} onBlur={() => setHover(null)} />
        ))}
      </div>
      <p className="share__readout" aria-live="polite"><b className="num">{active.pct}%</b> {active.label.toLowerCase()}</p>
      <ul className="legend">
        {segments.map((s) => (
          <li key={s.key}><span className="legend__swatch" style={{ background: SERIES[s.key as keyof typeof SERIES] }} />{s.label} <span className="num muted">{s.pct}%</span></li>
        ))}
      </ul>
      <SrTable caption="Share of insured lives" rows={segments.map((s) => [s.label, `${s.pct}%`])} />
    </div>
  );
}

/** One measure, a few categories: horizontal bars with the value at the tip. The person's bar is the accent. */
export function CompareBars({ bars, unit }: { bars: { label: string; value: number; you: boolean; note?: string }[]; unit: string }) {
  const max = Math.max(...bars.map((b) => b.value)) * 1.08;
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div className="bars">
      {bars.map((b, i) => (
        <div key={b.label} className={`bars__row${hover === i ? ' is-hover' : ''}`} tabIndex={0}
          onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}>
          <span className="bars__label">{b.label}</span>
          <span className="bars__track">
            <span className={`bars__fill${b.you ? ' is-you' : ''}`} style={{ width: `${(b.value / max) * 100}%` }} />
            <span className="bars__value num">{unit === '₹ L' ? `₹${b.note ?? b.value} L` : `${b.value} ${unit}`}</span>
          </span>
        </div>
      ))}
      <SrTable caption="Cover comparison" rows={bars.map((b) => [b.label, `₹${b.value} L`])} />
    </div>
  );
}

export function StatFigure({ value, label }: { value: string; label: string }) {
  return <div className="statfig"><span className="statfig__value">{value}</span><span className="statfig__label">{label}</span></div>;
}

/** Months served of a waiting period, with year ticks. */
export function WaitMeter({ served, total }: { served: number; total: number }) {
  const pct = Math.min(100, (served / total) * 100);
  const ticks = Array.from({ length: Math.floor(total / 12) + 1 }, (_, i) => i * 12);
  return (
    <div className="meter" role="meter" aria-valuemin={0} aria-valuemax={total} aria-valuenow={served} aria-label={`${served} of ${total} months served`}>
      <div className="meter__track"><div className="meter__fill" style={{ width: `${pct}%` }} /></div>
      <div className="meter__ticks">{ticks.map((t) => <span key={t} style={{ left: `${(t / total) * 100}%` }}>{t === 0 ? 'Start' : `${t / 12} yr`}</span>)}</div>
      <p className="meter__readout"><b className="num">{served}</b> of {total} months served · <b className="num">{Math.max(0, total - served)}</b> to go</p>
    </div>
  );
}

export type Status = 'strong' | 'review' | 'not_found' | 'good' | 'check' | 'unknown' | 'tip';
const STATUS_META: Record<Status, { label: string; cls: string; icon: ReactNode }> = {
  strong: { label: 'Strong', cls: 'good', icon: <IconCheck size={14} strokeWidth={2.5} /> },
  good: { label: 'In place', cls: 'good', icon: <IconCheck size={14} strokeWidth={2.5} /> },
  review: { label: 'Review', cls: 'review', icon: <IconAlert size={14} /> },
  check: { label: 'To check', cls: 'review', icon: <IconAlert size={14} /> },
  not_found: { label: 'Not found', cls: 'unknown', icon: <IconQuestion size={14} /> },
  unknown: { label: 'Not sure yet', cls: 'unknown', icon: <IconQuestion size={14} /> },
  tip: { label: 'Look for', cls: 'tip', icon: <IconQuestion size={14} /> },
};
export const StatusPill = ({ s }: { s: Status }) => {
  const m = STATUS_META[s];
  return <span className={`status status--${m.cls}`}>{m.icon}{m.label}</span>;
};

/** Per-area status strip (no total score): one segment per area, grouped by status, with a legend of counts. */
export function StatusStrip({ items }: { items: { label: string; status: 'strong' | 'review' | 'not_found' }[] }) {
  const groups = (['strong', 'review', 'not_found'] as const).map((st) => ({ st, n: items.filter((i) => i.status === st).length })).filter((g) => g.n);
  return (
    <div className="strip">
      <div className="strip__bar" role="img" aria-label={groups.map((g) => `${g.n} ${STATUS_META[g.st].label}`).join(', ')}>
        {items.slice().sort((a, b) => ['strong', 'review', 'not_found'].indexOf(a.status) - ['strong', 'review', 'not_found'].indexOf(b.status))
          .map((i) => <span key={i.label} title={`${i.label}: ${STATUS_META[i.status].label}`} className={`strip__seg strip__seg--${STATUS_META[i.status].cls}`} />)}
      </div>
      <ul className="legend">{groups.map((g) => <li key={g.st}><StatusPill s={g.st} /><span className="num">{g.n}</span></li>)}</ul>
    </div>
  );
}

/** Ring showing checklist progress ("4 of 6 in place"). */
export function ProgressRing({ done, total }: { done: number; total: number }) {
  const r = 26, c = 2 * Math.PI * r, pct = total ? done / total : 0;
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" role="img" aria-label={`${done} of ${total} in place`}>
      <circle cx="32" cy="32" r={r} fill="none" stroke="var(--mint-100)" strokeWidth="7" />
      <circle cx="32" cy="32" r={r} fill="none" stroke="var(--mint-600)" strokeWidth="7" strokeLinecap="round"
        strokeDasharray={`${c * pct} ${c}`} transform="rotate(-90 32 32)" style={{ transition: 'stroke-dasharray 400ms var(--ease)' }} />
      <text x="32" y="37" textAnchor="middle" fontSize="15" fontWeight="600" fill="var(--ink-900)" fontFamily="var(--font-display)">{done}/{total}</text>
    </svg>
  );
}
