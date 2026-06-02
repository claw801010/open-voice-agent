'use client';

import { Loader2, MessageSquare } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import { wireLocalMessagingForWorkflow } from '@/lib/wireLocalMessaging';

type Props = {
    templateContextVariables: Record<string, string>;
    saveTemplateContextVariables: (vars: Record<string, string>) => Promise<void>;
    toolNames?: string[];
    size?: 'sm' | 'default';
    variant?: 'default' | 'secondary' | 'outline';
};

export function WireLocalMessagingButton({
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
            data-testid="wire-local-messaging-button"
            onClick={async () => {
                setBusy(true);
                try {
                    const result = await wireLocalMessagingForWorkflow({
                        getAccessToken,
                        templateContextVariables,
                        saveTemplateContextVariables,
                        toolNames,
                    });
                    const created =
                        result.createdToolNames.length > 0
                            ? ` · created ${result.createdToolNames.join(', ')}`
                            : '';
                    toast.success('Local messaging wired', {
                        description: `Messaging API → ${result.baseUrl}${created}`,
                    });
                } catch (e) {
                    toast.error(e instanceof Error ? e.message : 'Could not wire local messaging');
                } finally {
                    setBusy(false);
                }
            }}
        >
            {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
                <MessageSquare className="h-3.5 w-3.5" aria-hidden />
            )}
            Wire local messaging
        </Button>
    );
}
