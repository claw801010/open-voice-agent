'use client';

import type { ReactNode } from 'react';
import { Group, Panel, Separator, useDefaultLayout } from 'react-resizable-panels';

const PANEL_IDS = ['workflow-palette', 'workflow-canvas', 'workflow-rail'] as const;

export type WorkflowEditorShellProps = {
    workflowId: number;
    left: ReactNode;
    center: ReactNode;
    right: ReactNode;
};

/**
 * Three-column resizable layout: palette | canvas | inspector rail.
 * Layout is persisted per workflow in localStorage (WE-01-SHELL).
 */
export function WorkflowEditorShell({ workflowId, left, center, right }: WorkflowEditorShellProps) {
    const layoutId = `workflow-editor-${workflowId}`;
    const { defaultLayout, onLayoutChanged } = useDefaultLayout({
        id: layoutId,
        storage: localStorage,
        panelIds: [...PANEL_IDS],
    });

    return (
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
    );
}
