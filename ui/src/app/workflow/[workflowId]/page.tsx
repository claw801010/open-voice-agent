'use client';

import { useParams } from 'next/navigation';
import posthog from 'posthog-js';
import { useEffect, useMemo, useState } from 'react';

import RenderWorkflow from '@/app/workflow/[workflowId]/RenderWorkflow';
import { getWorkflowApiV1WorkflowFetchWorkflowIdGet } from '@/client/sdk.gen';
import type { WorkflowResponse } from '@/client/types.gen';
import { FlowEdge, FlowNode, type WorkflowDefinition } from '@/components/flow/types';
import SpinLoader from '@/components/SpinLoader';
import { PostHogEvent } from '@/constants/posthog-events';
import { UnsavedChangesProvider } from '@/context/UnsavedChangesContext';
import { useAuth } from '@/lib/auth';
import logger from '@/lib/logger';
import { DEFAULT_WORKFLOW_CONFIGURATIONS, WorkflowConfigurations } from '@/types/workflow-configurations';

import WorkflowLayout from '../WorkflowLayout';

export default function WorkflowDetailPage() {
    const params = useParams();
    const [workflow, setWorkflow] = useState<WorkflowResponse | undefined>(undefined);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { user, redirectToLogin, loading: authLoading } = useAuth();

    // Redirect if not authenticated
    useEffect(() => {
        if (!authLoading && !user) {
            redirectToLogin();
        }
    }, [authLoading, user, redirectToLogin]);

    useEffect(() => {
        const fetchWorkflow = async () => {
            if (!user) return;
            try {
                const response = await getWorkflowApiV1WorkflowFetchWorkflowIdGet({
                    path: {
                        workflow_id: Number(params.workflowId)
                    },
                });
                const workflow = response.data;
                setWorkflow(workflow);
                posthog.capture(PostHogEvent.WORKFLOW_EDITOR_OPENED, {
                    workflow_id: workflow?.id,
                    workflow_name: workflow?.name,
                });
            } catch (err) {
                setError('Failed to fetch workflow');
                logger.error(`Error fetching workflow: ${err}`);
            } finally {
                setLoading(false);
            }
        };

        if (user) {
            fetchWorkflow();
        }
    }, [params.workflowId, user]);

    const stableUser = useMemo(() => user, [user]);

    const mergedWorkflowConfigurations = useMemo((): WorkflowConfigurations => {
        const raw = workflow?.workflow_configurations;
        if (raw && typeof raw === 'object') {
            return { ...DEFAULT_WORKFLOW_CONFIGURATIONS, ...raw };
        }
        return DEFAULT_WORKFLOW_CONFIGURATIONS;
    }, [workflow?.workflow_configurations]);

    if (loading) {
        return (
            <WorkflowLayout>
                <SpinLoader />
            </WorkflowLayout>
        );
    }
    else if (error || !workflow) {
        return (
            <WorkflowLayout showFeaturesNav={false}>
                <div className="flex items-center justify-center min-h-screen">
                    <div className="text-lg text-destructive">{error || 'Workflow not found'}</div>
                </div>
            </WorkflowLayout>
        );
    }
    else {
        const wd = workflow.workflow_definition as unknown as WorkflowDefinition;
        const defaultViewport = { x: 0, y: 0, zoom: 1 };
        const rawVp = wd.viewport ?? defaultViewport;
        const viewport =
            rawVp.zoom === 0 || rawVp.zoom == null ? { ...rawVp, zoom: 1 } : rawVp;

        return stableUser ? (
            <UnsavedChangesProvider>
                <RenderWorkflow
                    initialWorkflowName={workflow.name}
                    workflowId={workflow.id}
                    initialFlow={{
                        nodes: wd.nodes as FlowNode[],
                        edges: wd.edges as FlowEdge[],
                        viewport,
                        subflows: wd.subflows,
                    }}
                    initialTemplateContextVariables={workflow.template_context_variables as Record<string, string> || {}}
                    initialWorkflowConfigurations={mergedWorkflowConfigurations}
                    initialVersionNumber={workflow.version_number ?? null}
                    initialVersionStatus={workflow.version_status ?? null}
                    user={stableUser}
                />
            </UnsavedChangesProvider>
        ) : null;
    }
}
