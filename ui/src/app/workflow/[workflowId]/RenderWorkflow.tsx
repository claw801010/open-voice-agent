import '@xyflow/react/dist/style.css';

import {
    Background,
    BackgroundVariant,
    Panel,
    ReactFlow,
} from "@xyflow/react";
import { BrushCleaning, LayoutTemplate, Maximize2, Minus, Plus, Settings } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import posthog from 'posthog-js';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import {
    createWorkflowDraftApiV1WorkflowWorkflowIdCreateDraftPost,
    getVerticalPacksCatalogApiV1CatalogVerticalPacksGet,
    getWorkflowApiV1WorkflowFetchWorkflowIdGet,
    getWorkflowRunsApiV1WorkflowWorkflowIdRunsGet,
    getWorkflowVersionsApiV1WorkflowWorkflowIdVersionsGet,
    listDocumentsApiV1KnowledgeBaseDocumentsGet,
    listRecordingsApiV1WorkflowRecordingsGet,
    listToolsApiV1ToolsGet,
    updateWorkflowApiV1WorkflowWorkflowIdPut,
} from '@/client';
import {
    getWorkflowDailyUsageRollupApiV1WorkflowWorkflowIdUsageDailyRollupGet,
    getWorkflowWeeklyUsageRollupApiV1WorkflowWorkflowIdUsageWeeklyRollupGet,
} from '@/client/sdk.gen';
import type { DocumentResponseSchema, RecordingResponseSchema, ToolResponse } from '@/client/types.gen';
import { FlowEdge, FlowNode, NodeType, type WorkflowDefinition } from "@/components/flow/types";
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { PostHogEvent } from '@/constants/posthog-events';
import { WORKFLOW_RUN_MODES } from '@/constants/workflowRunModes';
import { useUnsavedChanges } from '@/context/UnsavedChangesContext';
import logger from '@/lib/logger';
import { formatMainDraftGraphStats, formatSubflowInventory } from '@/lib/workflow/draftGraphStats';
import { templateSourceFromMk01 } from '@/lib/workflow/headerMetadata';
import { costDryRunTooltip, fetchWorkflowCostDryRun, formatCostDryRunHint } from '@/lib/workflow/workflowCostDryRun';
import { computeRunUsageHints } from '@/lib/workflow/recentRunUsage';
import type { UsageTrendBucket } from '@/lib/workflow/workflowRunTrends';
import {
    aggregateRunsByDay,
    aggregateRunsByWeek,
    dailyRollupApiToUsageTrendBuckets,
    filterRunsForTrendUtcInclusiveYmdRange,
    formatUsageTrendHint,
    USAGE_TREND_LOOKBACK_DAY_OPTIONS,
    USAGE_TREND_LOOKBACK_WEEK_OPTIONS,
    weeklyRollupApiToUsageTrendBuckets,
} from '@/lib/workflow/workflowRunTrends';
import { redactForDebugJson } from '@/lib/workflow/redactForDebugJson';
import {
    parseTrendDateRangeFromSearchParams,
    parseTrendDaysFromSearchParams,
    parseTrendGranularityFromSearchParams,
    parseTrendWeeksFromSearchParams,
    TREND_DAYS_PARAM,
    TREND_GRANULARITY_PARAM,
    TREND_SINCE_PARAM,
    TREND_UNTIL_PARAM,
    type TrendGranularity,
    validateUtcInclusiveTrendRange,
} from '@/lib/usageOrgDeepLink';
import { WorkflowConfigurations } from '@/types/workflow-configurations';

import AddNodePanel from "../../../components/flow/AddNodePanel";
import CustomEdge from "../../../components/flow/edges/CustomEdge";
import { AgentNode, EndCall, GlobalNode, QANode, StartCall, TriggerNode, WebhookNode } from "../../../components/flow/nodes";
import { PhoneCallDialog } from './components/PhoneCallDialog';
import { VersionHistoryPanel, WorkflowVersion } from './components/VersionHistoryPanel';
import { WorkflowFlowScopeBar } from './components/WorkflowFlowScopeBar';
import { WorkflowEditorHeader } from "./components/WorkflowEditorHeader";
import { WorkflowEditorRightRail } from './components/WorkflowEditorRightRail';
import { WorkflowEditorShell } from './components/WorkflowEditorShell';
import { WorkflowProvider } from "./contexts/WorkflowContext";
import { useWorkflowStore } from './stores/workflowStore';
import { useWorkflowState } from "./hooks/useWorkflowState";
import { layoutNodes } from './utils/layoutNodes';

// Define the node types dynamically based on the onSave prop
const nodeTypes = {
    [NodeType.START_CALL]: StartCall,
    [NodeType.AGENT_NODE]: AgentNode,
    [NodeType.END_CALL]: EndCall,
    [NodeType.GLOBAL_NODE]: GlobalNode,
    [NodeType.TRIGGER]: TriggerNode,
    [NodeType.WEBHOOK]: WebhookNode,
    [NodeType.QA]: QANode,
};

const edgeTypes = {
    custom: CustomEdge,
};

interface RenderWorkflowProps {
    initialWorkflowName: string;
    workflowId: number;
    initialFlow?: {
        nodes: FlowNode[];
        edges: FlowEdge[];
        viewport: {
            x: number;
            y: number;
            zoom: number;
        };
        subflows?: WorkflowDefinition['subflows'];
    };
    initialTemplateContextVariables?: Record<string, string>;
    initialWorkflowConfigurations?: WorkflowConfigurations;
    initialVersionNumber?: number | null;
    initialVersionStatus?: string | null;
    user: { id: string; email?: string };
}

