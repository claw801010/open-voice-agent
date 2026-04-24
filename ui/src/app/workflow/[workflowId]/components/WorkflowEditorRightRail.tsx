'use client';

import { ChevronDown, ExternalLink, FlaskConical, Mic, Settings } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { toast } from 'sonner';

import { createQuickPersonaTestSessionApiV1LooptalkTestSessionsQuickPersonaPost } from '@/client/sdk.gen';
import type { FlowNode } from '@/components/flow/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/lib/auth';
import logger from '@/lib/logger';

import type { TrendGranularity } from '@/lib/usageOrgDeepLink';
import type { UsageTrendBucket } from '@/lib/workflow/workflowRunTrends';

import { UsageTrendGranularityTabs } from '@/components/usage/UsageTrendGranularityTabs';

import { SimulationManualChatPanel } from './SimulationManualChatPanel';
import { TemplateVariablesRailPanel } from './TemplateVariablesRailPanel';
import { WorkflowUsageTrendPanel } from './WorkflowUsageTrendPanel';

function nodeInspectorRows(node: FlowNode): { label: string; value: string }[] {
    const d = node.data;
    const rows: { label: string; value: string }[] = [
        { label: 'Type', value: node.type },
        { label: 'Name', value: d.name?.trim() || '—' },
    ];
    if (d.prompt?.trim()) {
        const t = d.prompt.trim();
        rows.push({
            label: 'Prompt',
            value: t.length > 220 ? `${t.slice(0, 220)}…` : t,
        });
    }
    if (d.endpoint_url) {
        const u = d.endpoint_url;
        rows.push({
            label: 'Endpoint',
            value: u.length > 80 ? `${u.slice(0, 80)}…` : u,
        });
    }
    if (d.trigger_path) {
        rows.push({ label: 'Trigger path', value: d.trigger_path });
    }
    if (d.qa_api_key) {
        rows.push({ label: 'QA API key', value: '[set in node editor]' });
    }
    return rows;
}

export type WorkflowEditorRightRailProps = {
    workflowId: number;
    /** WE-01-HEADER: Edit = inspector; Simulation = test-focused rail until WE-01-TEST */
    mode?: 'edit' | 'simulation';
    /** Current editor state for Simulation “raw” panel (already passed through redactForDebugJson in RenderWorkflow). */
    simulationDebugSnapshot?: Record<string, unknown>;
    /** WE-01-RIGHT-INSPECTOR: same source as settings page */
    templateContextVariables?: Record<string, string>;
    saveTemplateContextVariables?: (variables: Record<string, string>) => Promise<void>;
    selectedNode?: FlowNode | null;
    inspectorReadOnly?: boolean;
    /** WE-01-TEST / DX-01-NOCODE: same Web Call path as header (browser mic, no PSTN). */
    onWebTest?: () => void | Promise<void>;
    webTestDisabled?: boolean;
    webTestDisabledReason?: string | null;
    webTestBusy?: boolean;
    /** WE-01-HEADER: weekly usage trend (from RenderWorkflow run fetch) */
    usageTrendBuckets?: UsageTrendBucket[];
    usageTrendLoading?: boolean;
    usageTrendError?: boolean;
    /** Match `/usage` chart: ISO week vs UTC calendar day rollups */
    usageTrendGranularity?: TrendGranularity;
    onUsageTrendGranularityChange?: (g: TrendGranularity) => void;
    usageTrendLookbackWeeks?: number;
    onUsageTrendLookbackWeeksChange?: (weeks: number) => void;
    usageTrendLookbackDays?: number;
    onUsageTrendLookbackDaysChange?: (days: number) => void;
    /** WE-01-ORG-USAGE parity: optional fixed UTC calendar range for Simulation rollup chart */
    usageTrendUsesCustomRange?: boolean;
    usageTrendRangeSinceDraft?: string;
    usageTrendRangeUntilDraft?: string;
    onUsageTrendRangeSinceDraftChange?: (v: string) => void;
    onUsageTrendRangeUntilDraftChange?: (v: string) => void;
    onUsageTrendRangeApply?: () => void;
    onUsageTrendRangeClear?: () => void;
    /** WE-01-ORG-USAGE: match `/usage` exports for the Simulation trend chart */
    usageTrendExportCsv?: boolean;
    usageTrendExportPng?: boolean;
    /** Stem for CSV/PNG filenames (no extension), e.g. `workflow-42-usage-weekly-trend`. */
    usageTrendExportFilenameBase?: string;
};

