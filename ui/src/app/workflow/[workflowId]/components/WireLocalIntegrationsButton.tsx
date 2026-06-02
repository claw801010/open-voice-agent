'use client';

import { Loader2, Plug } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import { wireLocalIntegrationsForWorkflow } from '@/lib/wireLocalIntegrations';

type Props = {
    templateContextVariables: Record<string, string>;
    saveTemplateContextVariables: (vars: Record<string, string>) => Promise<void>;
    toolNames?: string[];
    size?: 'sm' | 'default';
    variant?: 'default' | 'secondary' | 'outline';
};

export function WireLocalIntegrationsButton({
    templateContextVariables,
    saveTemplateContextVariables,
    toolNames,
    size = 'sm',
    variant = 'outline',
}: Props) {
    const { getAccessToken } = useAuth();
    const [busy, setBusy] = useState(false);

    return (
        <Button
            type="button"
            size={size}
            variant={variant}
            className="gap-1.5"
            disabled={busy}
            data-testid="wire-local-integrations-button"
            onClick={async () => {
                setBusy(true);
                try {
                    const result = await wireLocalIntegrationsForWorkflow({
                        getAccessToken,
                        templateContextVariables,
                        saveTemplateContextVariables,
                        toolNames,
                    });
                    const created =
                        result.createdToolNames.length > 0
                            ? ` · created ${result.createdToolNames.join(', ')}`
                            : '';
                    toast.success('Local integrations wired', {
                        description: `API URLs → ${result.baseUrl}${created}`,
                    });
                } catch (e) {
                    toast.error(e instanceof Error ? e.message : 'Could not wire local integrations');
                } finally {
                    setBusy(false);
                }
            }}
        >
            {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
                <Plug className="h-3.5 w-3.5" aria-hidden />
            )}
            Wire local integrations
        </Button>
    );
}
