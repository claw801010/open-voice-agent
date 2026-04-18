import { Boxes, ClipboardCheck, ExternalLink, Globe, Headset, LayoutGrid, Link2, LucideIcon, OctagonX, Play, Webhook, X } from 'lucide-react';
import { useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { NodeType } from './types';

type NodeTypeConfig = {
    type: NodeType;
    label: string;
    description: string;
    icon: LucideIcon;
};

type AddNodePanelProps = {
    isOpen: boolean;
    onClose: () => void;
    onNodeSelect: (nodeType: NodeType) => void;
    /** Slide-over (default) or fixed left rail inside the workflow shell */
    variant?: 'overlay' | 'inline';
};

const NODE_TYPES: NodeTypeConfig[] = [
    {
        type: NodeType.START_CALL,
        label: 'Start Call',
        description: 'Create a start call node',
        icon: Play
    },
    {
        type: NodeType.AGENT_NODE,
        label: 'Agent Node',
        description: 'Create an agent node',
        icon: Headset
    },
    {
        type: NodeType.END_CALL,
        label: 'End Call',
        description: 'Create an end call node',
        icon: OctagonX
    }
];

const GLOBAL_NODE_TYPES: NodeTypeConfig[] = [
    {
        type: NodeType.GLOBAL_NODE,
        label: 'Global Node',
        description: 'Create a global node',
        icon: Globe
    }
];

const TRIGGER_NODE_TYPES: NodeTypeConfig[] = [
    {
        type: NodeType.TRIGGER,
        label: 'API Trigger',
        description: 'Enable API-based call triggering',
        icon: Webhook
    }
];

const INTEGRATION_NODE_TYPES: NodeTypeConfig[] = [
    {
        type: NodeType.WEBHOOK,
        label: 'Webhook',
        description: 'Send HTTP request after workflow completion',
        icon: Link2
    },
    {
        type: NodeType.QA,
        label: 'QA Analysis',
        description: 'Run LLM quality analysis after each call',
        icon: ClipboardCheck
    }
];

function NodeSection({
    title,
    nodes,
    onNodeSelect
}: {
    title: string;
    nodes: NodeTypeConfig[];
    onNodeSelect: (nodeType: NodeType) => void;
}) {
    return (
        <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {title}
            </h3>
            <div className="space-y-2">
                {nodes.map((node) => (
                    <Button
                        key={node.type}
                        variant="outline"
                        className="w-full justify-start p-4 h-auto hover:bg-accent/50 transition-colors"
                        onClick={() => onNodeSelect(node.type)}
                    >
                        <div className="flex items-center">
                            <div className="bg-muted p-2 rounded-lg mr-3 border border-border">
                                <node.icon className="h-5 w-5" />
                            </div>
                            <div className="flex flex-col items-start text-left min-w-0">
                                <span className="font-medium text-sm">{node.label}</span>
                                <span className="text-xs text-muted-foreground whitespace-normal">
                                    {node.description}
                                </span>
                            </div>
                        </div>
                    </Button>
                ))}
            </div>
        </div>
    );
}

/** Core call-flow nodes (WE-01-PALETTE — Nodes tab). */
function PaletteNodesTab({ onNodeSelect }: { onNodeSelect: (nodeType: NodeType) => void }) {
    return (
        <div className="space-y-6">
            <NodeSection title="Triggers" nodes={TRIGGER_NODE_TYPES} onNodeSelect={onNodeSelect} />
            <NodeSection title="Conversation" nodes={NODE_TYPES} onNodeSelect={onNodeSelect} />
        </div>
    );
}

/** Global + integration nodes (WE-01-PALETTE — Components tab). Subflow components track under WE-01-SUBFLOWS. */
function PaletteComponentsTab({ onNodeSelect }: { onNodeSelect: (nodeType: NodeType) => void }) {
    return (
        <div className="space-y-6">
            <NodeSection title="Global" nodes={GLOBAL_NODE_TYPES} onNodeSelect={onNodeSelect} />
            <NodeSection title="Integrations" nodes={INTEGRATION_NODE_TYPES} onNodeSelect={onNodeSelect} />
            <p className="text-xs text-muted-foreground border-t border-border pt-3">
                Reusable subflow components on the canvas are planned under{' '}
                <span className="font-mono text-[0.7rem]">WE-01-SUBFLOWS</span>.
            </p>
        </div>
    );
}

function PaletteTabs({ onNodeSelect, listClassName }: { onNodeSelect: (nodeType: NodeType) => void; listClassName?: string }) {
    return (
        <Tabs defaultValue="nodes" className="flex min-h-0 flex-1 flex-col gap-0">
            <TabsList className={listClassName ?? 'mx-3 mt-2 grid w-[calc(100%-1.5rem)] grid-cols-2 shrink-0'}>
                <TabsTrigger value="nodes" className="gap-1.5">
                    <LayoutGrid className="size-3.5 opacity-70" aria-hidden />
                    Nodes
                </TabsTrigger>
                <TabsTrigger value="components" className="gap-1.5">
                    <Boxes className="size-3.5 opacity-70" aria-hidden />
                    Components
                </TabsTrigger>
            </TabsList>
            <TabsContent value="nodes" className="mt-0 min-h-0 flex-1 overflow-y-auto p-3">
                <PaletteNodesTab onNodeSelect={onNodeSelect} />
            </TabsContent>
            <TabsContent value="components" className="mt-0 min-h-0 flex-1 overflow-y-auto p-3">
                <PaletteComponentsTab onNodeSelect={onNodeSelect} />
            </TabsContent>
        </Tabs>
    );
}

export default function AddNodePanel({
    isOpen,
    onNodeSelect,
    onClose,
    variant = 'overlay',
}: AddNodePanelProps) {
    useEffect(() => {
        if (variant !== 'overlay') return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && isOpen) {
                onClose();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose, variant]);

    if (variant === 'inline') {
        return (
            <div className="flex h-full min-h-0 flex-col bg-background">
                <div className="shrink-0 border-b border-border px-3 py-2">
                    <div className="flex flex-col gap-1">
                        <h2 className="text-sm font-semibold">Palette</h2>
                        <a
                            href="https://docs.dograh.com/voice-agent/introduction"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
                        >
                            <ExternalLink className="w-3 h-3 shrink-0" />
                            View nodes documentation
                        </a>
                    </div>
                </div>
                <PaletteTabs onNodeSelect={onNodeSelect} />
            </div>
        );
    }

    return (
        <div
            className={`fixed z-50 right-0 top-0 h-full w-80 bg-background shadow-lg transform transition-transform duration-300 ease-in-out ${
                isOpen ? 'translate-x-0' : 'translate-x-full'
            }`}
        >
            <div className="flex h-full min-h-0 flex-col overflow-hidden p-4">
                <div className="flex justify-between items-center mb-2 shrink-0">
                    <div className="flex flex-col gap-1">
                        <h2 className="text-lg font-semibold">Palette</h2>
                        <a
                            href="https://docs.dograh.com/voice-agent/introduction"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
                        >
                            <ExternalLink className="w-3 h-3" />
                            View Nodes Documentation
                        </a>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose}>
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                <PaletteTabs onNodeSelect={onNodeSelect} listClassName="mb-2 grid w-full grid-cols-2 shrink-0" />
            </div>
        </div>
    );
}
