'use client';

import { useId } from 'react';

import { cn } from '@/lib/utils';

type SparklineProps = {
    values: number[];
    className?: string;
    /** Accessible label when not decorative */
    'aria-label'?: string;
    /** When true, hide from assistive tech (decorative / illustrative only). */
    decorative?: boolean;
};

const W = 72;
const H = 22;

function normalize(values: number[]): number[] {
    if (values.length === 0) return [0];
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (max === min) return values.map(() => H / 2);
    return values.map((v) => H - 2 - ((v - min) / (max - min)) * (H - 4));
}

/**
 * Tiny SVG line chart for dense cards (WE-01-HYPER-DENSITY).
 * Pair with `decorative` when values are illustrative, not metrics.
 */
export function Sparkline({ values, className, 'aria-label': ariaLabel, decorative = true }: SparklineProps) {
    const uid = useId().replace(/:/g, '');
    const gradId = `ovo-sparkline-stroke-${uid}`;
    const filterId = `ovo-sparkline-glow-${uid}`;
    const y = normalize(values);
    const n = y.length;
    const step = n <= 1 ? 0 : W / (n - 1);
    const points = y.map((yy, i) => `${(step * i).toFixed(1)},${yy.toFixed(1)}`).join(' ');

    return (
        <svg
            data-ovo-sparkline
            width={W}
            height={H}
            viewBox={`0 0 ${W} ${H}`}
            className={cn('shrink-0 overflow-visible', className)}
            role={decorative ? 'presentation' : 'img'}
            aria-hidden={decorative ? true : undefined}
            aria-label={decorative ? undefined : ariaLabel}
        >
            <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox">
                    <stop offset="0%" stopColor="var(--chart-2)" stopOpacity="0.95" />
                    <stop offset="100%" stopColor="var(--chart-4)" stopOpacity="0.85" />
                </linearGradient>
                <filter id={filterId} x="-40%" y="-40%" width="180%" height="180%">
                    <feGaussianBlur stdDeviation="1.2" result="blur" />
                    <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>
            <polyline
                points={points}
                fill="none"
                stroke={`url(#${gradId})`}
                strokeWidth={1.75}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                filter={`url(#${filterId})`}
            />
        </svg>
    );
}

/** Deterministic pseudo-series from a string seed (decorative sparklines). */
export function sparklineValuesFromSeed(seed: string, len = 8): number[] {
    const out: number[] = [];
    let h = 0;
    for (let i = 0; i < len; i++) {
        const c = seed.charCodeAt(i % seed.length) || 65;
        h = (h * 31 + c + i * 17) % 997;
        out.push(h / 997);
    }
    return out;
}
