/** Controles base. Todo lo táctil pasa por acá. */
import {
  useCallback, useEffect, useId, useRef, useState,
  type ButtonHTMLAttributes, type CSSProperties, type InputHTMLAttributes, type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { IconChevronRight, IconClose } from './icons';
import { LakeMark } from './brand';

/** Vibración discreta si el dispositivo la permite. Nunca imprescindible. */
export function tap(pattern: number | number[] = 8): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* sin vibración, el feedback visual alcanza */
  }
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'primary' | 'ghost' | 'danger';
  size?: 'md' | 'sm';
  block?: boolean;
};

export function Button({ variant = 'default', size = 'md', block, className = '', onClick, ...rest }: ButtonProps) {
  const cls = [
    'btn',
    variant === 'primary' && 'btn--primary',
    variant === 'ghost' && 'btn--ghost',
    variant === 'danger' && 'btn--ghost btn--danger',
    size === 'sm' && 'btn--sm',
    block && 'btn--block',
    className,
  ].filter(Boolean).join(' ');
  return (
    <button
      type="button"
      className={cls}
      onClick={(e) => {
        tap();
        onClick?.(e);
      }}
      {...rest}
    />
  );
}

export function Card({ children, className = '', as: As = 'div', style }: {
  children: ReactNode; className?: string; as?: 'div' | 'section'; style?: CSSProperties;
}) {
  return <As className={`glass ${className}`} style={style}>{children}</As>;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
      {hint && <span className="field__hint">{hint}</span>}
    </label>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="input" {...props} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className="input" {...props} />;
}

export function Segmented<T extends string | number>({ value, options, onChange, ariaLabel }: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  ariaLabel?: string;
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={`segmented__item${o.value === value ? ' is-on' : ''}`}
          onClick={() => {
            tap();
            onChange(o.value);
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Stepper({ value, min = 0, max = 99, step = 1, unit, decimals = 0, onChange }: {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  decimals?: number;
  onChange: (v: number) => void;
}) {
  const clamp = (v: number) => Number(Math.max(min, Math.min(max, v)).toFixed(decimals + 2));
  const shown = value.toFixed(decimals).replace('.', ',');
  return (
    <div className="stepper">
      <span className="stepper__value tabular">
        {shown}
        {unit && <span className="stepper__unit">{unit}</span>}
      </span>
      <div className="stepper__btns">
        <button type="button" className="stepper__btn" aria-label="Restar" disabled={value <= min}
          onClick={() => { tap(); onChange(clamp(value - step)); }}>−</button>
        <button type="button" className="stepper__btn" aria-label="Sumar" disabled={value >= max}
          onClick={() => { tap(); onChange(clamp(value + step)); }}>+</button>
      </div>
    </div>
  );
}

export function Slider({ value, min, max, onChange, ariaLabel }: {
  value: number; min: number; max: number; onChange: (v: number) => void; ariaLabel: string;
}) {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <input
      type="range"
      className="slider"
      style={{ ['--fill' as string]: `${fill}%` }}
      min={min}
      max={max}
      step={1}
      value={value}
      aria-label={ariaLabel}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`switch${checked ? ' is-on' : ''}`}
      onClick={() => { tap(); onChange(!checked); }}
    >
      <span className="switch__knob" />
    </button>
  );
}

export function ListItem({ label, value, onClick, children, danger }: {
  label: string;
  value?: ReactNode;
  onClick?: () => void;
  children?: ReactNode;
  danger?: boolean;
}) {
  const content = (
    <>
      <span className="list__label" style={danger ? { color: 'var(--danger)' } : undefined}>{label}</span>
      <span className="row" style={{ gap: 8 }}>
        {value != null && <span className="list__value">{value}</span>}
        {children}
        {onClick && <IconChevronRight className="chevron" />}
      </span>
    </>
  );
  return onClick ? (
    <button type="button" className="list__item" onClick={() => { tap(); onClick(); }}>{content}</button>
  ) : (
    <div className="list__item">{content}</div>
  );
}

/* ------------------------------------------------------------------ */
/* Sheet                                                               */
/* ------------------------------------------------------------------ */

export function Sheet({ open, title, onClose, children, footer }: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <>
      <div className="sheet-backdrop" onClick={onClose} aria-hidden />
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="sheet__grip" />
        <header className="sheet__head">
          <h2 className="sheet__title" id={titleId}>{title}</h2>
          <button type="button" className="cal__nav" aria-label="Cerrar" onClick={() => { tap(); onClose(); }}>
            <IconClose style={{ width: 17, height: 17 }} />
          </button>
        </header>
        <div className="sheet__scroll">{children}</div>
        {footer && <div className="sheet__footer">{footer}</div>}
      </div>
    </>,
    document.body
  );
}

/** Confirmación para todo lo que destruye datos. */
export function ConfirmSheet({ open, title, message, confirmLabel, onConfirm, onCancel }: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Sheet
      open={open}
      title={title}
      onClose={onCancel}
      footer={
        <>
          <Button block onClick={onCancel}>Cancelar</Button>
          <Button block className="btn--danger" onClick={onConfirm}>{confirmLabel}</Button>
        </>
      }
    >
      <p className="body">{message}</p>
    </Sheet>
  );
}

export function EmptyState({ text, children }: { text: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <LakeMark className="empty__mark" />
      <p className="empty__text">{text}</p>
      {children}
    </div>
  );
}

/** Imagen con fade-in desde su miniatura embebida. */
export function ArtImage({ src, lqip, alt, className }: {
  src: string; lqip: string; alt: string; className?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  const onLoad = useCallback(() => setLoaded(true), []);
  useEffect(() => {
    if (ref.current?.complete) setLoaded(true);
  }, [src]);

  return (
    <>
      <div className="challenge__media" style={{ backgroundImage: `url(${lqip})` }}>
        <img
          ref={ref}
          className={`${className ?? 'challenge__img'}${loaded ? ' is-loaded' : ''}`}
          src={src}
          alt={alt}
          loading="eager"
          decoding="async"
          onLoad={onLoad}
        />
      </div>
    </>
  );
}
