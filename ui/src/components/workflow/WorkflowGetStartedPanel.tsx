'use client';

import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { createWorkflowApiV1WorkflowCreateDefinitionPost } from '@/client/sdk.gen';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import logger from '@/lib/logger';
import { getRandomId } from '@/lib/utils';
import {
    WORKFLOW_CREATION_OPTIONS,
    WORKFLOW_EDITOR_BEST_PRACTICES,
    type WorkflowCreationOptionId,
} from '@/lib/workflowCreationOptions';

import { ImportExternalWorkflowDialog } from './ImportExternalWorkflowDialog';

const BLANK_WORKFLOW_DEFINITION = {
    nodes: [
        {
            id: '1',
            type: 'startCall',
            position: { x: 175, y: 60 },
            data: {
                prompt:
                    '# Goal\nYou are a helpful agent handling a voice conversation.\n\n## Rules\n- Keep responses short (2–3 sentences)\n- Be polite and clear\n',
                name: 'start call',
                allow_interrupt: false,
                invalid: false,
                validationMessage: null,
                is_static: false,
                add_global_prompt: false,
                wait_for_user_response: false,
                detect_voicemail: true,
                delayed_start: false,
                is_start: true,
                selected_through_edge: false,
                hovered_through_edge: false,
                extraction_enabled: false,
                selected: false,
                dragging: false,
            },
        },
    ],
    edges: [],
    viewport: { x: 808, y: 269, zoom: 0.75 },
};

export function WorkflowGetStartedPanel() {
    const router = useRouter();
    const { user, getAccessToken } = useAuth();
    const [importOpen, setImportOpen] = useState(false);
    const [creatingBlank, setCreatingBlank] = useState(false);

    const handleOption = async (id: WorkflowCreationOptionId, href?: string) => {
        if (id === 'import') {
            setImportOpen(true);
            return;
        }
        if (id === 'blank') {
            if (creatingBlank || !user) return;
            setCreatingBlank(true);
            try {
                const accessToken = await getAccessToken();
                const name = `Workflow-${getRandomId()}`;
                const response = await createWorkflowApiV1WorkflowCreateDefinitionPost({
                    body: {
                        name,
                        workflow_definition: BLANK_WORKFLOW_DEFINITION as unknown as { [key: string]: unknown },
                    },
                    headers: { Authorization: `Bearer ${accessToken}` },
                });
                if (response.data?.id) {
                    router.push(`/workflow/${response.data.id}`);
                }
            } catch (err) {
                logger.error(`Error creating blank workflow: ${err}`);
                toast.error('Failed to create workflow');
            } finally {
                setCreatingBlank(false);
            }
            return;
        }
        if (href) {
            router.push(href);
        }
    };

    return (
        <section className="mb-10" aria-labelledby="workflow-get-started-heading">
            <h2 id="workflow-get-started-heading" className="text-xl font-semibold mb-2">
                Get started
            </h2>
            <p className="text-sm text-muted-foreground mb-4 max-w-3xl">
                Choose how you want to build. Templates and imports ship with runbooks and HTTP proof patterns; customize
                before publish for the best GTM outcome.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {WORKFLOW_CREATION_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    return (
                        <div
                            key={opt.id}
                            className="rounded-lg border border-border bg-card/40 p-4 flex flex-col gap-3"
                        >
                            <div className="flex items-start gap-3">
                                <div className="rounded-md border border-border bg-muted/50 p-2 shrink-0">
                                    <Icon className="h-5 w-5 text-foreground/80" aria-hidden />
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h3 className="font-medium text-sm">{opt.title}</h3>
                                        {opt.recommended ? (
                                            <span className="text-[10px] uppercase tracking-wide font-medium text-teal-700 dark:text-teal-400">
                                                Recommended
                                            </span>
                                        ) : null}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-0.5">{opt.subtitle}</p>
                                </div>
                            </div>
                            <p className="text-[11px] text-muted-foreground leading-snug">{opt.bestPractice}</p>
                            {opt.href ? (
                                <Button variant="secondary" size="sm" className="w-fit gap-1" asChild>
                                    <Link href={opt.href}>
                                        Open
                                        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                                    </Link>
                                </Button>
                            ) : (
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    className="w-fit gap-1"
                                    disabled={opt.id === 'blank' && creatingBlank}
                                    onClick={() => handleOption(opt.id, opt.href)}
                                >
                                    {opt.id === 'blank' && creatingBlank ? 'Creating…' : opt.id === 'import' ? 'Import' : 'Create'}
                                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                                </Button>
                            )}
                        </div>
                    );
                })}
            </div>
            <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-1 max-w-3xl">
                {WORKFLOW_EDITOR_BEST_PRACTICES.map((tip) => (
                    <li key={tip}>{tip}</li>
                ))}
            </ul>
            <ImportExternalWorkflowDialog open={importOpen} onOpenChange={setImportOpen} />
        </section>
    );
}