/**
 * Inspector / simulation rail (WE-01-SHELL, WE-01-HEADER).
 * Full Test Agent parity is tracked under WE-01-TEST.
 */
export function WorkflowEditorRightRail({
    workflowId,
    mode = 'edit',
    simulationDebugSnapshot,
    templateContextVariables = {},
    saveTemplateContextVariables,
    selectedNode = null,
    inspectorReadOnly = false,
    onWebTest,
    webTestDisabled = false,
    webTestDisabledReason = null,
    webTestBusy = false,
    usageTrendBuckets = [],
    usageTrendLoading = false,
    usageTrendError = false,
    usageTrendGranularity = 'week',
    onUsageTrendGranularityChange,
    usageTrendLookbackWeeks = 8,
    onUsageTrendLookbackWeeksChange,
    usageTrendLookbackDays = 30,
    onUsageTrendLookbackDaysChange,
    usageTrendUsesCustomRange = false,
    usageTrendRangeSinceDraft = '',
    usageTrendRangeUntilDraft = '',
    onUsageTrendRangeSinceDraftChange,
    onUsageTrendRangeUntilDraftChange,
    onUsageTrendRangeApply,
    onUsageTrendRangeClear,
    usageTrendExportCsv = false,
    usageTrendExportPng = false,
    usageTrendExportFilenameBase,
}: WorkflowEditorRightRailProps) {
    const router = useRouter();
    const usageTrendGranularityLabelId = useId();
    const { getAccessToken } = useAuth();
    const [loopTalkBusy, setLoopTalkBusy] = useState(false);
    const [rawOpen, setRawOpen] = useState(false);

    const startQuickLoopTalk = async () => {
        setLoopTalkBusy(true);
        try {
            const token = await getAccessToken();
            const res = await createQuickPersonaTestSessionApiV1LooptalkTestSessionsQuickPersonaPost({
                body: {
                    actor_workflow_id: workflowId,
                    name: `Editor · workflow ${workflowId} · LoopTalk`.slice(0, 200),
                },
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            if (res.data?.id) {
                router.push(`/looptalk/${res.data.id}`);
            } else {
                toast.error('Could not create LoopTalk session');
            }
        } catch (e) {
            logger.error(`LoopTalk quick session failed: ${e}`);
            toast.error('LoopTalk session failed — check API and permissions');
        } finally {
            setLoopTalkBusy(false);
        }
    };

    if (mode === 'simulation') {
        return (
            <div className="flex h-full min-h-0 flex-col border-l border-border bg-muted/15">
                <div className="shrink-0 border-b border-border px-3 py-2">
                    <div className="flex items-center gap-2">
                        <FlaskConical className="h-4 w-4 text-teal-500 shrink-0" />
                        <h2 className="text-sm font-semibold">Simulation</h2>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                        Test-focused rail (WE-01-TEST). Costs below are indicative — no billing data in this header.
                        Usage trend supports <strong className="font-medium text-foreground">Week</strong> or{' '}
                        <strong className="font-medium text-foreground">Day</strong> rollups (same URL params as{' '}
                        <code className="rounded bg-muted px-0.5 text-[10px]">/usage</code>) plus{' '}
                        <strong className="font-medium text-foreground">CSV</strong> /{' '}
                        <strong className="font-medium text-foreground">PNG</strong>.
                    </p>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-3 space-y-4 text-sm">
                    {onWebTest ? (
                        <section className="rounded-md border border-teal-500/25 bg-teal-500/5 p-3 space-y-2">
                            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Web test (browser)
                            </h3>
                            <p className="text-xs text-muted-foreground leading-snug">
                                Same as <strong className="text-foreground">Call → Web Call</strong> in the header. Uses
                                your mic; no telephony charges (LLM/STT/TTS usage still applies).
                            </p>
                            {webTestDisabled && webTestDisabledReason ? (
                                <TooltipProvider delayDuration={300}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <span className="block w-full">
                                                <Button
                                                    type="button"
                                                    variant="default"
                                                    size="sm"
                                                    className="w-full gap-2 bg-teal-600 hover:bg-teal-700"
                                                    disabled
                                                >
                                                    <Mic className="h-4 w-4 shrink-0" aria-hidden />
                                                    Start Web test
                                                </Button>
                                            </span>
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom" className="max-w-xs text-xs">
                                            {webTestDisabledReason}
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            ) : (
                                <Button
                                    type="button"
                                    variant="default"
                                    size="sm"
                                    className="w-full gap-2 bg-teal-600 hover:bg-teal-700"
                                    disabled={webTestDisabled || webTestBusy}
                                    onClick={() => void onWebTest()}
                                >
                                    <Mic className="h-4 w-4 shrink-0" aria-hidden />
                                    {webTestBusy ? 'Starting…' : 'Start Web test'}
                                </Button>
                            )}
                        </section>
                    ) : null}
                    {onUsageTrendGranularityChange ? (
                        <UsageTrendGranularityTabs
                            value={usageTrendGranularity}
                            onValueChange={onUsageTrendGranularityChange}
                            label="Trend"
                            labelId={usageTrendGranularityLabelId}
                            variant="compact"
                        />
                    ) : null}
                    {onUsageTrendRangeApply &&
                    onUsageTrendRangeClear &&
                    onUsageTrendRangeSinceDraftChange &&
                    onUsageTrendRangeUntilDraftChange ? (
                        <fieldset className="rounded-md border border-border bg-background/50 p-3 space-y-2">
                            <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Usage trend range (UTC)
                            </legend>
                            <p className="text-[11px] text-muted-foreground leading-snug">
                                Optional fixed dates for the chart below — same query params as{' '}
                                <code className="rounded bg-muted px-0.5">/usage</code> (
                                <code className="rounded bg-muted px-0.5">trendSince</code> /{' '}
                                <code className="rounded bg-muted px-0.5">trendUntil</code>).
                            </p>
                            <div className="flex flex-wrap items-end gap-2">
                                <div className="space-y-1">
                                    <Label htmlFor="sim-usage-trend-since" className="text-[10px] text-muted-foreground">
                                        From
                                    </Label>
                                    <Input
                                        id="sim-usage-trend-since"
                                        type="date"
                                        className="h-8 w-[140px] text-xs"
                                        value={usageTrendRangeSinceDraft}
                                        onChange={(e) => onUsageTrendRangeSinceDraftChange(e.target.value)}
                                        aria-label="UTC trend range start"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="sim-usage-trend-until" className="text-[10px] text-muted-foreground">
                                        To
                                    </Label>
                                    <Input
                                        id="sim-usage-trend-until"
                                        type="date"
                                        className="h-8 w-[140px] text-xs"
                                        value={usageTrendRangeUntilDraft}
                                        onChange={(e) => onUsageTrendRangeUntilDraftChange(e.target.value)}
                                        aria-label="UTC trend range end"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-2 pt-1">
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="secondary"
                                    className="h-8 text-xs"
                                    onClick={onUsageTrendRangeApply}
                                >
                                    Apply range
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 text-xs"
                                    onClick={onUsageTrendRangeClear}
                                    disabled={!usageTrendUsesCustomRange}
                                >
                                    Clear
                                </Button>
                            </div>
                        </fieldset>
                    ) : null}
                    <WorkflowUsageTrendPanel
                        loading={usageTrendLoading}
                        error={usageTrendError}
                        buckets={usageTrendBuckets}
                        bucketUnit={usageTrendGranularity === 'day' ? 'day' : 'week'}
                        variant="compact"
                        lookbackWeeks={usageTrendLookbackWeeks}
                        onLookbackWeeksChange={
                            usageTrendGranularity === 'week' && !usageTrendUsesCustomRange
                                ? onUsageTrendLookbackWeeksChange
                                : undefined
                        }
                        lookbackDays={usageTrendLookbackDays}
                        onLookbackDaysChange={
                            usageTrendGranularity === 'day' && !usageTrendUsesCustomRange
                                ? onUsageTrendLookbackDaysChange
                                : undefined
                        }
                        lookbackSelectorDisabled={usageTrendUsesCustomRange}
                        description={
                            usageTrendUsesCustomRange
                                ? usageTrendGranularity === 'day'
                                    ? 'UTC calendar days in range; lookback disabled while a custom range is set. Runs stacked inbound vs outbound.'
                                    : 'UTC weeks in range; lookback disabled while a custom range is set. Runs stacked inbound vs outbound.'
                                : undefined
                        }
                        showExportCsv={usageTrendExportCsv}
                        showExportPng={usageTrendExportPng}
                        exportCsvFilenameBase={
                            usageTrendExportFilenameBase ??
                            `workflow-${workflowId}-usage-${usageTrendGranularity === 'day' ? 'daily' : 'weekly'}-trend`
                        }
                    />
                    <section className="rounded-md border border-border bg-background/50 p-3 space-y-2">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Expected charges
                        </h3>
                        <ul className="list-disc pl-4 space-y-1 text-xs text-muted-foreground">
                            <li>
                                <strong className="text-foreground">Web Call</strong> — LLM + STT + TTS usage only;{' '}
                                <span className="text-foreground">no PSTN</span> / telephony charges for this path.
                            </li>
                            <li>
                                <strong className="text-foreground">Phone Call</strong> — may incur{' '}
                                <span className="text-foreground">telephony</span> and carrier usage in addition to model
                                time.
                            </li>
                            <li>
                                <strong className="text-foreground">LoopTalk (quick persona)</strong> — two agents over
                                internal audio; <span className="text-foreground">no PSTN</span>; LLM usage for both
                                sides.
                            </li>
                        </ul>
                    </section>
                    <SimulationManualChatPanel workflowId={workflowId} />
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="w-full"
                        disabled={loopTalkBusy}
                        onClick={startQuickLoopTalk}
                    >
                        {loopTalkBusy ? 'Creating session…' : 'LoopTalk: simulated caller vs this workflow'}
                    </Button>
                    {simulationDebugSnapshot ? (
                        <Collapsible open={rawOpen} onOpenChange={setRawOpen}>
                            <CollapsibleTrigger asChild>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="w-full justify-between gap-2 font-normal"
                                    aria-expanded={rawOpen}
                                >
                                    <span className="text-left text-xs font-medium">Raw debug (redacted)</span>
                                    <ChevronDown
                                        className={`h-4 w-4 shrink-0 transition-transform ${rawOpen ? 'rotate-180' : ''}`}
                                        aria-hidden
                                    />
                                </Button>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                                <div className="mt-2 rounded-md border border-border bg-muted/40 p-2">
                                    <p className="text-[10px] text-muted-foreground mb-2 leading-snug">
                                        In-memory draft: node data, template variables, and workflow_configurations. Keys
                                        matching common secret patterns are replaced with &quot;[REDACTED]&quot; — not a
                                        security guarantee.
                                    </p>
                                    <pre className="max-h-[min(320px,40vh)] overflow-auto text-[10px] leading-snug whitespace-pre-wrap break-all font-mono text-foreground">
                                        {JSON.stringify(simulationDebugSnapshot, null, 2)}
                                    </pre>
                                </div>
                            </CollapsibleContent>
                        </Collapsible>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                        Voice paths: <strong className="text-foreground">Web test</strong> and{' '}
                        <strong className="text-foreground">LoopTalk</strong>. Text path: <strong className="text-foreground">Manual chat</strong> above
                        (draft graph + user LLM).
                    </p>
                    <Button variant="outline" size="sm" className="w-full justify-start gap-2" asChild>
                        <Link href={`/workflow/${workflowId}/settings?section=general`}>
                            <Settings className="h-4 w-4 shrink-0" />
                            Full workflow settings
                        </Link>
                    </Button>
                    <a
                        href="https://docs.dograh.com/voice-agent/introduction"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
                    >
                        <ExternalLink className="w-3 h-3 shrink-0" />
                        Voice agent docs
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-full min-h-0 flex-col border-l border-border bg-muted/15">
            <div className="shrink-0 border-b border-border px-3 py-2">
                <h2 className="text-sm font-semibold">Right rail</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                    Inspector + global template variables (WE-01-RIGHT-INSPECTOR).
                </p>
            </div>
            <Tabs defaultValue="inspector" className="flex min-h-0 flex-1 flex-col">
                <TabsList className="mx-3 mt-2 grid w-auto shrink-0 grid-cols-2">
                    <TabsTrigger value="inspector" className="text-xs">
                        Inspector
                    </TabsTrigger>
                    <TabsTrigger value="global" className="text-xs">
                        Global
                    </TabsTrigger>
                </TabsList>
                <TabsContent
                    value="inspector"
                    className="min-h-0 flex-1 overflow-y-auto mt-0 data-[state=inactive]:hidden px-3 pb-3 pt-3"
                >
                    {selectedNode ? (
                        <div className="space-y-2">
                            <p className="text-[11px] text-muted-foreground leading-snug">
                                Summary of the selected node. Double-click the node on the canvas for the full editor.
                            </p>
                            <dl className="space-y-2 rounded-md border border-border bg-background/50 p-2 text-[11px]">
                                {nodeInspectorRows(selectedNode).map((row) => (
                                    <div key={row.label}>
                                        <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                            {row.label}
                                        </dt>
                                        <dd className="whitespace-pre-wrap break-words text-foreground mt-0.5">{row.value}</dd>
                                    </div>
                                ))}
                            </dl>
                        </div>
                    ) : (
                        <p className="text-xs text-muted-foreground">
                            Select a single node on the canvas to see its type and a short summary here.
                        </p>
                    )}
                    <Button variant="outline" size="sm" className="w-full justify-start gap-2 mt-4" asChild>
                        <Link href={`/workflow/${workflowId}/settings?section=models`}>
                            <Settings className="h-4 w-4 shrink-0" />
                            Model overrides &amp; more in settings
                        </Link>
                    </Button>
                </TabsContent>
                <TabsContent
                    value="global"
                    className="min-h-0 flex-1 overflow-y-auto mt-0 data-[state=inactive]:hidden px-3 pb-3 pt-3"
                >
                    {saveTemplateContextVariables ? (
                        <TemplateVariablesRailPanel
                            templateContextVariables={templateContextVariables}
                            onSave={saveTemplateContextVariables}
                            readOnly={inspectorReadOnly}
                        />
                    ) : (
                        <p className="text-xs text-muted-foreground">Template variables unavailable.</p>
                    )}
                    <Button variant="outline" size="sm" className="w-full justify-start gap-2 mt-4" asChild>
                        <Link href={`/workflow/${workflowId}/settings?section=variables`}>
                            <Settings className="h-4 w-4 shrink-0" />
                            Open full settings (variables)
                        </Link>
                    </Button>
                </TabsContent>
            </Tabs>
            <div className="shrink-0 border-t border-border px-3 py-2">
                <a
                    href="https://docs.dograh.com/voice-agent/introduction"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
                >
                    <ExternalLink className="w-3 h-3 shrink-0" />
                    Voice agent docs
                </a>
            </div>
        </div>
    );
}
