/**
 * WE-01 workflow authoring — creation paths with best-practice copy (GTM + get-started hub).
 */
import type { LucideIcon } from 'lucide-react';
import { Bot, Import, LayoutTemplate, Store } from 'lucide-react';

export type WorkflowCreationOptionId = 'catalog' | 'builder' | 'import' | 'blank';

export type WorkflowCreationOption = {
    id: WorkflowCreationOptionId;
    title: string;
    subtitle: string;
    bestPractice: string;
    href?: string;
    icon: LucideIcon;
    recommended?: boolean;
};

export const WORKFLOW_CREATION_OPTIONS: WorkflowCreationOption[] = [
    {
        id: 'builder',
        title: 'Agent Builder (AI)',
        subtitle: 'Describe your use case — AI drafts the full graph',
        bestPractice:
            'Fastest path when you know the goal but not the node layout. Review tools and variables, then Web test before publish.',
        href: '/workflow/create',
        icon: Bot,
        recommended: true,
    },
    {
        id: 'catalog',
        title: 'Template catalog',
        subtitle: 'Install a vertical pack with runbook + sample variables',
        bestPractice:
            'Best for industry runbooks, local stubs, and analytics-friendly HTTP proof out of the box.',
        href: '/workflow/catalog',
        icon: Store,
        recommended: true,
    },
    {
        id: 'import',
        title: 'Import external flow',
        subtitle: 'n8n, Make, Zapier, or SKILL.md → voice draft',
        bestPractice:
            'Use strict import for HTTP-only graphs; wire HTTP tools manually and map response fields for analytics proof.',
        icon: Import,
    },
    {
        id: 'blank',
        title: 'Blank canvas',
        subtitle: 'Start from an empty graph',
        bestPractice:
            'Add Start → Agent → End, attach HTTP tools, test in Simulation, then publish when validation is clean.',
        icon: LayoutTemplate,
    },
];

export const WORKFLOW_EDITOR_BEST_PRACTICES = [
    'Install a catalog pack when you need industry runbooks, template variables, and HTTP proof examples out of the box.',
    'Attach HTTP API tools on the Agent (or Start) node; map response fields so Call analytics shows mapped_data.',
    'Save before Web test — Simulation uses the last saved graph.',
    'Publish only after the header validation popover is clear.',
] as const;
