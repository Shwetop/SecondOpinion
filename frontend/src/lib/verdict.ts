import type { Verdict } from '../types';

export interface VerdictStyle {
  label: string;
  shortLabel: string;
  dot: string;
  text: string;
  tint: string;
}

export function getVerdictStyle(verdict: Verdict | string): VerdictStyle {
  const v = (verdict || '').toUpperCase();
  switch (v) {
    case 'SUPPORTED':
      return {
        label: 'Supported by source',
        shortLabel: 'Supported',
        dot: 'var(--supported-dot)',
        text: 'var(--supported-text)',
        tint: 'var(--supported-tint)',
      };
    case 'CONTRADICTED':
      return {
        label: 'Contradicted by source',
        shortLabel: 'Contradicted',
        dot: 'var(--contradicted-dot)',
        text: 'var(--contradicted-text)',
        tint: 'var(--contradicted-tint)',
      };
    case 'INSUFFICIENT_EVIDENCE':
      return {
        label: 'Insufficient evidence',
        shortLabel: 'Insufficient',
        dot: 'var(--insufficient-dot)',
        text: 'var(--insufficient-text)',
        tint: 'var(--insufficient-tint)',
      };
    case 'CONFLICTING_EVIDENCE':
      return {
        label: 'Conflicting evidence',
        shortLabel: 'Conflicting',
        dot: 'var(--conflicting-dot)',
        text: 'var(--conflicting-text)',
        tint: 'var(--conflicting-tint)',
      };
    case 'AMBIGUOUS':
    case 'MIXED':
    default:
      return {
        label: 'Ambiguous / mixed',
        shortLabel: 'Ambiguous',
        dot: 'var(--ambiguous-dot)',
        text: 'var(--ambiguous-text)',
        tint: 'var(--ambiguous-tint)',
      };
  }
}