function RenderWorkflow({ initialWorkflowName, workflowId, initialFlow, initialTemplateContextVariables, initialWorkflowConfigurations, initialVersionNumber, initialVersionStatus, user }: RenderWorkflowProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [isPhoneCallDialogOpen, setIsPhoneCallDialogOpen] = useState(false);
    const [isVersionPanelOpen, setIsVersionPanelOpen] = useState(false);
    const [versions, setVersions] = useState<WorkflowVersion[]>([]);
    const [versionsLoading, setVersionsLoading] = useState(false);
    const [activeVersionId, setActiveVersionId] = useState<number | null>(null);
    // Version info that updates immediately from the GET/save/publish responses.
    const [currentVersionNumber, setCurrentVersionNumber] = useState<number | null>(initialVersionNumber ?? null);
    const [currentVersionStatus, setCurrentVersionStatus] = useState<string | null>(initialVersionStatus ?? null);
    const versionsFetched = useRef(false);
    const [documents, setDocuments] = useState<DocumentResponseSchema[] | undefined>(undefined);
    const [tools, setTools] = useState<ToolResponse[] | undefined>(undefined);
    const [recordings, setRecordings] = useState<RecordingResponseSchema[]>([]);
    const [installationLocked, setInstallationLocked] = useState(() =>
        Boolean((initialWorkflowConfigurations as WorkflowConfigurations | undefined)?.mk01?.installation_locked),
    );
    const [editorMode, setEditorMode] = useState<'edit' | 'simulation'>('edit');
    const [catalogPackMeta, setCatalogPackMeta] = useState<{
        display_name?: string;
        cost_latency_estimate_band?: string;
    } | null>(null);
    const [webTestBusy, setWebTestBusy] = useState(false);
    const [recentRunUsageHint, setRecentRunUsageHint] = useState<string | null>(null);
    const [recentRunAggregateHint, setRecentRunAggregateHint] = useState<string | null>(null);
    const [usageTrendBuckets, setUsageTrendBuckets] = useState<UsageTrendBucket[]>([]);
    const [usageTrendHint, setUsageTrendHint] = useState<string | null>(null);

    const usageTrendLookbackStorageKey = `usageTrendLookback:${workflowId}`;
    const usageTrendLookbackDaysStorageKey = `usageTrendLookbackDays:${workflowId}`;
    const usageTrendRangeStorageKey = `usageTrendRange:${workflowId}`;
    const [sessionWeeks, setSessionWeeks] = useState<number | null>(null);
    const [sessionDays, setSessionDays] = useState<number | null>(null);
    const [sessionRange, setSessionRange] = useState<{ since: string; until: string } | null>(null);
    const [usageTrendRangeSinceDraft, setUsageTrendRangeSinceDraft] = useState('');
    const [usageTrendRangeUntilDraft, setUsageTrendRangeUntilDraft] = useState('');

    useEffect(() => {
        try {
            const wRaw = sessionStorage.getItem(usageTrendLookbackStorageKey);
            if (wRaw) {
                const n = parseInt(wRaw, 10);
                if (Number.isFinite(n) && USAGE_TREND_LOOKBACK_WEEK_OPTIONS.some((w) => w === n)) {
                    setSessionWeeks(n);
                }
            }
        } catch {
            /* ignore */
        }
        try {
            const dRaw = sessionStorage.getItem(usageTrendLookbackDaysStorageKey);
            if (dRaw) {
                const n = parseInt(dRaw, 10);
                if (Number.isFinite(n) && USAGE_TREND_LOOKBACK_DAY_OPTIONS.some((d) => d === n)) {
                    setSessionDays(n);
                }
            }
        } catch {
            /* ignore */
        }
        try {
            const rRaw = sessionStorage.getItem(usageTrendRangeStorageKey);
            if (rRaw) {
                const j = JSON.parse(rRaw) as { since?: string; until?: string };
                if (
                    j?.since &&
                    j?.until &&
                    validateUtcInclusiveTrendRange(j.since, j.until) === null
                ) {
                    setSessionRange({ since: j.since, until: j.until });
                }
            }
        } catch {
            /* ignore */
        }
    }, [usageTrendLookbackStorageKey, usageTrendLookbackDaysStorageKey, usageTrendRangeStorageKey]);

    const urlTrendRange = useMemo(
        () => parseTrendDateRangeFromSearchParams(searchParams),
        [searchParams],
    );
    const effectiveUsageTrendRange = useMemo(() => {
        if (urlTrendRange.since && urlTrendRange.until) {
            return { since: urlTrendRange.since, until: urlTrendRange.until };
        }
        return sessionRange;
    }, [urlTrendRange.since, urlTrendRange.until, sessionRange]);

    const usageTrendLookbackWeeks = useMemo(() => {
        const weeksFromUrl = parseTrendWeeksFromSearchParams(searchParams);
        const hasExplicitTrendWeeks = searchParams.get('trendWeeks') != null;
        if (effectiveUsageTrendRange != null) {
            return weeksFromUrl;
        }
        if (hasExplicitTrendWeeks) {
            return weeksFromUrl;
        }
        return sessionWeeks ?? weeksFromUrl;
    }, [searchParams, effectiveUsageTrendRange, sessionWeeks]);

    const usageTrendGranularity = useMemo(
        () => parseTrendGranularityFromSearchParams(searchParams),
        [searchParams],
    );

    const usageTrendLookbackDays = useMemo(() => {
        const daysFromUrl = parseTrendDaysFromSearchParams(searchParams);
        const hasExplicitTrendDays = searchParams.get(TREND_DAYS_PARAM) != null;
        if (effectiveUsageTrendRange != null) {
            return daysFromUrl;
        }
        if (hasExplicitTrendDays) {
            return daysFromUrl;
        }
        return sessionDays ?? daysFromUrl;
    }, [searchParams, effectiveUsageTrendRange, sessionDays]);

    const usageTrendUsesCustomRange = effectiveUsageTrendRange != null;

    useEffect(() => {
        const dr = parseTrendDateRangeFromSearchParams(searchParams);
        if (dr.since && dr.until) {
            setUsageTrendRangeSinceDraft(dr.since);
            setUsageTrendRangeUntilDraft(dr.until);
        } else if (sessionRange) {
            setUsageTrendRangeSinceDraft(sessionRange.since);
            setUsageTrendRangeUntilDraft(sessionRange.until);
        } else {
            setUsageTrendRangeSinceDraft('');
            setUsageTrendRangeUntilDraft('');
        }
    }, [searchParams, sessionRange]);

    useEffect(() => {
        if (!effectiveUsageTrendRange) {
            try {
                sessionStorage.removeItem(usageTrendRangeStorageKey);
            } catch {
                /* ignore */
            }
            return;
        }
        try {
            sessionStorage.setItem(
                usageTrendRangeStorageKey,
                JSON.stringify(effectiveUsageTrendRange),
            );
        } catch {
            /* ignore */
        }
    }, [effectiveUsageTrendRange, usageTrendRangeStorageKey]);

    const handleUsageTrendLookbackWeeksChange = useCallback(
        (weeks: number) => {
            setSessionRange(null);
            try {
                sessionStorage.removeItem(usageTrendRangeStorageKey);
            } catch {
                /* ignore */
            }
            setSessionWeeks(weeks);
            try {
                sessionStorage.setItem(usageTrendLookbackStorageKey, String(weeks));
            } catch {
                /* ignore */
            }
            const p = new URLSearchParams(searchParams.toString());
            p.delete(TREND_SINCE_PARAM);
            p.delete(TREND_UNTIL_PARAM);
            p.delete(TREND_GRANULARITY_PARAM);
            p.delete(TREND_DAYS_PARAM);
            if (weeks === 8) {
                p.delete('trendWeeks');
            } else {
                p.set('trendWeeks', String(weeks));
            }
            const q = p.toString();
            router.replace(q ? `${pathname}?${q}` : pathname);
        },
        [pathname, router, searchParams, usageTrendLookbackStorageKey, usageTrendRangeStorageKey],
    );

    const handleUsageTrendLookbackDaysChange = useCallback(
        (days: number) => {
            setSessionRange(null);
            try {
                sessionStorage.removeItem(usageTrendRangeStorageKey);
            } catch {
                /* ignore */
            }
            setSessionDays(days);
            try {
                sessionStorage.setItem(usageTrendLookbackDaysStorageKey, String(days));
            } catch {
                /* ignore */
            }
            const p = new URLSearchParams(searchParams.toString());
            p.delete(TREND_SINCE_PARAM);
            p.delete(TREND_UNTIL_PARAM);
            p.delete('trendWeeks');
            p.set(TREND_GRANULARITY_PARAM, 'day');
            if (days === 30) {
                p.delete(TREND_DAYS_PARAM);
            } else {
                p.set(TREND_DAYS_PARAM, String(days));
            }
            const q = p.toString();
            router.replace(q ? `${pathname}?${q}` : pathname);
        },
        [pathname, router, searchParams, usageTrendLookbackDaysStorageKey, usageTrendRangeStorageKey],
    );

    const handleUsageTrendGranularityChange = useCallback(
        (g: TrendGranularity) => {
            setSessionRange(null);
            try {
                sessionStorage.removeItem(usageTrendRangeStorageKey);
            } catch {
                /* ignore */
            }
            const p = new URLSearchParams(searchParams.toString());
            p.delete(TREND_SINCE_PARAM);
            p.delete(TREND_UNTIL_PARAM);
            if (g === 'day') {
                try {
                    sessionStorage.removeItem(usageTrendLookbackStorageKey);
                } catch {
                    /* ignore */
                }
                setSessionWeeks(null);
                p.delete('trendWeeks');
                p.set(TREND_GRANULARITY_PARAM, 'day');
                p.delete(TREND_DAYS_PARAM);
            } else {
                try {
                    sessionStorage.removeItem(usageTrendLookbackDaysStorageKey);
                } catch {
                    /* ignore */
                }
                setSessionDays(null);
                p.delete(TREND_GRANULARITY_PARAM);
                p.delete(TREND_DAYS_PARAM);
                p.delete('trendWeeks');
            }
            const q = p.toString();
            router.replace(q ? `${pathname}?${q}` : pathname);
        },
        [pathname, router, searchParams, usageTrendLookbackDaysStorageKey, usageTrendLookbackStorageKey, usageTrendRangeStorageKey],
    );

    const handleApplyUsageTrendRange = useCallback(() => {
        const err = validateUtcInclusiveTrendRange(usageTrendRangeSinceDraft, usageTrendRangeUntilDraft);
        if (err) {
            toast.error(err);
            return;
        }
        const next = { since: usageTrendRangeSinceDraft, until: usageTrendRangeUntilDraft };
        setSessionRange(next);
        try {
            sessionStorage.setItem(usageTrendRangeStorageKey, JSON.stringify(next));
        } catch {
            /* ignore */
        }
        const p = new URLSearchParams(searchParams.toString());
        p.set(TREND_SINCE_PARAM, next.since);
        p.set(TREND_UNTIL_PARAM, next.until);
        p.delete('trendWeeks');
        const g = parseTrendGranularityFromSearchParams(searchParams);
        if (g === 'day') {
            p.set(TREND_GRANULARITY_PARAM, 'day');
        } else {
            p.delete(TREND_GRANULARITY_PARAM);
            p.delete(TREND_DAYS_PARAM);
        }
        router.replace(`${pathname}?${p.toString()}`);
    }, [
        pathname,
        router,
        searchParams,
        usageTrendRangeSinceDraft,
        usageTrendRangeUntilDraft,
        usageTrendRangeStorageKey,
    ]);

    const handleClearUsageTrendRange = useCallback(() => {
        setSessionRange(null);
        try {
            sessionStorage.removeItem(usageTrendRangeStorageKey);
        } catch {
            /* ignore */
        }
        const p = new URLSearchParams(searchParams.toString());
        p.delete(TREND_SINCE_PARAM);
        p.delete(TREND_UNTIL_PARAM);
        const q = p.toString();
        router.replace(q ? `${pathname}?${q}` : pathname);
    }, [pathname, router, searchParams, usageTrendRangeStorageKey]);
    const [runsUsageLoading, setRunsUsageLoading] = useState(false);
    const [runsUsageError, setRunsUsageError] = useState(false);
    const [costDryRunHint, setCostDryRunHint] = useState<string | null>(null);
    const [costDryRunDetail, setCostDryRunDetail] = useState<string | null>(null);

    const {
        rfInstance,
        nodes,
        edges,
        workflowName,
        isDirty,
        workflowValidationErrors,
        templateContextVariables,
        workflowConfigurations,
        saveTemplateContextVariables,
        setNodes,
        setEdges,
        setIsDirty,
        handleNodeSelect,
        saveWorkflow,
        onConnect,
        onEdgesChange,
        onNodesChange,
        onRun,
    } = useWorkflowState({
        initialWorkflowName,
        workflowId,
        initialFlow,
        initialTemplateContextVariables,
        initialWorkflowConfigurations,
        user,
    });

    const activeFlowScope = useWorkflowStore((s) => s.activeFlowScope);
    const mainSnapshot = useWorkflowStore((s) => s.mainSnapshot);
    const subflowsFromStore = useWorkflowStore((s) => s.subflows);
    const pendingViewport = useWorkflowStore((s) => s.pendingViewport);
    const clearPendingViewport = useWorkflowStore((s) => s.clearPendingViewport);
    const hydrateVersionGraph = useWorkflowStore((s) => s.hydrateVersionGraph);
    const setActiveFlowScope = useWorkflowStore((s) => s.setActiveFlowScope);

    useEffect(() => {
        if (!pendingViewport) return;
        const raf = requestAnimationFrame(() => {
            rfInstance.current?.setViewport(pendingViewport);
            clearPendingViewport();
        });
        return () => cancelAnimationFrame(raf);
    }, [pendingViewport, clearPendingViewport]);

    const handleFlowScopeChange = useCallback(
        (scope: 'main' | string) => {
            if (!rfInstance.current) return;
            setActiveFlowScope(scope, rfInstance.current.getViewport());
        },
        [setActiveFlowScope],
    );

    const flowNodesForHeader = useMemo(() => {
        if (activeFlowScope === 'main') return nodes;
        if (mainSnapshot) return mainSnapshot.nodes;
        return nodes;
    }, [activeFlowScope, mainSnapshot, nodes]);

    const draftGraphStatsHint = useMemo(() => {
        if (activeFlowScope !== 'main' && !mainSnapshot) return null;
        const mainNodes = activeFlowScope === 'main' ? nodes : mainSnapshot!.nodes;
        const mainEdges = activeFlowScope === 'main' ? edges : mainSnapshot!.edges;
        return formatMainDraftGraphStats(mainNodes, mainEdges);
    }, [activeFlowScope, mainSnapshot, nodes, edges]);

    const subflowInventoryHint = useMemo(
        () => formatSubflowInventory(subflowsFromStore),
        [subflowsFromStore],
    );

    // Derive hasDraft from the current version status
    const hasDraft = currentVersionStatus === "draft";

    // Fetch workflow versions, optionally forcing a refresh
    const fetchVersions = useCallback(async (force = false) => {
        if (versionsFetched.current && !force) return;
        setVersionsLoading(true);
        try {
            const response = await getWorkflowVersionsApiV1WorkflowWorkflowIdVersionsGet({
                path: { workflow_id: workflowId },
            });
            const data = response.data as WorkflowVersion[] | undefined;
            if (data) {
                setVersions(data);
                // Set active version to draft if exists, else published
                const current = data.find((v) => v.status === "draft") ?? data.find((v) => v.status === "published");
                if (current) {
                    setActiveVersionId(current.id);
                    setCurrentVersionNumber(current.version_number);
                    setCurrentVersionStatus(current.status);
                }
            }
            versionsFetched.current = true;
        } finally {
            setVersionsLoading(false);
        }
    }, [workflowId]);

    const handleOpenVersionPanel = useCallback(() => {
        setIsVersionPanelOpen(true);
        fetchVersions();
    }, [fetchVersions]);

    const handleSelectVersion = useCallback((version: WorkflowVersion) => {
        setActiveVersionId(version.id);
        const wfJson = version.workflow_json as WorkflowDefinition;
        const flowNodes = (wfJson.nodes ?? []) as FlowNode[];
        const flowEdges = (wfJson.edges ?? []) as FlowEdge[];

        // Update the Zustand store directly instead of rfInstance.current.setNodes().
        // This keeps data flow unidirectional (store → props → ReactFlow) and avoids
        // xyflow's d3 event handlers interfering with React's event delegation.
        // The key={activeVersionId} on <ReactFlow> forces a clean remount.
        hydrateVersionGraph(flowNodes, flowEdges, wfJson.subflows ?? {});
        // Never mark dirty when switching versions — historical versions are
        // read-only, and loading the draft is restoring the saved state.
        setIsDirty(false);
        setIsVersionPanelOpen(false);
    }, [hydrateVersionGraph, setIsDirty]);

    // Determine if we are viewing a historical (non-current) version.
    // The "current" version is the draft if one exists, otherwise the published version.
    // Anything else (archived, or published while a draft exists) is historical.
    const isViewingHistoricalVersion = useMemo(() => {
        if (!activeVersionId || versions.length === 0) return false;
        const activeVersion = versions.find((v) => v.id === activeVersionId);
        if (!activeVersion) return false;
        if (activeVersion.status === "draft") return false;
        if (activeVersion.status === "published" && !hasDraft) return false;
        return true;
    }, [activeVersionId, versions, hasDraft]);

    const graphLocked = isViewingHistoricalVersion || installationLocked;

    /** WE-01-DUALMODE: tab close / link / back guards when the graph has unsaved edits (not read-only). */
    const canvasHasUnsavedChanges = isDirty && !graphLocked;
    useUnsavedChanges('workflow-canvas', canvasHasUnsavedChanges);

    const catalogSlug = (initialWorkflowConfigurations as WorkflowConfigurations | undefined)?.mk01?.catalog_slug;

    useEffect(() => {
        if (isViewingHistoricalVersion) {
            setEditorMode('edit');
        }
    }, [isViewingHistoricalVersion]);

    useEffect(() => {
        if (!catalogSlug) {
            setCatalogPackMeta(null);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const res = await getVerticalPacksCatalogApiV1CatalogVerticalPacksGet({});
                const data = res.data as {
                    packs?: { slug: string; display_name: string; cost_latency_estimate_band?: string }[];
                };
                const pack = data?.packs?.find((p) => p.slug === catalogSlug);
                if (!cancelled && pack) {
                    setCatalogPackMeta({
                        display_name: pack.display_name,
                        cost_latency_estimate_band: pack.cost_latency_estimate_band,
                    });
                }
            } catch {
                if (!cancelled) {
                    setCatalogPackMeta(null);
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [catalogSlug]);

    const templateSourceLabel = useMemo(() => {
        const mk = (initialWorkflowConfigurations as WorkflowConfigurations | undefined)?.mk01;
        if (!mk) {
            return null;
        }
        if (mk.catalog_slug && catalogPackMeta?.display_name) {
            return `From catalog · ${catalogPackMeta.display_name}`;
        }
        return templateSourceFromMk01(mk);
    }, [initialWorkflowConfigurations, catalogPackMeta]);

    const costLatencyHint = useMemo(() => {
        const mk = (initialWorkflowConfigurations as WorkflowConfigurations | undefined)?.mk01;
        if (!mk?.catalog_slug) {
            return null;
        }
        return catalogPackMeta?.cost_latency_estimate_band ?? null;
    }, [initialWorkflowConfigurations, catalogPackMeta]);

    const hasPublishedVersion = useMemo(
        () => versions.some((v) => v.status === 'published'),
        [versions],
    );

    const toolNamesByUuid = useMemo(() => {
        const m = new Map<string, string>();
        for (const t of tools ?? []) {
            if (t.tool_uuid && t.name) {
                m.set(t.tool_uuid, t.name);
            }
        }
        return m;
    }, [tools]);

    const fetchRecentRunUsage = useCallback(async () => {
        setRunsUsageLoading(true);
        setRunsUsageError(false);
        const urlRange = parseTrendDateRangeFromSearchParams(searchParams);
        const effRange =
            urlRange.since && urlRange.until
                ? { since: urlRange.since, until: urlRange.until }
                : sessionRange;
        const granularity = parseTrendGranularityFromSearchParams(searchParams);
        const weeksFromUrl = parseTrendWeeksFromSearchParams(searchParams);
        const hasExplicitTrendWeeks = searchParams.get('trendWeeks') != null;
        const lookbackWeeks =
            effRange != null
                ? weeksFromUrl
                : hasExplicitTrendWeeks
                  ? weeksFromUrl
                  : sessionWeeks ?? weeksFromUrl;
        const daysFromUrl = parseTrendDaysFromSearchParams(searchParams);
        const hasExplicitTrendDays = searchParams.get(TREND_DAYS_PARAM) != null;
        const lookbackDays =
            effRange != null
                ? daysFromUrl
                : hasExplicitTrendDays
                  ? daysFromUrl
                  : sessionDays ?? daysFromUrl;
        try {
            const res = await getWorkflowRunsApiV1WorkflowWorkflowIdRunsGet({
                path: { workflow_id: workflowId },
                query: {
                    limit: 100,
                    page: 1,
                    sort_by: 'created_at',
                    sort_order: 'desc',
                },
            });
            const runs = res.data?.runs ?? [];
            const hints = computeRunUsageHints(runs);
            setRecentRunUsageHint(hints.lastRun);
            setRecentRunAggregateHint(hints.aggregate);
            let runsForAggregate = runs;
            if (effRange) {
                runsForAggregate = filterRunsForTrendUtcInclusiveYmdRange(runs, effRange.since, effRange.until);
            }
            const maxForFallback =
                effRange != null ? (granularity === 'day' ? 400 : 104) : granularity === 'day' ? lookbackDays : lookbackWeeks;
            let buckets =
                granularity === 'day'
                    ? aggregateRunsByDay(runsForAggregate, maxForFallback)
                    : aggregateRunsByWeek(runsForAggregate, maxForFallback);
            try {
                if (granularity === 'day') {
                    const rollupQuery =
                        effRange != null
                            ? { since: effRange.since, until: effRange.until }
                            : { days: lookbackDays };
                    const rollup = await getWorkflowDailyUsageRollupApiV1WorkflowWorkflowIdUsageDailyRollupGet({
                        path: { workflow_id: workflowId },
                        query: rollupQuery,
                    });
                    if (rollup.data && Array.isArray(rollup.data.buckets)) {
                        buckets = dailyRollupApiToUsageTrendBuckets(rollup.data.buckets);
                    }
                } else {
                    const rollupQuery =
                        effRange != null
                            ? { since: effRange.since, until: effRange.until }
                            : { weeks: lookbackWeeks };
                    const rollup = await getWorkflowWeeklyUsageRollupApiV1WorkflowWorkflowIdUsageWeeklyRollupGet({
                        path: { workflow_id: workflowId },
                        query: rollupQuery,
                    });
                    if (rollup.data && Array.isArray(rollup.data.buckets)) {
                        buckets = weeklyRollupApiToUsageTrendBuckets(rollup.data.buckets);
                    }
                }
            } catch {
                // keep client-side buckets from last 100 runs
            }
            setUsageTrendBuckets(buckets);
            setUsageTrendHint(formatUsageTrendHint(buckets, granularity === 'day' ? 'day' : 'week'));
        } catch {
            setRecentRunUsageHint(null);
            setRecentRunAggregateHint(null);
            setUsageTrendBuckets([]);
            setUsageTrendHint(null);
            setRunsUsageError(true);
        } finally {
            setRunsUsageLoading(false);
        }
    }, [workflowId, searchParams, sessionRange, sessionWeeks, sessionDays]);

    const fetchCostDryRun = useCallback(async () => {
        try {
            const r = await fetchWorkflowCostDryRun(workflowId);
            if (!r) {
                setCostDryRunHint(null);
                setCostDryRunDetail(null);
                return;
            }
            setCostDryRunHint(formatCostDryRunHint(r));
            setCostDryRunDetail(costDryRunTooltip(r));
        } catch {
            setCostDryRunHint(null);
            setCostDryRunDetail(null);
        }
    }, [workflowId]);

    useEffect(() => {
        void fetchRecentRunUsage();
    }, [fetchRecentRunUsage]);

    useEffect(() => {
        void fetchCostDryRun();
    }, [fetchCostDryRun]);

    useEffect(() => {
        const onVis = () => {
            if (document.visibilityState === 'visible') {
                void fetchRecentRunUsage();
                void fetchCostDryRun();
            }
        };
        document.addEventListener('visibilitychange', onVis);
        return () => document.removeEventListener('visibilitychange', onVis);
    }, [fetchRecentRunUsage, fetchCostDryRun]);

    const handleCustomizeInstall = useCallback(async () => {
        try {
            const res = await getWorkflowApiV1WorkflowFetchWorkflowIdGet({
                path: { workflow_id: workflowId },
            });
            const wf = res.data;
            if (!wf?.workflow_configurations || typeof wf.workflow_configurations !== "object") {
                toast.error("Could not load workflow settings");
                return;
            }
            const cfg = { ...wf.workflow_configurations } as WorkflowConfigurations & Record<string, unknown>;
            const prevMk = (cfg.mk01 && typeof cfg.mk01 === "object" ? cfg.mk01 : {}) as Record<string, unknown>;
            cfg.mk01 = { ...prevMk, installation_locked: false };
            await updateWorkflowApiV1WorkflowWorkflowIdPut({
                path: { workflow_id: workflowId },
                body: { workflow_configurations: cfg },
            });
            setInstallationLocked(false);
            toast.success("You can edit this workflow");
        } catch (e) {
            console.error(e);
            toast.error("Failed to unlock editor");
        }
    }, [workflowId]);

    const guardedNodeSelect = useCallback(
        (nodeType: NodeType) => {
            if (installationLocked) return;
            handleNodeSelect(nodeType);
        },
        [installationLocked, handleNodeSelect],
    );

    // Return to the draft version, creating one from published if needed
    const handleBackToDraft = useCallback(async () => {
        const existingDraft = versions.find((v) => v.status === "draft");
        if (existingDraft) {
            handleSelectVersion(existingDraft);
            return;
        }

        // No draft exists — ask the backend to create one from published
        const response = await createWorkflowDraftApiV1WorkflowWorkflowIdCreateDraftPost({
            path: { workflow_id: workflowId },
        });
        const draft = response.data;
        if (draft) {
            setCurrentVersionNumber(draft.version_number);
            setCurrentVersionStatus(draft.status);
            const wfJson = draft.workflow_json as unknown as WorkflowDefinition | undefined;
            hydrateVersionGraph(
                (wfJson?.nodes ?? []) as FlowNode[],
                (wfJson?.edges ?? []) as FlowEdge[],
                wfJson?.subflows ?? {},
            );
            setActiveVersionId(draft.id);
            setIsDirty(false);
            // Refresh the version list so the new draft appears
            fetchVersions(true);
        }
    }, [versions, handleSelectVersion, workflowId, hydrateVersionGraph, setIsDirty, fetchVersions]);

    // After a successful publish, refresh the version list and update status
    const handlePublished = useCallback(() => {
        setCurrentVersionStatus("published");
        fetchVersions(true);
    }, [fetchVersions]);

    // Compute version label for the header.
    // Uses currentVersionNumber/Status which update immediately from save responses,
    // falling back to the versions list for history navigation.
    const activeVersionLabel = useMemo(() => {
        // When viewing a version from the history panel, use the versions list
        if (activeVersionId && versions.length > 0) {
            const v = versions.find((ver) => ver.id === activeVersionId);
            if (v) {
                const statusSuffix = v.status === "draft" ? " (Draft)" : v.status === "published" ? " (Published)" : "";
                return `v${v.version_number}${statusSuffix}`;
            }
        }
        // Otherwise use the immediately-available version info from save responses
        if (currentVersionNumber != null) {
            const statusSuffix = currentVersionStatus === "draft" ? " (Draft)" : currentVersionStatus === "published" ? " (Published)" : "";
            return `v${currentVersionNumber}${statusSuffix}`;
        }
        return undefined;
    }, [activeVersionId, versions, currentVersionNumber, currentVersionStatus]);

    // Fetch documents, tools, and recordings once for the entire workflow
    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch documents
                const documentsResponse = await listDocumentsApiV1KnowledgeBaseDocumentsGet({
                    query: { limit: 100 },
                });
                if (documentsResponse.data) {
                    setDocuments(documentsResponse.data.documents);
                }

                // Fetch tools
                const toolsResponse = await listToolsApiV1ToolsGet({});
                if (toolsResponse.data) {
                    setTools(toolsResponse.data);
                }

                // Fetch org-level recordings
                try {
                    const recordingsResponse = await listRecordingsApiV1WorkflowRecordingsGet({
                        query: {},
                    });
                    if (recordingsResponse.data) {
                        setRecordings(recordingsResponse.data.recordings);
                    }
                } catch {
                    // Recordings API may not be available yet; silently ignore
                }
            } catch (error) {
                console.error('Failed to fetch documents and tools:', error);
            }
        };

        fetchData();
    }, [workflowId]);

    // Memoize defaultEdgeOptions to prevent unnecessary re-renders
    const defaultEdgeOptions = useMemo(() => ({
        animated: true,
        type: "custom"
    }), []);

    // Guard saveWorkflow so it's a no-op when viewing a historical version.
    // This is the single safety net that covers every save path: header button,
    // Cmd+S, node edit dialogs, stale doc/tool cleanup, etc.
    // Uses the save response to immediately update version label and hasDraft.
    const guardedSaveWorkflow = useCallback(async (updateWorkflowDefinition?: boolean) => {
        if (isViewingHistoricalVersion || installationLocked) return;
        const result = await saveWorkflow(updateWorkflowDefinition);
        if (result) {
            void fetchCostDryRun();
            // If the versions list has been fetched (user interacted with versioning
            // or published), refresh it so that activeVersionId points to the correct
            // version.  This is critical when a save creates a new draft from a
            // published version: without refreshing, activeVersionId would still
            // point to the old published version, causing isViewingHistoricalVersion
            // to incorrectly return true and lock the editor into read-only mode.
            if (versionsFetched.current) {
                await fetchVersions(true);
            } else {
                if (result.versionNumber != null) setCurrentVersionNumber(result.versionNumber);
                if (result.versionStatus) setCurrentVersionStatus(result.versionStatus);
            }
        }
    }, [saveWorkflow, isViewingHistoricalVersion, installationLocked, fetchVersions, fetchCostDryRun]);

    /** WE-01-TEST: in-memory workflow snapshot for Simulation rail raw JSON (secrets redacted). */
    const inspectorSelectedNode = useMemo(() => {
        const selected = nodes.filter((n) => n.selected);
        return selected.length === 1 ? selected[0] : null;
    }, [nodes]);

    const mainGraphForSimulation = useMemo(() => {
        if (activeFlowScope === 'main') {
            return { nodes, edges };
        }
        if (mainSnapshot) {
            return { nodes: mainSnapshot.nodes, edges: mainSnapshot.edges };
        }
        return { nodes, edges };
    }, [activeFlowScope, mainSnapshot, nodes, edges]);

    const subflowsForDebug = useMemo(() => {
        const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
        if (activeFlowScope === 'main') {
            return { ...subflowsFromStore };
        }
        return {
            ...subflowsFromStore,
            [activeFlowScope]: {
                nodes: clone(nodes),
                edges: clone(edges),
            },
        };
    }, [activeFlowScope, subflowsFromStore, nodes, edges]);

    const simulationDebugSnapshot = useMemo(
        () =>
            redactForDebugJson({
                workflow_id: workflowId,
                name: workflowName,
                version: {
                    number: currentVersionNumber,
                    status: currentVersionStatus,
                },
                template_context_variables: templateContextVariables ?? {},
                workflow_configurations: workflowConfigurations ?? {},
                active_flow_scope: activeFlowScope,
                graph: {
                    nodes: mainGraphForSimulation.nodes,
                    edges: mainGraphForSimulation.edges,
                },
                subflows: subflowsForDebug,
            }),
        [
            workflowId,
            workflowName,
            currentVersionNumber,
            currentVersionStatus,
            templateContextVariables,
            workflowConfigurations,
            activeFlowScope,
            mainGraphForSimulation.nodes,
            mainGraphForSimulation.edges,
            subflowsForDebug,
        ],
    );

    // Memoize the context value to prevent unnecessary re-renders
    const workflowContextValue = useMemo(() => ({
        saveWorkflow: guardedSaveWorkflow,
        documents,
        tools,
        recordings,
        readOnly: graphLocked,
    }), [guardedSaveWorkflow, documents, tools, recordings, graphLocked]);

    const canvasReadOnly = isViewingHistoricalVersion;

    const webTestDisabled = isDirty || workflowValidationErrors.length > 0 || activeFlowScope !== 'main';

    const webTestDisabledReason = useMemo(() => {
        if (!webTestDisabled) return null;
        if (isDirty) {
            return 'Save your workflow first. Web test uses the last saved graph.';
        }
        if (workflowValidationErrors.length > 0) {
            return 'Fix the validation issues shown in the header before starting a Web test.';
        }
        if (activeFlowScope !== 'main') {
            return 'Switch to Main flow to run Web test — it uses the saved primary graph.';
        }
        return null;
    }, [webTestDisabled, isDirty, workflowValidationErrors.length, activeFlowScope]);

    const handleSimulationWebTest = useCallback(async () => {
        if (webTestBusy || webTestDisabled) return;
        setWebTestBusy(true);
        try {
            posthog.capture(PostHogEvent.WEB_CALL_INITIATED, {
                workflow_id: workflowId,
                workflow_name: workflowName,
                source: 'simulation_rail',
            });
            await onRun(WORKFLOW_RUN_MODES.SMALL_WEBRTC);
        } catch (e) {
            logger.error(`Simulation Web test failed: ${e}`);
            toast.error('Could not start Web test — try again from the Call menu.');
        } finally {
            setWebTestBusy(false);
        }
    }, [webTestBusy, webTestDisabled, workflowId, workflowName, onRun]);

    const workflowCanvas = (
        <>
            <ReactFlow
                key={activeVersionId ?? 'current'}
                className="h-full w-full"
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                onConnect={graphLocked ? undefined : onConnect}
                minZoom={0.4}
                onInit={(instance) => {
                    rfInstance.current = instance;
                    setTimeout(() => {
                        instance.fitView({ padding: 0.2, duration: 200, maxZoom: 0.75 });
                    }, 0);
                }}
                defaultEdgeOptions={defaultEdgeOptions}
                defaultViewport={initialFlow?.viewport}
                nodesDraggable={!graphLocked}
                nodesConnectable={!graphLocked}
                edgesReconnectable={!graphLocked}
                zoomOnDoubleClick={false}
                deleteKeyCode={graphLocked ? null : 'Backspace'}
            >
                <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#94a3b8" />

                {!graphLocked && nodes.length === 0 && (
                    <Panel position="top-center" className="mt-10 w-[min(100%,24rem)] px-3">
                        <div className="rounded-lg border border-border bg-background/95 px-4 py-3 text-center shadow-md backdrop-blur-sm">
                            <p className="text-sm font-medium text-foreground">Empty canvas</p>
                            <p className="mt-1 text-xs text-muted-foreground leading-snug">
                                Add <strong className="text-foreground">Start</strong> and an{' '}
                                <strong className="text-foreground">Agent</strong> from the left palette, connect them,
                                then <strong className="text-foreground">Save</strong>. Prefer a head start? Install a
                                template—no JSON required.
                            </p>
                            <Button variant="secondary" size="sm" className="mt-3 gap-2" asChild>
                                <Link href="/workflow/catalog">
                                    <LayoutTemplate className="h-4 w-4 shrink-0" aria-hidden />
                                    Browse template catalog
                                </Link>
                            </Button>
                        </div>
                    </Panel>
                )}

                {!graphLocked && (
                    <Panel position="top-right">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() => router.push(`/workflow/${workflowId}/settings`)}
                                        className="bg-white shadow-sm hover:shadow-md"
                                    >
                                        <Settings className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="left">
                                    <p>Workflow settings</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </Panel>
                )}
            </ReactFlow>

            <div className="absolute bottom-12 left-8 z-10 flex gap-2">
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => rfInstance.current?.zoomIn()}
                                className="bg-white shadow-sm hover:shadow-md h-8 w-8"
                            >
                                <Plus className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                            <p>Zoom in</p>
                        </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => rfInstance.current?.zoomOut()}
                                className="bg-white shadow-sm hover:shadow-md h-8 w-8"
                            >
                                <Minus className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                            <p>Zoom out</p>
                        </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => rfInstance.current?.fitView()}
                                className="bg-white shadow-sm hover:shadow-md h-8 w-8"
                            >
                                <Maximize2 className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                            <p>Fit view</p>
                        </TooltipContent>
                    </Tooltip>

                    {!graphLocked && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    aria-label="Tidy up layout"
                                    onClick={() => {
                                        setNodes(layoutNodes(nodes, edges, 'TB', rfInstance));
                                        setIsDirty(true);
                                    }}
                                    className="bg-white shadow-sm hover:shadow-md h-8 w-8"
                                >
                                    <BrushCleaning className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                                <p>Tidy Up</p>
                            </TooltipContent>
                        </Tooltip>
                    )}
                </TooltipProvider>
            </div>
        </>
    );

    return (
        <WorkflowProvider value={workflowContextValue}>
            <div className="flex flex-col h-screen min-w-fit">
                {/* New Workflow Editor Header */}
                <WorkflowEditorHeader
                    workflowName={workflowName}
                    isDirty={isDirty}
                    workflowValidationErrors={workflowValidationErrors}
                    rfInstance={rfInstance}
                    onRun={onRun}
                    workflowId={workflowId}
                    saveWorkflow={guardedSaveWorkflow}
                    user={user}
                    onPhoneCallClick={() => setIsPhoneCallDialogOpen(true)}
                    onHistoryClick={handleOpenVersionPanel}
                    activeVersionLabel={activeVersionLabel}
                    isViewingHistoricalVersion={isViewingHistoricalVersion}
                    onBackToDraft={handleBackToDraft}
                    hasDraft={hasDraft}
                    onPublished={handlePublished}
                    isInstallationLocked={installationLocked}
                    onCustomizeInstall={handleCustomizeInstall}
                    templateSourceLabel={templateSourceLabel}
                    costLatencyHint={costLatencyHint}
                    recentRunUsageHint={recentRunUsageHint}
                    recentRunAggregateHint={recentRunAggregateHint}
                    usageTrendHint={usageTrendHint}
                    costDryRunHint={costDryRunHint}
                    costDryRunDetail={costDryRunDetail}
                    draftGraphStatsHint={draftGraphStatsHint}
                    subflowInventoryHint={subflowInventoryHint}
                    editorMode={editorMode}
                    onEditorModeChange={setEditorMode}
                    showEditorModeTabs={!isViewingHistoricalVersion}
                    flowNodes={flowNodesForHeader}
                />

                {/* WE-01-SUBFLOWS: Main flow vs component subgraph */}
                {!canvasReadOnly && (
                    <WorkflowFlowScopeBar
                        activeScope={activeFlowScope}
                        onScopeChange={handleFlowScopeChange}
                        disabled={graphLocked}
                    />
                )}

                {/* Workflow canvas: full-width when viewing history; three-column shell when editing (WE-01-SHELL) */}
                {canvasReadOnly ? (
                    <div className="relative min-h-0 flex-1">{workflowCanvas}</div>
                ) : (
                    <div className="flex min-h-0 flex-1 flex-col">
                        <WorkflowEditorShell
                            workflowId={workflowId}
                            left={
                                <AddNodePanel
                                    variant="inline"
                                    isOpen
                                    onClose={() => {}}
                                    onNodeSelect={guardedNodeSelect}
                                />
                            }
                            center={<div className="relative h-full min-h-0 w-full">{workflowCanvas}</div>}
                            right={
                                <WorkflowEditorRightRail
                                    workflowId={workflowId}
                                    mode={editorMode}
                                    workflowName={workflowName}
                                    graphNodes={nodes}
                                    validationErrorCount={workflowValidationErrors.length}
                                    hasPublishedVersion={hasPublishedVersion}
                                    toolNamesByUuid={toolNamesByUuid}
                                    catalogSlug={catalogSlug ?? null}
                                    catalogDisplayName={catalogPackMeta?.display_name ?? null}
                                    simulationDebugSnapshot={simulationDebugSnapshot}
                                    templateContextVariables={templateContextVariables ?? {}}
                                    saveTemplateContextVariables={saveTemplateContextVariables}
                                    selectedNode={inspectorSelectedNode}
                                    inspectorReadOnly={isViewingHistoricalVersion}
                                    onWebTest={handleSimulationWebTest}
                                    webTestDisabled={webTestDisabled}
                                    webTestDisabledReason={webTestDisabledReason}
                                    webTestBusy={webTestBusy}
                                    usageTrendBuckets={usageTrendBuckets}
                                    usageTrendLoading={runsUsageLoading}
                                    usageTrendError={runsUsageError}
                                    usageTrendGranularity={usageTrendGranularity}
                                    onUsageTrendGranularityChange={handleUsageTrendGranularityChange}
                                    usageTrendLookbackWeeks={usageTrendLookbackWeeks}
                                    onUsageTrendLookbackWeeksChange={handleUsageTrendLookbackWeeksChange}
                                    usageTrendLookbackDays={usageTrendLookbackDays}
                                    onUsageTrendLookbackDaysChange={handleUsageTrendLookbackDaysChange}
                                    usageTrendUsesCustomRange={usageTrendUsesCustomRange}
                                    usageTrendRangeSinceDraft={usageTrendRangeSinceDraft}
                                    usageTrendRangeUntilDraft={usageTrendRangeUntilDraft}
                                    onUsageTrendRangeSinceDraftChange={setUsageTrendRangeSinceDraft}
                                    onUsageTrendRangeUntilDraftChange={setUsageTrendRangeUntilDraft}
                                    onUsageTrendRangeApply={handleApplyUsageTrendRange}
                                    onUsageTrendRangeClear={handleClearUsageTrendRange}
                                    usageTrendExportCsv
                                    usageTrendExportPng
                                    usageTrendExportFilenameBase={`workflow-${workflowId}-usage-${usageTrendGranularity === 'day' ? 'daily' : 'weekly'}-trend`}
                                />
                            }
                        />
                    </div>
                )}

                <VersionHistoryPanel
                    isOpen={isVersionPanelOpen}
                    onClose={() => setIsVersionPanelOpen(false)}
                    versions={versions}
                    loading={versionsLoading}
                    activeVersionId={activeVersionId}
                    onSelectVersion={handleSelectVersion}
                />

                <PhoneCallDialog
                    open={isPhoneCallDialogOpen}
                    onOpenChange={setIsPhoneCallDialogOpen}
                    workflowId={workflowId}
                    user={user}
                />
            </div>
        </WorkflowProvider>
    );
}

// Memoize the component to prevent unnecessary re-renders when parent re-renders
export default React.memo(RenderWorkflow, (prevProps, nextProps) => {
    // Only re-render if these specific props change
    return (
        prevProps.workflowId === nextProps.workflowId &&
        prevProps.initialWorkflowName === nextProps.initialWorkflowName &&
        prevProps.user.id === nextProps.user.id
        // Note: We intentionally don't compare initialFlow, initialTemplateContextVariables,
        // or initialWorkflowConfigurations because they're only used for initialization
    );
});
