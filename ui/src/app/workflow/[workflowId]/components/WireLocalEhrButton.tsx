'use client';

import { Loader2, HeartPulse } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import { wireLocalEhrForWorkflow } from '@/lib/wireLocalEhr';

import { WireLocalActionHint } from './WireLocalActionHint';

type Props = {
    templateContextVariables: Record<string, string>;
    saveTemplateContextVariables: (vars: Record<string, string>) => Promise<void>;
    toolNames?: string[];
    size?: 'sm' | 'default';
    variant?: 'default' | 'secondary' | 'outline';
    hint?: string;
};

export function WireLocalEhrButton({
    templateContextVariables,
    saveTemplateContextVariables,
    toolNames,
    size = 'sm',
    variant = 'outline',
    hint,
}: Props) {
    const { getAccessToken } = useAuth();
    const [busy, setBusy] = useState(false);

    return (
        <WireLocalActionHint hint={hint}>
            <Button
                type="button"
                size={size}
                variant={variant}
                className="gap-1.5"
                disabled={busy}
                title={hint}
                data-testid="wire-local-ehr-button"
            onClick={async () => {
                setBusy(true);
                try {
                    const result = await wireLocalEhrForWorkflow({
                        getAccessToken,
                        templateContextVariables,
                        saveTemplateContextVariables,
                        toolNames,
                    });
                    const created =
                        result.createdToolNames.length > 0
                            ? ` · created ${result.createdToolNames.join(', ')}`
                            : '';
                    toast.success('Local EHR wired', {
                        description: `EHR API → ${result.baseUrl}${created}`,
                    });
                } catch (e) {
                    toast.error(e instanceof Error ? e.message : 'Could not wire local EHR');
                } finally {
                    setBusy(false);
                }
            }}
        >
            {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
                <HeartPulse className="h-3.5 w-3.5" aria-hidden />
            )}
            Wire local EHR
        </Button>
        </WireLocalActionHint>
    );
}
