'use client';

import { CalendarCheck, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import { wireLocalCalendarForWorkflow } from '@/lib/wireLocalCalendar';

type Props = {
    templateContextVariables: Record<string, string>;
    saveTemplateContextVariables: (vars: Record<string, string>) => Promise<void>;
    size?: 'sm' | 'default';
    variant?: 'default' | 'secondary' | 'outline';
};

export function WireLocalCalendarButton({
    templateContextVariables,
    saveTemplateContextVariables,
    size = 'sm',
    variant = 'secondary',
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
            onClick={async () => {
                setBusy(true);
                try {
                    const result = await wireLocalCalendarForWorkflow({
                        getAccessToken,
                        templateContextVariables,
                        saveTemplateContextVariables,
                    });
                    toast.success('Local calendar wired', {
                        description: result.toolUuid
                            ? `scheduling_api_base_url set · book_slot tool ready`
                            : `scheduling_api_base_url set to ${result.baseUrl}`,
                    });
                } catch (e) {
                    toast.error(e instanceof Error ? e.message : 'Could not wire local calendar');
                } finally {
                    setBusy(false);
                }
            }}
        >
            {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
                <CalendarCheck className="h-3.5 w-3.5" aria-hidden />
            )}
            Wire local calendar
        </Button>
    );
}
