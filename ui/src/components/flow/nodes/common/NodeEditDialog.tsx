import { AlertCircle, ExternalLink } from "lucide-react";
import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useWorkflowOptional } from "@/app/workflow/[workflowId]/contexts/WorkflowContext";
import { FlowNodeData } from "@/components/flow/types";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

/** WE-01-DUALMODE: edit full `data` payload as JSON without losing form state when switching tabs. */
export type NodeEditDialogDualMode = {
    getPendingData: () => FlowNodeData;
    applyData: (data: FlowNodeData) => void;
};

interface NodeEditDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    nodeData: FlowNodeData;
    title: string;
    children: ReactNode;
    onSave?: () => void;
    error?: string | null;
    isDirty?: boolean;
    documentationUrl?: string;
    /** When set, wraps children in **Form | Raw** tabs (JSON of `getPendingData()`). */
    dualMode?: NodeEditDialogDualMode;
}

function parseNodeDataJson(text: string): { ok: true; data: FlowNodeData } | { ok: false; message: string } {
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch (e) {
        const msg = e instanceof Error ? e.message : "Invalid JSON";
        return { ok: false, message: msg };
    }
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        return { ok: false, message: "Root value must be a JSON object (not an array)." };
    }
    return { ok: true, data: parsed as FlowNodeData };
}

export const NodeEditDialog = ({
    open,
    onOpenChange,
    nodeData,
    title,
    children,
    onSave,
    error,
    isDirty = false,
    documentationUrl,
    dualMode,
}: NodeEditDialogProps) => {
    const readOnly = useWorkflowOptional()?.readOnly ?? false;
    const [showDiscardAlert, setShowDiscardAlert] = useState(false);
    const [activeTab, setActiveTab] = useState<"form" | "raw">("form");
    const [rawText, setRawText] = useState("");
    const [rawParseError, setRawParseError] = useState<string | null>(null);
    const rawSnapshotRef = useRef("");

    const handleClose = () => onOpenChange(false);

    const handleSave = useCallback(() => {
        if (dualMode && activeTab === "raw") {
            const result = parseNodeDataJson(rawText);
            if (!result.ok) {
                setRawParseError(result.message);
                toast.error(`Fix JSON before saving — ${result.message}`);
                return;
            }
            dualMode.applyData(result.data);
            setRawParseError(null);
        }
        onSave?.();
    }, [dualMode, activeTab, rawText, onSave]);

    const discardConfirmNeeded =
        isDirty ||
        Boolean(dualMode && activeTab === "raw" && rawText !== rawSnapshotRef.current);

    useEffect(() => {
        if (!open) {
            setActiveTab("form");
            setRawText("");
            setRawParseError(null);
        }
    }, [open]);

    const handleTabChange = useCallback(
        (value: string) => {
            if (!dualMode) return;
            if (value === "raw") {
                const snap = JSON.stringify(dualMode.getPendingData(), null, 2);
                rawSnapshotRef.current = snap;
                setRawText(snap);
                setRawParseError(null);
                setActiveTab("raw");
                return;
            }
            if (value === "form" && activeTab === "raw") {
                const result = parseNodeDataJson(rawText);
                if (!result.ok) {
                    setRawParseError(result.message);
                    toast.error(`Invalid JSON — ${result.message}`);
                    return;
                }
                dualMode.applyData(result.data);
                setRawParseError(null);
            }
            setActiveTab("form");
        },
        [dualMode, activeTab, rawText],
    );

    const onRawChange = useCallback((next: string) => {
        setRawText(next);
        if (!next.trim()) {
            setRawParseError("JSON cannot be empty.");
            return;
        }
        const result = parseNodeDataJson(next);
        setRawParseError(result.ok ? null : result.message);
    }, []);

    // Intercept dialog close attempts when dirty
    const handleOpenChange = useCallback(
        (newOpen: boolean) => {
            if (!newOpen && discardConfirmNeeded) {
                setShowDiscardAlert(true);
                return;
            }
            onOpenChange(newOpen);
        },
        [discardConfirmNeeded, onOpenChange],
    );

    // Handle confirmed discard
    const handleConfirmDiscard = useCallback(() => {
        setShowDiscardAlert(false);
        onOpenChange(false);
    }, [onOpenChange]);

    // Handle Cmd+S / Ctrl+S keyboard shortcut to save
    useEffect(() => {
        if (!open || readOnly) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                e.preventDefault();
                e.stopImmediatePropagation();
                handleSave();
            }
        };

        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [open, readOnly, handleSave]);

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent
                className="max-h-[85vh] overflow-y-auto"
                style={{ maxWidth: "1200px", width: "95vw" }}
            >
                <DialogHeader>
                    <div className="flex items-center justify-between">
                        <DialogTitle>{title}</DialogTitle>
                        {documentationUrl && (
                            <a
                                href={documentationUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors pr-6"
                            >
                                Docs
                                <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                        )}
                    </div>
                    <DialogDescription>
                        Configure the settings for this node in your workflow.
                    </DialogDescription>
                    {nodeData.invalid && nodeData.validationMessage && (
                        <div className="mt-2 flex items-center gap-2 rounded-md bg-red-50 p-2 text-sm text-red-500 border border-red-200">
                            <AlertCircle className="h-4 w-4" />
                            <span>{nodeData.validationMessage}</span>
                        </div>
                    )}
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    {dualMode ? (
                        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                            <TabsList className="grid w-full max-w-md grid-cols-2">
                                <TabsTrigger value="form">Form</TabsTrigger>
                                <TabsTrigger value="raw">Raw JSON</TabsTrigger>
                            </TabsList>
                            <TabsContent value="form" className="mt-4 focus-visible:outline-none">
                                {children}
                            </TabsContent>
                            <TabsContent value="raw" className="mt-4 space-y-2 focus-visible:outline-none">
                                <p className="text-xs text-muted-foreground">
                                    Edit the full node <code className="text-foreground">data</code> object. Invalid JSON
                                    blocks Save. Switching to <strong className="text-foreground">Form</strong> applies
                                    valid JSON to the fields.
                                </p>
                                <Textarea
                                    value={rawText}
                                    onChange={(e) => onRawChange(e.target.value)}
                                    disabled={readOnly}
                                    spellCheck={false}
                                    className="min-h-[280px] font-mono text-xs leading-relaxed"
                                    aria-label="Raw node data as JSON"
                                    placeholder="{}"
                                />
                                {rawParseError ? (
                                    <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
                                        <span>{rawParseError}</span>
                                    </div>
                                ) : null}
                            </TabsContent>
                        </Tabs>
                    ) : (
                        children
                    )}
                </div>
                {error && (
                    <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-600 border border-red-200">
                        <AlertCircle className="h-4 w-4 flex-shrink-0" />
                        <span>{error}</span>
                    </div>
                )}
                <DialogFooter>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            onClick={discardConfirmNeeded ? () => setShowDiscardAlert(true) : handleClose}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={readOnly || Boolean(dualMode && activeTab === "raw" && rawParseError)}
                        >
                            {readOnly ? "Read Only" : "Save"}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>

            {/* Discard changes confirmation dialog */}
            <AlertDialog open={showDiscardAlert} onOpenChange={setShowDiscardAlert}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Discard changes?</AlertDialogTitle>
                        <AlertDialogDescription>
                            You have unsaved changes. Are you sure you want to discard them?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Keep Editing</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmDiscard}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Discard
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Dialog>
    );
};
