'use client';

import { ReactNode, useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';

import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function parseToolUpdatePayloadJson(
    text: string
): { ok: true; data: unknown } | { ok: false; message: string } {
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Invalid JSON';
        return { ok: false, message: msg };
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { ok: false, message: 'Root value must be a JSON object (not an array).' };
    }
    const o = parsed as Record<string, unknown>;
    if (typeof o.name !== 'string') {
        return { ok: false, message: '`name` must be a string.' };
    }
    if (
        o.definition !== undefined &&
        (o.definition === null || typeof o.definition !== 'object' || Array.isArray(o.definition))
    ) {
        return { ok: false, message: '`definition` must be an object when present.' };
    }
    return { ok: true, data: parsed };
}

type UseToolFormRawTabsOptions = {
    getPendingPayload: () => unknown;
    applyPayload: (data: unknown) => void;
    formDirty: boolean;
};

/**
 * WE-01-DUALMODE for `/tools/[uuid]`: Form | Raw JSON with the same apply/save semantics as node dialogs.
 */
export function useToolFormRawTabs({ getPendingPayload, applyPayload, formDirty }: UseToolFormRawTabsOptions) {
    const [activeTab, setActiveTab] = useState<'form' | 'raw'>('form');
    const [rawText, setRawText] = useState('');
    const [rawParseError, setRawParseError] = useState<string | null>(null);
    const rawSnapshotRef = useRef('');

    const handleTabChange = useCallback(
        (value: string) => {
            if (value === 'raw') {
                const snap = JSON.stringify(getPendingPayload(), null, 2);
                rawSnapshotRef.current = snap;
                setRawText(snap);
                setRawParseError(null);
                setActiveTab('raw');
                return;
            }
            if (value === 'form' && activeTab === 'raw') {
                const result = parseToolUpdatePayloadJson(rawText);
                if (!result.ok) {
                    setRawParseError(result.message);
                    toast.error(`Invalid JSON — ${result.message}`);
                    return;
                }
                applyPayload(result.data);
                setRawParseError(null);
            }
            setActiveTab('form');
        },
        [activeTab, applyPayload, getPendingPayload, rawText]
    );

    const onRawChange = useCallback((next: string) => {
        setRawText(next);
        if (!next.trim()) {
            setRawParseError('JSON cannot be empty.');
            return;
        }
        const result = parseToolUpdatePayloadJson(next);
        setRawParseError(result.ok ? null : result.message);
    }, []);

    const rawDrift = activeTab === 'raw' && rawText !== rawSnapshotRef.current;
    const discardConfirmNeeded = formDirty || rawDrift;

    const wrapSave = useCallback(
        (save: () => void | Promise<void>) => {
            return () => {
                if (activeTab === 'raw') {
                    const result = parseToolUpdatePayloadJson(rawText);
                    if (!result.ok) {
                        setRawParseError(result.message);
                        toast.error(`Fix JSON before saving — ${result.message}`);
                        return;
                    }
                    applyPayload(result.data);
                    setRawParseError(null);
                }
                void save();
            };
        },
        [activeTab, applyPayload, rawText]
    );

    const renderFormRawTabs = (children: ReactNode) => (
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
                    Edit the full <strong className="text-foreground">PUT /tools/&#123;uuid&#125;</strong> body. Invalid JSON
                    blocks Save. Switching to <strong className="text-foreground">Form</strong> applies valid JSON to the
                    fields.
                </p>
                <Textarea
                    value={rawText}
                    onChange={(e) => onRawChange(e.target.value)}
                    className="font-mono text-sm min-h-[320px]"
                    spellCheck={false}
                    aria-invalid={Boolean(rawParseError)}
                />
                {rawParseError && (
                    <p className="text-xs text-destructive" role="alert">
                        {rawParseError}
                    </p>
                )}
            </TabsContent>
        </Tabs>
    );

    const saveBlocked = activeTab === 'raw' && Boolean(rawParseError);

    return { wrapSave, renderFormRawTabs, rawParseError, discardConfirmNeeded, saveBlocked };
}
