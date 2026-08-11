/** Piezas de marca. Los paths salen de scripts/generate-branding.mjs. */
import type { CSSProperties } from 'react';
import {
  BRAND_STROKE, LAKE_LOOP_D, LAKE_MARK_D, LAKE_VIEWBOX,
  TAGLINE_D, TAGLINE_DOT_D, TAGLINE_VIEWBOX, WORDMARK_D, WORDMARK_VIEWBOX,
} from '../data/lakePath.generated';

export function LakeMark({ className, title, style }: { className?: string; title?: string; style?: CSSProperties }) {
  return (
    <svg viewBox={LAKE_VIEWBOX} className={className} style={style} role={title ? 'img' : 'presentation'} aria-hidden={!title}>
      {title && <title>{title}</title>}
      <path d={LAKE_MARK_D} fill="currentColor" fillRule="evenodd" />
    </svg>
  );
}

/** Isotipo con tratamiento liquid glass. Se usa grande: splash y onboarding. */
export function LakeMarkGlass({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox={LAKE_VIEWBOX} className={className} style={style} role="img" aria-label="LAKE">
      <defs>
        <linearGradient id="lakeGlassBody" x1="0.12" y1="0.05" x2="0.82" y2="0.95">
          <stop offset="0" stopColor="#CFE9FB" />
          <stop offset="0.22" stopColor="#7FC8F5" />
          <stop offset="0.55" stopColor="#4FB4F0" />
          <stop offset="0.85" stopColor="#2478B8" />
          <stop offset="1" stopColor="#1B5E96" />
        </linearGradient>
        <linearGradient id="lakeGlassRim" x1="0.1" y1="0" x2="0.75" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.95" />
          <stop offset="0.35" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="0.72" stopColor="#7FC8F5" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.15" />
        </linearGradient>
        <clipPath id="lakeGlassClip">
          <path d={LAKE_MARK_D} clipRule="evenodd" />
        </clipPath>
        <filter id="lakeGlassHalo" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3.2" />
        </filter>
        <filter id="lakeGlassSpec" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.8" />
        </filter>
      </defs>
      <path d={LAKE_MARK_D} fillRule="evenodd" fill="#4FB4F0" opacity="0.5" filter="url(#lakeGlassHalo)" />
      <g transform="translate(-1.4 1.6)">
        <path d={LAKE_MARK_D} fillRule="evenodd" fill="none" stroke="#7FC8F5" strokeWidth="0.5" opacity="0.45" />
      </g>
      <path d={LAKE_MARK_D} fillRule="evenodd" fill="url(#lakeGlassBody)" />
      <g clipPath="url(#lakeGlassClip)">
        <g transform="translate(2.6 3)">
          <path d={LAKE_MARK_D} fillRule="evenodd" fill="none" stroke="#0A2F4E" strokeWidth="4.4"
            opacity="0.5" filter="url(#lakeGlassSpec)" />
        </g>
        <g transform="translate(-1.8 -2.2)">
          <path d={LAKE_MARK_D} fillRule="evenodd" fill="none" stroke="#fff" strokeWidth="3"
            opacity="0.6" filter="url(#lakeGlassSpec)" />
        </g>
      </g>
      <path d={LAKE_MARK_D} fillRule="evenodd" fill="none" stroke="url(#lakeGlassRim)" strokeWidth="0.45" />
    </svg>
  );
}

export function Wordmark({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox={WORDMARK_VIEWBOX} className={className} style={style} role="img" aria-label="LAKE">
      <path d={WORDMARK_D} fill="none" stroke="currentColor" strokeWidth={BRAND_STROKE}
        strokeLinecap="butt" strokeLinejoin="miter" strokeMiterlimit={6} />
    </svg>
  );
}

export function Tagline({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox={TAGLINE_VIEWBOX} className={className} style={style} role="img" aria-label="Ride the loop.">
      <path d={TAGLINE_D} fill="none" stroke="currentColor" strokeWidth={BRAND_STROKE}
        strokeLinecap="butt" strokeLinejoin="miter" strokeMiterlimit={6} />
      <path d={TAGLINE_DOT_D} fill="none" stroke="currentColor" strokeWidth={BRAND_STROKE} strokeLinecap="square" />
    </svg>
  );
}

/**
 * El circuito del lago con las vueltas hechas marcadas sobre el trazo.
 * Es el mapa mínimo que pide el producto: sin GPS, pero real.
 */
export function LakeLoop({ done, total, className }: { done: number; total: number; className?: string }) {
  const pct = total > 0 ? Math.max(0, Math.min(1, done / total)) : 0;
  return (
    <svg viewBox={LAKE_VIEWBOX} className={`loop ${className ?? ''}`} role="img"
      aria-label={`${done} de ${total} vueltas`}>
      <path className="loop__track" d={LAKE_LOOP_D} fill="none" strokeWidth="2.4" strokeLinejoin="round" />
      <path
        className="loop__progress"
        d={LAKE_LOOP_D}
        fill="none"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1 - pct}
      />
    </svg>
  );
}

/** Puntos ○ ● ● ○ para las vueltas. */
export function LapDots({ done, total }: { done: number; total: number }) {
  return (
    <div className="laps" role="img" aria-label={`${done} de ${total} vueltas`}>
      {Array.from({ length: Math.max(1, Math.min(12, total)) }, (_, i) => (
        <span key={i} className={`laps__dot${i < done ? ' is-on' : ''}`} />
      ))}
    </div>
  );
}
