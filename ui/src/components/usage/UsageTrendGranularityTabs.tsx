'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { TrendGranularity } from '@/lib/usageOrgDeepLink';
import { cn } from '@/lib/utils';

type UsageTrendGranularityTabsProps = {
    value: TrendGranularity;
    onValueChange: (g: TrendGranularity) => void;
    /** Short label next to the tab list (e.g. “Buckets”, “Trend”) */
    label: string;
    /** Stable id for `aria-labelledby` on the tab list */
    labelId: string;
    variant?: 'default' | 'compact';
};

/**
 * Week vs day rollup selector for `/usage` and Simulation rail (WE-01-ORG-USAGE, WE-01-A11Y-QA).
 * Uses Radix Tabs so arrow keys move between **Week** and **Day** like other tablists.
 */
export function UsageTrendGranularityTabs({
    value,
    onValueChange,
    label,
    labelId,
    variant = 'default',
}: UsageTrendGranularityTabsProps) {
    return (
        <Tabs
            value={value}
            onValueChange={(v) => onValueChange(v as TrendGranularity)}
            className="w-fit shrink-0"
        >
            <div className={cn('flex flex-wrap items-center gap-2')}>
                <span
                    id={labelId}
                    className={cn(
                        'font-medium text-muted-foreground',
                        variant === 'compact' ? 'text-[10px] uppercase tracking-wide' : 'text-xs',
                    )}
                >
                    {label}
                </span>
                <TabsList
                    aria-labelledby={labelId}
                    className={cn(
                        'ovo-segmented-track inline-flex w-fit items-center justify-center gap-0.5 p-0.5 shadow-none',
                        variant === 'compact' ? 'h-8' : 'h-9',
                    )}
                >
                    <TabsTrigger
                        value="week"
                        className={cn(
                            'rounded-full border border-transparent px-3 text-xs font-medium text-muted-foreground ease-ovo-spring',
                            'transition-[color,background-color,border-color,box-shadow,transform] duration-200',
                            'data-[state=active]:border-border/50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm',
                            variant === 'compact' && 'h-7 px-2.5 text-[11px]',
                        )}
                    >
                        Week
                    </TabsTrigger>
                    <TabsTrigger
                        value="day"
                        className={cn(
                            'rounded-full border border-transparent px-3 text-xs font-medium text-muted-foreground ease-ovo-spring',
                            'transition-[color,background-color,border-color,box-shadow,transform] duration-200',
                            'data-[state=active]:border-border/50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm',
                            variant === 'compact' && 'h-7 px-2.5 text-[11px]',
                        )}
                    >
                        Day
                    </TabsTrigger>
                </TabsList>
            </div>
            {/* Panels are visually hidden; the chart lives outside this control (Radix requires a panel per tab). */}
            <TabsContent
                value="week"
                className="!mt-0 hidden h-0 w-0 overflow-hidden border-0 p-0 shadow-none"
                tabIndex={-1}
            />
            <TabsContent
                value="day"
                className="!mt-0 hidden h-0 w-0 overflow-hidden border-0 p-0 shadow-none"
                tabIndex={-1}
            />
        </Tabs>
    );
}
