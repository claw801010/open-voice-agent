'use client';

import { Import } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

import { ImportExternalWorkflowDialog } from './ImportExternalWorkflowDialog';

type Props = {
    variant?: 'default' | 'outline' | 'secondary' | 'ghost';
    size?: 'default' | 'sm' | 'lg' | 'icon';
};

export function ImportExternalWorkflowButton({ variant = 'outline', size = 'default' }: Props) {
    const [open, setOpen] = useState(false);

    return (
        <>
            <Button type="button" variant={variant} size={size} onClick={() => setOpen(true)}>
                <Import className="w-4 h-4 mr-2" />
                Import external
            </Button>
            <ImportExternalWorkflowDialog open={open} onOpenChange={setOpen} />
        </>
    );
}
