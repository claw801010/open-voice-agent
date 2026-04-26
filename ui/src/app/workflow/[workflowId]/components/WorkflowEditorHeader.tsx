"use client";

import { ReactFlowInstance } from "@xyflow/react";
import { AlertCircle, ArrowLeft, CalendarDays, CheckCircle2, ChevronDown, Copy, Download, Eye, History, LoaderCircle, Lock, Menu, MessageCircle, MoreVertical, Phone, Rocket, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { useState } from "react";
import { toast } from "sonner";

import { WorkflowFeedbackDialog } from "@/app/workflow/[workflowId]/components/WorkflowFeedbackDialog";
import {
    duplicateWorkflowEndpointApiV1WorkflowWorkflowIdDuplicatePost,
    publishWorkflowApiV1WorkflowWorkflowIdPublishPost,
} from "@/client/sdk.gen";
import { WorkflowError } from "@/client/types.gen";
import { FlowEdge, FlowNode } from "@/components/flow/types";
import { GitHubStarBadge } from "@/components/layout/GitHubStarBadge";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { useSidebar } from "@/components/ui/sidebar";
import { PostHogEvent } from "@/constants/posthog-events";
import { WORKFLOW_RUN_MODES } from "@/constants/workflowRunModes";
import { getPublicFeedbackUrl } from "@/lib/feedbackUrl";
import { getUtcWeekMondayYmdFromDate } from "@/lib/usageOrgDeepLink";
import { cn } from "@/lib/utils";
import { friendlyValidationCopy, validationLocationLabel } from "@/lib/workflow/friendlyValidation";

interface WorkflowEditorHeaderProps {
    workflowName: string;
    isDirty: boolean;
    workflowValidationErrors: WorkflowError[];
    rfInstance: React.RefObject<ReactFlowInstance<FlowNode, FlowEdge> | null>;
    onRun: (mode: string) => Promise<void>;
    workflowId: number;
    saveWorkflow: (updateWorkflowDefinition?: boolean) => Promise<void>;
    user: { id: string; email?: string };
    onPhoneCallClick: () => void;
    onHistoryClick: () => void;
    activeVersionLabel?: string;
    isViewingHistoricalVersion: boolean;
    onBackToDraft: () => void;
    hasDraft: boolean;
    onPublished: () => void;
    /** Catalog install: graph is read-only until the user customizes */
    isInstallationLocked?: boolean;
    onCustomizeInstall?: () => void;
    /** WE-01-HEADER: template source (catalog / DB template); no PII */
    templateSourceLabel?: string | null;
    /** Short band from catalog JSON when available */
    costLatencyHint?: string | null;
    /** WE-01-HEADER: latest run with cost_info from GET /workflow/{id}/runs (tokens · duration) */
    recentRunUsageHint?: string | null;
    /** WE-01-HEADER: avg Dograh tokens over last N runs with usage (requires ≥2) */
    recentRunAggregateHint?: string | null;
    /** WE-01-HEADER: weekly run/token trend from GET /workflow/{id}/runs (aggregated client-side) */
    usageTrendHint?: string | null;
    /** WE-01-HEADER: heuristic dry-run from GET /workflow/{id}/estimate-cost */
    costDryRunHint?: string | null;
    /** Long tooltip: models + assumptions */
    costDryRunDetail?: string | null;
    /** WE-01-HEADER: structural summary of main graph (nodes/edges/agents) — not token estimate */
    draftGraphStatsHint?: string | null;
    /** WE-01-SUBFLOWS: non-empty subgraph keys persisted in `subflows` (store snapshot) */
    subflowInventoryHint?: string | null;
    /** Edit = inspector rail; Simulation = test-focused rail (WE-01-TEST placeholder) */
    editorMode?: "edit" | "simulation";
    onEditorModeChange?: (mode: "edit" | "simulation") => void;
    /** Hide simulation when viewing historical versions */
    showEditorModeTabs?: boolean;
    /** Resolve node ids to display names in validation popover (DX-01-NOCODE) */
    flowNodes?: FlowNode[];
}

export const WorkflowEditorHeader = ({
    workflowName,
    isDirty,
    workflowValidationErrors,
    rfInstance,
    saveWorkflow,
    onRun,
    onPhoneCallClick,
    onHistoryClick,
    activeVersionLabel,
    isViewingHistoricalVersion,
    onBackToDraft,
    hasDraft,
    onPublished,
    workflowId,
    isInstallationLocked = false,
    onCustomizeInstall,
    templateSourceLabel = null,
    costLatencyHint = null,
    recentRunUsageHint = null,
    recentRunAggregateHint = null,
    usageTrendHint = null,
    costDryRunHint = null,
    costDryRunDetail = null,
    draftGraphStatsHint = null,
    subflowInventoryHint = null,
    editorMode = "edit",
    onEditorModeChange,
    showEditorModeTabs = true,
    flowNodes,
}: WorkflowEditorHeaderProps) => {
    const feedbackUrl = getPublicFeedbackUrl();
    const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
    const router = useRouter();
    const { toggleSidebar } = useSidebar();
    const [savingWorkflow, setSavingWorkflow] = useState(false);
    const [duplicating, setDuplicating] = useState(false);
    const [publishing, setPublishing] = useState(false);

    const hasValidationErrors = workflowValidationErrors.length > 0;
    const isCallDisabled = isDirty || hasValidationErrors;
    const isEditingLocked = isViewingHistoricalVersion || isInstallationLocked;

    const handleSave = async () => {
        setSavingWorkflow(true);
        await saveWorkflow();
        setSavingWorkflow(false);
    };

    const handlePublish = async () => {
        if (publishing) return;
        setPublishing(true);
        const promise = publishWorkflowApiV1WorkflowWorkflowIdPublishPost({
            path: { workflow_id: workflowId },
        });
        toast.promise(promise, {
            loading: "Publishing...",
            success: "Workflow published successfully",
            error: "Failed to publish workflow",
        });
        try {
            await promise;
            onPublished();
        } finally {
            setPublishing(false);
        }
    };

    const handleBack = () => {
        router.push("/workflow");
    };

    const handleDuplicate = async () => {
        if (duplicating) return;
        setDuplicating(true);
        const promise = duplicateWorkflowEndpointApiV1WorkflowWorkflowIdDuplicatePost({
            path: { workflow_id: workflowId },
        });
        toast.promise(promise, {
            loading: "Duplicating workflow...",
            success: "Workflow duplicated successfully",
            error: "Failed to duplicate workflow",
        });
        try {
            const { data } = await promise;
            if (data?.id) {
                router.push(`/workflow/${data.id}`);
            }
        } finally {
            setDuplicating(false);
        }
    };

    const handleDownloadWorkflow = () => {
        if (!rfInstance.current) return;

        const workflowDefinition = rfInstance.current.toObject();
        const exportData = {
            name: workflowName,
            workflow_definition: workflowDefinition,
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${workflowName}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 w-full min-h-14 px-4 py-2 bg-[#1a1a1a] border-b border-[#2a2a2a]">
            {/* Left section: Mobile menu + Back button + Workflow name + metadata + Edit/Simulation */}
            <div className="flex items-start gap-3 mr-2 min-w-0 flex-1">
                <button
                    onClick={toggleSidebar}
                    className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-[#2a2a2a] transition-colors md:hidden shrink-0 mt-0.5"
                    aria-label="Open menu"
                >
                    <Menu className="w-5 h-5 text-white/70" />
                </button>
                <button
                    onClick={handleBack}
                    className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-[#2a2a2a] transition-colors shrink-0 mt-0.5"
                >
                    <ArrowLeft className="w-5 h-5 text-white/70" />
                </button>

                <div className="flex min-w-0 flex-col gap-1">
                    <h1 className="text-base font-medium text-white">
                        <span className="md:hidden">
                            {workflowName.length > 8 ? `${workflowName.slice(0, 8)}…` : workflowName}
                        </span>
                        <span className="hidden md:inline break-words">{workflowName}</span>
                    </h1>
                    <div
                        className="hidden sm:flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-white/80 leading-snug"
                        aria-label="Workflow metadata"
                    >
                        <span className="font-mono tabular-nums text-white/80 shrink-0">ID {workflowId}</span>
                        {templateSourceLabel ? (
                            <span className="text-amber-200/90 truncate max-w-[min(100%,14rem)]" title={templateSourceLabel}>
                                {templateSourceLabel}
                            </span>
                        ) : null}
                        {costLatencyHint ? (
                            <span
                                className="text-white/72 truncate max-w-[min(100%,20rem)]"
                                title={costLatencyHint}
                            >
                                Est. cost/latency: {costLatencyHint}
                            </span>
                        ) : null}
                        {recentRunUsageHint ? (
                            <span
                                className="text-white/72 truncate max-w-[min(100%,22rem)]"
                                title="Most recent workflow run with recorded usage (Dograh tokens and call length)."
                            >
                                {recentRunUsageHint}
                            </span>
                        ) : null}
                        {recentRunAggregateHint ? (
                            <span
                                className="text-white/72 truncate max-w-[min(100%,22rem)]"
                                title="Average Dograh tokens over recent runs that include token usage (up to 10)."
                            >
                                {recentRunAggregateHint}
                            </span>
                        ) : null}
                        {usageTrendHint ? (
                            <Link
                                href={`/usage?week=${getUtcWeekMondayYmdFromDate()}`}
                                className="text-teal-300/90 truncate max-w-[min(100%,26rem)] hover:text-teal-200 hover:underline underline-offset-2"
                                title="Open organization usage for this UTC week (all workflows). Weekly buckets from the last 100 runs."
                            >
                                {usageTrendHint}
                            </Link>
                        ) : null}
                        {costDryRunHint ? (
                            <span
                                className="text-white/72 truncate max-w-[min(100%,24rem)]"
                                title={costDryRunDetail ?? 'Heuristic token estimate from saved graph and your model settings (no live call).'}
                            >
                                {costDryRunHint}
                            </span>
                        ) : null}
                        {draftGraphStatsHint ? (
                            <span
                                className="text-white/72 truncate max-w-[min(100%,24rem)]"
                                title="Unsaved main-flow graph in the editor (structure only; not a cost estimate)."
                            >
                                {draftGraphStatsHint}
                            </span>
                        ) : null}
                        {subflowInventoryHint ? (
                            <span
                                className="text-white/72 truncate max-w-[min(100%,28rem)]"
                                title="Named subgraphs with content in saved subflows. Main-flow edges can set Run subgraph first (enter_subflow)."
                            >
                                {subflowInventoryHint}
                            </span>
                        ) : null}
                    </div>
                    {showEditorModeTabs && onEditorModeChange && !isViewingHistoricalVersion ? (
                        <div
                            className="ovo-segmented-track flex w-fit gap-0.5 p-0.5"
                            role="tablist"
                            aria-label="Editor mode"
                        >
                            <button
                                type="button"
                                role="tab"
                                aria-label="Edit mode: inspector and workflow graph"
                                aria-selected={editorMode === "edit"}
                                className={cn(
                                    'rounded-full border border-transparent px-3 py-1 text-xs font-medium ease-ovo-spring duration-200',
                                    'transition-[color,background-color,border-color,box-shadow,transform]',
                                    editorMode === 'edit'
                                        ? 'border-teal-500/40 bg-teal-600 text-white shadow-md shadow-teal-900/30'
                                        : 'text-muted-foreground hover:text-foreground',
                                )}
                                onClick={() => onEditorModeChange('edit')}
                            >
                                Edit
                            </button>
                            <button
                                type="button"
                                role="tab"
                                aria-label="Simulation mode: test calls and simulation tools"
                                aria-selected={editorMode === 'simulation'}
                                className={cn(
                                    'rounded-full border border-transparent px-3 py-1 text-xs font-medium ease-ovo-spring duration-200',
                                    'transition-[color,background-color,border-color,box-shadow,transform]',
                                    editorMode === 'simulation'
                                        ? 'border-teal-500/40 bg-teal-600 text-white shadow-md shadow-teal-900/30'
                                        : 'text-muted-foreground hover:text-foreground',
                                )}
                                onClick={() => onEditorModeChange('simulation')}
                            >
                                Simulation
                            </button>
                        </div>
                    ) : null}
                </div>
            </div>

            {/* Right section: Version + Unsaved indicator + Call button + Save button */}
            <div className="flex items-center gap-3 flex-wrap justify-end shrink-0">
                {!isDirty && !isEditingLocked && !isViewingHistoricalVersion && (
                    <div className="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded-md border border-emerald-500/20 bg-emerald-500/5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" aria-hidden />
                        <span className="text-xs text-emerald-600/90">No unsaved changes</span>
                    </div>
                )}
                {/* Read-only banner when viewing a historical version */}
                {isViewingHistoricalVersion && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-blue-500/30 bg-blue-500/10">
                        <Eye className="w-4 h-4 text-blue-400" />
                        <span className="text-sm text-blue-400">
                            Viewing {activeVersionLabel} — Read only
                        </span>
                    </div>
                )}

                {isInstallationLocked && !isViewingHistoricalVersion && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-amber-500/30 bg-amber-500/10">
                        <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                        <span className="text-sm text-amber-200 max-w-[min(28rem,50vw)]">
                            Installed from catalog — graph is read-only until you customize.
                        </span>
                        {onCustomizeInstall && (
                            <Button
                                type="button"
                                onClick={onCustomizeInstall}
                                className="bg-amber-600 hover:bg-amber-700 text-white px-3 shrink-0"
                            >
                                Customize
                            </Button>
                        )}
                    </div>
                )}

                {/* Back to Draft button when viewing history */}
                {isViewingHistoricalVersion && (
                    <Button
                        onClick={onBackToDraft}
                        className="bg-teal-600 hover:bg-teal-700 text-white px-4"
                    >
                        Back to Draft
                    </Button>
                )}

                {/* Version history button */}
                <button
                    onClick={onHistoryClick}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-[#3a3a3a] hover:bg-[#2a2a2a] transition-colors cursor-pointer"
                >
                    <History className="w-4 h-4 text-white/70" />
                    {activeVersionLabel && !isViewingHistoricalVersion && (
                        <span className="text-sm text-white/88">{activeVersionLabel}</span>
                    )}
                </button>

                {/* Unsaved changes indicator (hidden when viewing history) */}
                {isDirty && !isEditingLocked && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-yellow-500/30 bg-yellow-500/10">
                        <div className="w-2 h-2 rounded-full bg-yellow-500" />
                        <span className="text-sm text-yellow-500">Unsaved changes</span>
                    </div>
                )}

                {/* Validation errors indicator */}
                {hasValidationErrors && (
                    <Popover>
                        <PopoverTrigger asChild>
                            <button className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 transition-colors cursor-pointer">
                                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                <AlertCircle className="w-4 h-4 text-red-500" />
                                <span className="text-sm text-red-500">
                                    {workflowValidationErrors.length} {workflowValidationErrors.length === 1 ? "error" : "errors"}
                                </span>
                            </button>
                        </PopoverTrigger>
                        <PopoverContent
                            align="end"
                            className="w-80 bg-[#1a1a1a] border-[#3a3a3a] p-0"
                        >
                            <div className="px-4 py-3 border-b border-[#3a3a3a]">
                                <h3 className="text-sm font-medium text-white">Fix these before publish</h3>
                                <p className="text-xs text-white/72 mt-1">
                                    Plain-language summary; technical detail below each item.
                                </p>
                            </div>
                            <div className="max-h-64 overflow-y-auto">
                                {workflowValidationErrors.map((error, index) => {
                                    const friendly = friendlyValidationCopy(error);
                                    const where = validationLocationLabel(error, flowNodes);
                                    return (
                                        <div
                                            key={index}
                                            className="px-4 py-3 border-b border-[#2a2a2a] last:border-b-0"
                                        >
                                            <div className="flex items-start gap-2">
                                                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                                                <div className="flex-1 min-w-0 space-y-1.5">
                                                    <p className="text-sm font-medium text-white leading-snug">
                                                        {friendly.title}
                                                    </p>
                                                    {where ? (
                                                        <p className="text-[11px] text-white/78">{where}</p>
                                                    ) : null}
                                                    {error.field ? (
                                                        <p className="text-[11px] text-white/78">Field: {error.field}</p>
                                                    ) : null}
                                                    {friendly.hint ? (
                                                        <p className="text-xs text-white/75 leading-snug">{friendly.hint}</p>
                                                    ) : null}
                                                    <p className="text-xs text-white/90 break-words border-t border-[#2a2a2a] pt-2 mt-1">
                                                        {error.message}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </PopoverContent>
                    </Popover>
                )}

                {/* Call button with dropdown (hidden when viewing history) */}
                {!isViewingHistoricalVersion && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="outline"
                                className="flex items-center gap-2 bg-transparent border-[#3a3a3a] hover:bg-[#2a2a2a] text-white"
                                disabled={isCallDisabled}
                            >
                                <Phone className="w-4 h-4" />
                                Call
                                <ChevronDown className="w-4 h-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-[#1a1a1a] border-[#3a3a3a]">
                            <DropdownMenuItem
                                onClick={() => {
                                    posthog.capture(PostHogEvent.WEB_CALL_INITIATED, {
                                        workflow_id: workflowId,
                                        workflow_name: workflowName,
                                    });
                                    onRun(WORKFLOW_RUN_MODES.SMALL_WEBRTC);
                                }}
                                className="text-white hover:bg-[#2a2a2a] cursor-pointer"
                            >
                                <Phone className="w-4 h-4 mr-2" />
                                Web Call
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => {
                                    // Delay opening dialog to next event cycle to allow DropdownMenu
                                    // to clean up first, preventing pointer-events: none stuck on body
                                    // See: https://github.com/radix-ui/primitives/issues/1241
                                    setTimeout(onPhoneCallClick, 0);
                                }}
                                className="text-white hover:bg-[#2a2a2a] cursor-pointer"
                            >
                                <Phone className="w-4 h-4 mr-2" />
                                Phone Call
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}

                {/* Save button (only shown when editing the draft) */}
                {!isEditingLocked && (
                    <Button
                        onClick={handleSave}
                        disabled={!isDirty || savingWorkflow}
                        className="bg-teal-600 hover:bg-teal-700 text-white px-4"
                    >
                        {savingWorkflow ? (
                            <>
                                <LoaderCircle className="w-4 h-4 mr-2 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            "Save"
                        )}
                    </Button>
                )}

                {/* Publish button (only when on draft with no unsaved changes) */}
                {!isEditingLocked && hasDraft && (
                    <Button
                        onClick={handlePublish}
                        disabled={isDirty || publishing || hasValidationErrors}
                        variant="outline"
                        className="border-[#3a3a3a] bg-transparent hover:bg-[#2a2a2a] text-white px-4"
                    >
                        {publishing ? (
                            <>
                                <LoaderCircle className="w-4 h-4 mr-2 animate-spin" />
                                Publishing...
                            </>
                        ) : (
                            <>
                                <Rocket className="w-4 h-4 mr-2" />
                                Publish
                            </>
                        )}
                    </Button>
                )}

                {/* More options dropdown */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-white/70 hover:text-white hover:bg-[#2a2a2a]"
                        >
                            <MoreVertical className="w-5 h-5" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-[#1a1a1a] border-[#3a3a3a]">
                        <DropdownMenuItem
                            onClick={() => router.push(`/workflow/${workflowId}/runs`)}
                            className="text-white hover:bg-[#2a2a2a] cursor-pointer"
                        >
                            <History className="w-4 h-4 mr-2" />
                            View Runs
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => router.push("/usage")}
                            className="text-white hover:bg-[#2a2a2a] cursor-pointer"
                        >
                            <TrendingUp className="w-4 h-4 mr-2" />
                            Organization usage
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() =>
                                router.push(`/usage?week=${getUtcWeekMondayYmdFromDate()}`)
                            }
                            className="text-white hover:bg-[#2a2a2a] cursor-pointer"
                        >
                            <CalendarDays className="w-4 h-4 mr-2 opacity-90" />
                            Org usage · this UTC week
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={handleDuplicate}
                            disabled={duplicating}
                            className="text-white hover:bg-[#2a2a2a] cursor-pointer"
                        >
                            {duplicating ? (
                                <LoaderCircle className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <Copy className="w-4 h-4 mr-2" />
                            )}
                            {duplicating ? "Duplicating..." : "Duplicate Workflow"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={handleDownloadWorkflow}
                            className="text-white hover:bg-[#2a2a2a] cursor-pointer"
                        >
                            <Download className="w-4 h-4 mr-2" />
                            Download Workflow
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => setFeedbackDialogOpen(true)}
                            className="text-white hover:bg-[#2a2a2a] cursor-pointer"
                        >
                            <MessageCircle className="w-4 h-4 mr-2 shrink-0" />
                            Send feedback
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                <WorkflowFeedbackDialog
                    open={feedbackDialogOpen}
                    onOpenChange={setFeedbackDialogOpen}
                    workflowId={workflowId}
                    externalFeedbackUrl={feedbackUrl}
                />

                {/* GitHub star badge - desktop only */}
                <div className="hidden md:block">
                    <GitHubStarBadge className="border-[#3a3a3a] bg-[#2a2a2a] text-white [&_span]:bg-transparent" source="workflow_editor_header" />
                </div>
            </div>
        </div>
    );
};
