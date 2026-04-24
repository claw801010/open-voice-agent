"use client";

import posthog from "posthog-js";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PostHogEvent } from "@/constants/posthog-events";
import { submitProductFeedback } from "@/lib/productFeedbackSubmit";

const MAX_LEN = 8000;

type WorkflowFeedbackDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    workflowId: number;
    /** Optional external URL (e.g. GitHub issues); shown as a secondary link in the dialog */
    externalFeedbackUrl?: string | null;
};

export function WorkflowFeedbackDialog({
    open,
    onOpenChange,
    workflowId,
    externalFeedbackUrl,
}: WorkflowFeedbackDialogProps) {
    const [message, setMessage] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const handleOpenChange = useCallback(
        (next: boolean) => {
            if (!next) setMessage("");
            onOpenChange(next);
        },
        [onOpenChange],
    );

    const handleSubmit = useCallback(async () => {
        const trimmed = message.trim();
        if (!trimmed) {
            toast.error("Please enter a message");
            return;
        }
        setSubmitting(true);
        const result = await submitProductFeedback({
            message: trimmed,
            workflowId,
            source: "workflow_editor",
        });
        setSubmitting(false);
        if (result.ok) {
            posthog.capture(PostHogEvent.FEEDBACK_IN_APP_SUBMITTED, {
                workflow_id: workflowId,
                feedback_id: result.id,
            });
            toast.success("Thanks — your feedback was sent.");
            handleOpenChange(false);
        } else {
            toast.error(result.error);
        }
    }, [message, workflowId, handleOpenChange]);

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Send feedback</DialogTitle>
                    <DialogDescription>
                        Tell us what is working, what is confusing, or what you would like next. Your account and
                        this workflow ID are stored with the message so we can follow up.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-2">
                    <Label htmlFor="workflow-feedback-message">Message</Label>
                    <Textarea
                        id="workflow-feedback-message"
                        value={message}
                        onChange={(e) => setMessage(e.target.value.slice(0, MAX_LEN))}
                        placeholder="Your feedback…"
                        rows={5}
                        className="resize-y min-h-[120px]"
                    />
                    <p className="text-xs text-muted-foreground">
                        {message.length}/{MAX_LEN} characters
                    </p>
                </div>
                <DialogFooter className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    {externalFeedbackUrl ? (
                        <a
                            href={externalFeedbackUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
                            onClick={() =>
                                posthog.capture(PostHogEvent.FEEDBACK_LINK_CLICKED, {
                                    workflow_id: workflowId,
                                    source: "workflow_feedback_dialog",
                                })
                            }
                        >
                            Open external form instead
                        </a>
                    ) : (
                        <div className="hidden sm:block sm:flex-1" aria-hidden />
                    )}
                    <div className="flex gap-2 sm:ml-auto">
                        <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="button" onClick={handleSubmit} disabled={submitting || !message.trim()}>
                            {submitting ? "Sending…" : "Send"}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
