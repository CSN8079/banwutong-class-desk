import { useEffect, type ReactNode } from 'react';
import { LoaderCircle, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { getInitial } from '../lib/format';
import type { Gender } from '../types';

interface ModalProps {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  width?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Modal({ open, title, description, children, footer, onClose, width = 'md' }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className={`modal modal-${width}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-header">
          <div>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button className="icon-button" onClick={onClose} aria-label="关闭">
            <X size={20} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-footer">{footer}</footer>}
      </section>
    </div>,
    document.body,
  );
}

export function Avatar({ name, gender = 'other', size = 'md', muted = false }: { name: string; gender?: Gender; size?: 'xs' | 'sm' | 'md' | 'lg'; muted?: boolean }) {
  const femalePalettes = ['avatar-rose', 'avatar-peach', 'avatar-clay', 'avatar-coral'];
  const malePalettes = ['avatar-sky', 'avatar-blue', 'avatar-mint', 'avatar-indigo'];
  const neutralPalettes = ['avatar-sage', 'avatar-lavender', 'avatar-slate', 'avatar-mint'];
  const palettes = gender === 'female' ? femalePalettes : gender === 'male' ? malePalettes : neutralPalettes;
  const hash = Array.from(name).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return (
    <span className={`avatar avatar-${size} ${palettes[hash % palettes.length]} ${muted ? 'avatar-muted' : ''}`} aria-hidden="true">
      {getInitial(name)}
    </span>
  );
}

export function PageHeading({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function ProgressRing({
  value,
  size = 110,
  stroke = 10,
  color = '#1d7a5f',
  label,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  label?: string;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, value)) / 100) * circumference;
  return (
    <div className="progress-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e8eee9" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="progress-ring-content">
        <strong>{value}%</strong>
        {label && <span>{label}</span>}
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function LoadingButton({ loading, children }: { loading: boolean; children: ReactNode }) {
  return loading ? <><LoaderCircle size={17} className="spin" /> 处理中…</> : children;
}

export function Tag({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'green' | 'amber' | 'red' | 'blue' }) {
  return <span className={`tag tag-${tone}`}>{children}</span>;
}
