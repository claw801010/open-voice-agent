'use client';

import { ExternalLink, Settings } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';

export type WorkflowEditorRightRailProps = {
    workflowId: number;
};

/**
 * Placeholder for inspector / test rail (WE-01-SHELL).
 * Full parity with reference product is tracked under WE-01-PALETTE / WE-01-TEST.
 */
export function WorkflowEditorRightRail({ workflowId }: WorkflowEditorRightRailProps) {
    return (
        <div className="flex h-full min-h-0 flex-col border-l border-border bg-muted/15">
            <div className="shrink-0 border-b border-border px-3 py-2">
                <h2 className="text-sm font-semibold">Inspector</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                    Select a node on the canvas to edit its settings.
                </p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3 space-y-3">
                <Button variant="outline" size="sm" className="w-full justify-start gap-2" asChild>
                    <Link href={`/workflow/${workflowId}/settings`}>
                        <Settings className="h-4 w-4 shrink-0" />
                        Workflow settings
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
