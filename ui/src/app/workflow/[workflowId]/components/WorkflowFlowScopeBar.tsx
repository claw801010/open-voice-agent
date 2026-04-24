'use client';

import { Layers, Workflow } from 'lucide-react';

import { cn } from '@/lib/utils';

import { COMPONENT_SCOPE_ENTRIES } from '../workflowScope';

export interface WorkflowFlowScopeBarProps {
    activeScope: 'main' | string;
    onScopeChange: (scope: 'main' | string) => void;
    /** When true, scope switching is blocked (e.g. historical version or installation locked). */
    disabled?: boolean;
    /** Subgraph tabs (keys → `subflows` in saved JSON). Defaults to two components. */
    componentScopes?: readonly { key: string; label: string }[];
}

/** WE-01-SUBFLOWS: switch between the primary graph and named component subgraphs. */
export function WorkflowFlowScopeBar({
    activeScope,
    onScopeChange,
    disabled = false,
    componentScopes = COMPONENT_SCOPE_ENTRIES,
}: WorkflowFlowScopeBarProps) {
    const tabClass = (selected: boolean) =>
        cn(
            'inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium shadow-sm transition-colors',
            selected
                ? 'border-border bg-background text-foreground'
                : 'border-transparent bg-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground',
        );

    return (
        <div
            className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-muted/30 px-3 py-1.5"
            role="tablist"
            aria-label="Flow scope"
        >
            <button
                type="button"
                role="tab"
                aria-selected={activeScope === 'main'}
                disabled={disabled}
                className={tabClass(activeScope === 'main')}
                onClick={() => !disabled && onScopeChange('main')}
            >
                <Workflow className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                Main flow
            </button>
            {componentScopes.map(({ key, label }) => (
                <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={activeScope === key}
                    disabled={disabled}
                    className={tabClass(activeScope === key)}
                    onClick={() => !disabled && onScopeChange(key)}
                >
                    <Layers className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    {label}
                </button>
            ))}
        </div>
    );
}
