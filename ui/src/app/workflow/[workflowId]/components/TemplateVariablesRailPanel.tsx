'use client';

import { CheckIcon, PencilIcon, Trash2Icon, Variable, XIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SETTINGS_DOCUMENTATION_URLS } from '@/constants/documentation';

type TemplateVariablesRailPanelProps = {
    templateContextVariables: Record<string, string>;
    onSave: (variables: Record<string, string>) => Promise<void>;
    readOnly?: boolean;
};

/**
 * Compact template variables editor for the right rail (WE-01-RIGHT-INSPECTOR).
 * Uses the same save path as the full settings page (`saveTemplateContextVariables`).
 */
export function TemplateVariablesRailPanel({
    templateContextVariables,
    onSave,
    readOnly = false,
}: TemplateVariablesRailPanelProps) {
    const [contextVars, setContextVars] = useState<Record<string, string>>(templateContextVariables);
    const [newKey, setNewKey] = useState('');
    const [newValue, setNewValue] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [editingDraftKey, setEditingDraftKey] = useState('');
    const [editingDraftValue, setEditingDraftValue] = useState('');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        setContextVars(templateContextVariables);
    }, [templateContextVariables]);

    const isDirty = useMemo(() => {
        const pendingVars = newKey && newValue ? { ...contextVars, [newKey]: newValue } : contextVars;
        return JSON.stringify(pendingVars) !== JSON.stringify(templateContextVariables);
    }, [contextVars, newKey, newValue, templateContextVariables]);

    const handleAdd = () => {
        const trimmedKey = newKey.trim();
        if (!trimmedKey || !newValue) {
            return;
        }
        if (contextVars[trimmedKey] !== undefined) {
            setErrorMessage(`Variable "${trimmedKey}" already exists.`);
            return;
        }
        setErrorMessage(null);
        setContextVars((prev) => ({ ...prev, [trimmedKey]: newValue }));
        setNewKey('');
        setNewValue('');
    };

    const handleRemove = (key: string) => {
        setErrorMessage(null);
        setContextVars((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
        if (editingKey === key) {
            setEditingKey(null);
            setEditingDraftKey('');
            setEditingDraftValue('');
        }
    };

    const handleStartEdit = (key: string, value: string) => {
        setErrorMessage(null);
        setEditingKey(key);
        setEditingDraftKey(key);
        setEditingDraftValue(value);
    };

    const handleCancelEdit = () => {
        setEditingKey(null);
        setEditingDraftKey('');
        setEditingDraftValue('');
        setErrorMessage(null);
    };

    const handleApplyEdit = () => {
        if (!editingKey) {
            return;
        }
        const nextKey = editingDraftKey.trim();
        if (!nextKey) {
            setErrorMessage('Variable key cannot be empty.');
            return;
        }
        if (nextKey !== editingKey && contextVars[nextKey] !== undefined) {
            setErrorMessage(`Variable "${nextKey}" already exists.`);
            return;
        }
        setErrorMessage(null);
        setContextVars((prev) => {
            const next = { ...prev };
            delete next[editingKey];
            next[nextKey] = editingDraftValue;
            return next;
        });
        setEditingKey(null);
        setEditingDraftKey('');
        setEditingDraftValue('');
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            let varsToSave = contextVars;
            if (newKey && newValue) {
                varsToSave = { ...varsToSave, [newKey]: newValue };
            }
            await onSave(varsToSave);
            setNewKey('');
            setNewValue('');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-3">
            <div className="flex items-start gap-2">
                <Variable className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
                <div>
                    <h3 className="text-xs font-semibold">Template variables</h3>
                    <p className="text-[11px] text-muted-foreground leading-snug">
                        Use <code className="rounded bg-muted px-0.5">{`{{name}}`}</code> in prompts.{' '}
                        <a
                            href={SETTINGS_DOCUMENTATION_URLS.templateVariables}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline"
                        >
                            Docs
                        </a>
                    </p>
                </div>
            </div>

            {Object.entries(contextVars).length > 0 && (
                <ul className="space-y-1.5 max-h-40 overflow-y-auto">
                    {Object.entries(contextVars).map(([key, value]) => (
                        <li
                            key={key}
                            className="flex items-start gap-1 rounded border border-border bg-background/80 px-2 py-1.5 text-[11px]"
                        >
                            {editingKey === key && !readOnly ? (
                                <>
                                    <div className="min-w-0 flex-1 space-y-1">
                                        <Input
                                            value={editingDraftKey}
                                            onChange={(e) => setEditingDraftKey(e.target.value)}
                                            className="h-7 text-[11px]"
                                            placeholder="Key"
                                        />
                                        <Input
                                            value={editingDraftValue}
                                            onChange={(e) => setEditingDraftValue(e.target.value)}
                                            className="h-7 text-[11px]"
                                            placeholder="Value"
                                        />
                                    </div>
                                    <div className="flex shrink-0 gap-0.5">
                                        <Button
                                            type="button"
                                            size="icon"
                                            variant="ghost"
                                            className="h-7 w-7"
                                            onClick={handleApplyEdit}
                                            aria-label={`Save ${key}`}
                                        >
                                            <CheckIcon className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                            type="button"
                                            size="icon"
                                            variant="ghost"
                                            className="h-7 w-7"
                                            onClick={handleCancelEdit}
                                            aria-label={`Cancel editing ${key}`}
                                        >
                                            <XIcon className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="min-w-0 flex-1">
                                        <div className="font-medium truncate">{key}</div>
                                        <div className="text-muted-foreground break-all line-clamp-2">{value}</div>
                                    </div>
                                    {!readOnly && (
                                        <div className="flex shrink-0 gap-0.5">
                                            <Button
                                                type="button"
                                                size="icon"
                                                variant="ghost"
                                                className="h-7 w-7"
                                                onClick={() => handleStartEdit(key, value)}
                                                aria-label={`Edit ${key}`}
                                            >
                                                <PencilIcon className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button
                                                type="button"
                                                size="icon"
                                                variant="ghost"
                                                className="h-7 w-7"
                                                onClick={() => handleRemove(key)}
                                                aria-label={`Remove ${key}`}
                                            >
                                                <Trash2Icon className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    )}
                                </>
                            )}
                        </li>
                    ))}
                </ul>
            )}

            {!readOnly && (
                <div className="space-y-2 border-t border-border pt-2">
                    <Label className="text-[11px]">Add variable</Label>
                    <Input
                        placeholder="Key"
                        value={newKey}
                        onChange={(e) => setNewKey(e.target.value)}
                        className="h-8 text-xs"
                    />
                    <Input
                        placeholder="Value"
                        value={newValue}
                        onChange={(e) => setNewValue(e.target.value)}
                        className="h-8 text-xs"
                    />
                    <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="w-full h-8 text-xs"
                        onClick={handleAdd}
                        disabled={!newKey || !newValue}
                    >
                        Add
                    </Button>
                    {errorMessage ? (
                        <p className="text-[11px] text-destructive" role="status">
                            {errorMessage}
                        </p>
                    ) : null}
                    <Button
                        type="button"
                        size="sm"
                        className="w-full"
                        onClick={handleSave}
                        disabled={isSaving || !isDirty}
                    >
                        {isSaving ? 'Saving…' : 'Save variables'}
                    </Button>
                </div>
            )}
        </div>
    );
}
