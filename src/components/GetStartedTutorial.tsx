import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Compass } from 'lucide-react';
import { DialogOverlay } from './ui/DialogOverlay';
import type { TutorialStep } from '../lib/tutorial';
import './GetStartedTutorial.css';

interface Props {
  steps: TutorialStep[];
  onClose: (outcome: 'skipped' | 'finished') => void;
  onNavigationStep: (show: boolean) => void;
}

export function GetStartedTutorial({ steps, onClose, onNavigationStep }: Props) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const [cardSize, setCardSize] = useState({ width: 420, height: 340 });
  const [phase, setPhase] = useState<'idle' | 'leaving' | 'entering'>('idle');
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const step = steps[index];
  const last = index === steps.length - 1;

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const measure = () => setCardSize({ width: card.offsetWidth, height: card.offsetHeight });
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(card);
    return () => observer?.disconnect();
  }, [step]);

  useEffect(() => () => {
    if (transitionTimer.current) clearTimeout(transitionTimer.current);
  }, []);

  const move = (direction: number) => {
    if (phase !== 'idle') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setIndex(value => value + direction);
      return;
    }
    setPhase('leaving');
    transitionTimer.current = setTimeout(() => {
      setIndex(value => value + direction);
      setPhase('entering');
      transitionTimer.current = setTimeout(() => setPhase('idle'), 180);
    }, 140);
  };

  useEffect(() => {
    const background = Array.from(document.querySelectorAll<HTMLElement>('.main-content'));
    const wasInert = background.map(element => element.hasAttribute('inert'));
    background.forEach(element => element.setAttribute('inert', ''));
    return () => background.forEach((element, item) => { if (!wasInert[item]) element.removeAttribute('inert'); });
  }, []);

  useEffect(() => { onNavigationStep(step?.target.startsWith('#primary-navigation') ?? false); }, [step, onNavigationStep]);

  useEffect(() => {
    if (!step) return;
    const target = document.querySelector<HTMLElement>(step.target);
    if (!target) { setRect(null); return; }
    target.scrollIntoView?.({ block: step.target.startsWith('#primary-navigation') ? 'start' : 'nearest', inline: 'nearest', behavior: 'instant' });
    const measure = () => {
      const bounds = target.getBoundingClientRect();
      setRect(bounds.width > 0 && bounds.height > 0 ? bounds : null);
    };
    measure();
    const frame = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(target);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
      observer?.disconnect();
    };
  }, [step]);

  if (!step) return null;
  const margin = 12;
  const gap = 16;
  const width = cardSize.width;
  const height = cardSize.height;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const clamp = (value: number, size: number, viewport: number) => Math.max(margin, Math.min(value, viewport - size - margin));
  let left = (viewportWidth - width) / 2;
  let top = (viewportHeight - height) / 2;
  if (rect) {
    // Prefer a side beside the control; use the closest vertical space on narrow screens.
    if (rect.right + gap + width <= viewportWidth - margin) {
      left = rect.right + gap;
      top = rect.top + (rect.height - height) / 2;
    } else if (rect.left - gap - width >= margin) {
      left = rect.left - gap - width;
      top = rect.top + (rect.height - height) / 2;
    } else {
      left = rect.left + (rect.width - width) / 2;
      const below = viewportHeight - rect.bottom - gap - margin;
      const above = rect.top - gap - margin;
      top = below >= height || below >= above ? rect.bottom + gap : rect.top - gap - height;
    }
  }
  return <DialogOverlay label="Get Started tutorial" onClose={() => onClose('skipped')}
    initialFocusRef={nextRef} className="tutorial-overlay" navigationFocusSelector="#primary-navigation .sidebar-nav button:not([disabled]), .menu-toggle">
    {rect ? <div aria-hidden="true" className="tutorial-spotlight" style={{
      left: Math.max(2, rect.left - 4), top: Math.max(2, rect.top - 4),
      width: Math.min(rect.width + 8, window.innerWidth - Math.max(2, rect.left - 4) - 2), height: rect.height + 8
    }} /> : <div className="tutorial-shade" aria-hidden="true" />}
    <section ref={cardRef} data-dialog-content className={`glass-card tutorial-card tutorial-card-${phase}`} style={{ left: clamp(left, width, viewportWidth), top: clamp(top, height, viewportHeight) }}>
      <div className="flex items-center gap-2 text-primary"><Compass size={20} aria-hidden="true" /><strong>Get Started</strong></div>
      <div aria-live="polite" aria-atomic="true" className="tutorial-step">
        <p className="text-xs text-muted">Step {index + 1} of {steps.length}</p>
        <h2>{step.title}</h2>
        <p className="text-sm text-muted">{step.description}</p>
      </div>
      <div className="tutorial-progress" aria-hidden="true"><span style={{ width: `${(index + 1) * 100 / steps.length}%` }} /></div>
      <div className="tutorial-actions">
        <button type="button" className="btn btn-outline btn-sm tutorial-change-section" onClick={() => onNavigationStep(true)}>Change section</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onClose('skipped')}>Skip tutorial</button>
        <button type="button" className="btn btn-outline btn-sm" disabled={index === 0} aria-disabled={phase !== 'idle'} onClick={() => move(-1)}><ArrowLeft size={16} aria-hidden="true" /> Back</button>
        <button ref={nextRef} type="button" className="btn btn-primary btn-sm" aria-disabled={phase !== 'idle'} onClick={() => { if (phase === 'idle') { if (last) onClose('finished'); else move(1); } }}>
          {last ? 'Finish' : 'Next'}{last ? <Check size={16} aria-hidden="true" /> : <ArrowRight size={16} aria-hidden="true" />}
        </button>
      </div>
      <p className="text-xs text-muted tutorial-keyboard">Choose a sidebar section to switch tours · Tab to move · Enter to select · Esc to skip</p>
    </section>
  </DialogOverlay>;
}
