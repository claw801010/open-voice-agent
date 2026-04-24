'use client';

import { LayoutGrid, PanelRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Group, Panel, Separator, useDefaultLayout } from 'react-resizable-panels';

import { Button } from '@/components/ui/button';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useMediaQuery } from '@/hooks/useMediaQuery';

const PANEL_IDS = ['workflow-palette', 'workflow-canvas', 'workflow-rail'] as const;

/** Below this width the shell uses full-width canvas + sheet drawers (WE-01-SHELL). */
export const WORKFLOW_EDITOR_NARROW_MAX_PX = 1023;

const NARROW_MEDIA_QUERY = `(max-width: ${WORKFLOW_EDITOR_NARROW_MAX_PX}px)`;

export type WorkflowEditorShellProps = {
    workflowId: number;
    left: ReactNode;
    center: ReactNode;
    right: ReactNode;
};

/**
 * Three-column resizable layout: palette | canvas | inspector rail.
 * Layout is persisted per workflow in localStorage (WE-01-SHELL).
 * Narrow viewports: rails become **icon buttons** that open **sheets** (palette left, inspector right).
 */
export function WorkflowEditorShell({ workflowId, left, center, right }: WorkflowEditorShellProps) {
    const layoutId = `workflow-editor-${workflowId}`;
    const { defaultLayout, onLayoutChanged } = useDefaultLayout({
        id: layoutId,
        storage: localStorage,
        panelIds: [...PANEL_IDS],
    });

    const narrow = useMediaQuery(NARROW_MEDIA_QUERY);
    const [leftOpen, setLeftOpen] = useState(false);
    const [rightOpen, setRightOpen] = useState(false);

    if (narrow) {
        return (
            <section
                className="relative flex h-full min-h-0 w-full flex-1 flex-col"
                aria-label="Workflow editor"
            >
                <div className="relative min-h-0 min-w-0 flex-1">{center}</div>
                <TooltipProvider delayDuration={300}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                type="button"
                                variant="secondary"
                                size="icon"
                                className="absolute left-2 top-1/2 z-20 h-10 w-10 -translate-y-1/2 rounded-full border border-border bg-background/95 shadow-md"
                                onClick={() => setLeftOpen(true)}
                                aria-label="Open node palette"
                            >
                                <LayoutGrid className="h-5 w-5" aria-hidden />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="right">Node palette</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                type="button"
                                variant="secondary"
                                size="icon"
                                className="absolute right-2 top-1/2 z-20 h-10 w-10 -translate-y-1/2 rounded-full border border-border bg-background/95 shadow-md"
                                onClick={() => setRightOpen(true)}
                                aria-label="Open inspector and simulation"
                            >
                                <PanelRight className="h-5 w-5" aria-hidden />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="left">Inspector / Simulation</TooltipContent>
                    </Tooltip>
                </TooltipProvider>

                <Sheet open={leftOpen} onOpenChange={setLeftOpen}>
                    <SheetContent
                        side="left"
                        className="flex w-[min(100vw,280px)] flex-col gap-0 p-0 sm:max-w-[280px]"
                    >
                        <SheetHeader className="sr-only">
                            <SheetTitle>Node palette</SheetTitle>
                        </SheetHeader>
                        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{left}</div>
                    </SheetContent>
                </Sheet>

                <Sheet open={rightOpen} onOpenChange={setRightOpen}>
                    <SheetContent
                        side="right"
                        className="flex w-[min(100vw,420px)] flex-col gap-0 p-0 sm:max-w-[420px]"
                    >
                        <SheetHeader className="sr-only">
                            <SheetTitle>Inspector and simulation</SheetTitle>
                        </SheetHeader>
                        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{right}</div>
                    </SheetContent>
                </Sheet>
            </section>
        );
    }

    return (
        <section className="h-full min-h-0 w-full min-w-0" aria-label="Workflow editor">
            <Group
                className="h-full min-h-0 w-full"
                orientation="horizontal"
                defaultLayout={defaultLayout}
                onLayoutChanged={onLayoutChanged}
            >
                <Panel
                    id={PANEL_IDS[0]}
                    className="min-h-0 min-w-0"
                    defaultSize="22%"
                    minSize="12%"
                    maxSize="38%"
                >
                    {left}
                </Panel>
                <Separator className="w-1.5 shrink-0 bg-border hover:bg-primary/35 data-[separator=active]:bg-primary/50" />
                <Panel id={PANEL_IDS[1]} className="min-h-0 min-w-0" defaultSize="56%" minSize="32%">
                    {center}
                </Panel>
                <Separator className="w-1.5 shrink-0 bg-border hover:bg-primary/35 data-[separator=active]:bg-primary/50" />
                <Panel
                    id={PANEL_IDS[2]}
                    className="min-h-0 min-w-0"
                    defaultSize="22%"
                    minSize="14%"
                    maxSize="42%"
                >
                    {right}
                </Panel>
            </Group>
        </section>
    );
}
