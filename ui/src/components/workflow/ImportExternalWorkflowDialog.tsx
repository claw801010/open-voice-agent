'use client';

import { FileInput, Import } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useId, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import logger from '@/lib/logger';
import { getRandomId } from '@/lib/utils';
import {
    importWorkflowFromVendor,
    parseImportJsonText,
    type WorkflowImportVendor,
    vendorAcceptsMarkdown,
    vendorFileAccept,
} from '@/lib/workflowImportApi';

const VENDOR_LABELS: Record<WorkflowImportVendor, string> = {
    n8n: 'n8n',
    make: 'Make.com',
    zapier: 'Zapier',
    skill: 'Agent skill (SKILL.md)',
};

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

export function ImportExternalWorkflowDialog({ open, onOpenChange }: Props) {
    const router = useRouter();
    const fileInputId = useId();

    const [vendor, setVendor] = useState<WorkflowImportVendor>('n8n');
    const [name, setName] = useState('');
    const [text, setText] = useState('');
    const [strictHttpOnly, setStrictHttpOnly] = useState(false);
    const [emitBranches, setEmitBranches] = useState(true);
    const [isImporting, setIsImporting] = useState(false);
    const [lastWarnings, setLastWarnings] = useState<string[] | null>(null);

    const resetForm = useCallback(() => {
        setName(`Imported-${getRandomId()}`);
        setText('');
        setStrictHttpOnly(false);
        setEmitBranches(true);
        setLastWarnings(null);
    }, []);

    const handleOpenChange = useCallback(
        (next: boolean) => {
            if (next) {
                resetForm();
            }
            onOpenChange(next);
        },
        [onOpenChange, resetForm],
    );

    const loadFile = useCallback(async (file: File) => {
        const content = await file.text();
        setText(content);
        if (!name.trim()) {
            const base = file.name.replace(/\.[^.]+$/, '');
            setName(base.slice(0, 120) || `Imported-${getRandomId()}`);
        }
    }, [name]);

    const handleImport = useCallback(async () => {
        const workflowName = name.trim() || `Imported-${getRandomId()}`;
        if (!text.trim()) {
            toast.error('Paste export JSON or upload a file first.');
            return;
        }

        setIsImporting(true);
        setLastWarnings(null);
        try {
            const payload = vendorAcceptsMarkdown(vendor) ? text : parseImportJsonText(text);
            const result = await importWorkflowFromVendor(vendor, {
                name: workflowName,
                payload,
                options: {
                    strictHttpOnly,
                    emitBranchSubflows: emitBranches,
                },
            });
            setLastWarnings(result.warnings);
            if (result.warnings.length > 0) {
                toast.message(`Imported with ${result.warnings.length} note(s)`, {
                    description: result.warnings[0]?.slice(0, 160),
                });
            } else {
                toast.success('Workflow imported');
            }
            if (result.suggestedTemplateVariables?.length) {
                toast.info('Suggested template variables', {
                    description: result.suggestedTemplateVariables.join(', '),
                });
            }
            onOpenChange(false);
            router.push(`/workflow/${result.id}`);
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Import failed';
            toast.error(msg);
            logger.error(`External workflow import: ${err}`);
        } finally {
            setIsImporting(false);
        }
    }, [
        emitBranches,
        name,
        onOpenChange,
        router,
        strictHttpOnly,
        text,
        vendor,
    ]);

    const isSkill = vendor === 'skill';

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Import external flow</DialogTitle>
                    <DialogDescription>
                        Convert n8n, Make, or Zapier exports (or paste a SKILL.md) into a voice
                        workflow draft. HTTP tools are still wired manually in the editor.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label htmlFor="import-vendor">Source</Label>
                        <Select
                            value={vendor}
                            onValueChange={(v) => setVendor(v as WorkflowImportVendor)}
                        >
                            <SelectTrigger id="import-vendor">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {(Object.keys(VENDOR_LABELS) as WorkflowImportVendor[]).map((v) => (
                                    <SelectItem key={v} value={v}>
                                        {VENDOR_LABELS[v]}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="import-name">Workflow name</Label>
                        <Input
                            id="import-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder={`Imported-${getRandomId()}`}
                        />
                    </div>

                    {!isSkill ? (
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                            <div className="flex items-center gap-2">
                                <Checkbox
                                    id="import-strict"
                                    checked={strictHttpOnly}
                                    onCheckedChange={(c) => setStrictHttpOnly(c === true)}
                                />
                                <Label htmlFor="import-strict" className="text-sm font-normal">
                                    Strict (HTTP + branch nodes only)
                                </Label>
                            </div>
                            <div className="flex items-center gap-2">
                                <Checkbox
                                    id="import-branches"
                                    checked={emitBranches}
                                    onCheckedChange={(c) => setEmitBranches(c === true)}
                                />
                                <Label htmlFor="import-branches" className="text-sm font-normal">
                                    Map branches to subflows
                                </Label>
                            </div>
                        </div>
                    ) : null}

                    <div className="space-y-2">
                        <Label htmlFor="import-text">
                            {isSkill ? 'Skill markdown' : 'Export JSON'}
                        </Label>
                        <Textarea
                            id="import-text"
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            rows={8}
                            className="font-mono text-xs"
                            placeholder={
                                isSkill
                                    ? '# My skill\n\nUse {{patient_name}} when…'
                                    : '{ "nodes": [ … ] } or { "flow": [ … ] }'
                            }
                        />
                    </div>

                    <div>
                        <input
                            id={fileInputId}
                            type="file"
                            accept={vendorFileAccept(vendor)}
                            className="hidden"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                    void loadFile(file);
                                }
                            }}
                        />
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => document.getElementById(fileInputId)?.click()}
                        >
                            <FileInput className="w-4 h-4 mr-2" />
                            Load file
                        </Button>
                    </div>

                    {lastWarnings && lastWarnings.length > 0 ? (
                        <div className="rounded-md border bg-muted/50 p-3 text-sm">
                            <p className="font-medium mb-1">Import notes</p>
                            <ul className="list-disc pl-4 space-y-1">
                                {lastWarnings.slice(0, 5).map((w) => (
                                    <li key={w}>{w}</li>
                                ))}
                            </ul>
                        </div>
                    ) : null}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isImporting}>
                        Cancel
                    </Button>
                    <Button onClick={() => void handleImport()} disabled={isImporting}>
                        <Import className="w-4 h-4 mr-2" />
                        {isImporting ? 'Importing…' : 'Import & open editor'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
