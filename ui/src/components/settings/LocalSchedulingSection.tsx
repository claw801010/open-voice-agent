'use client';

import { CalendarPlus, ExternalLink, Wrench } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { createToolApiV1ToolsPost } from '@/client/sdk.gen';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/lib/auth';
import { buildLocalBookSlotToolDefinition } from '@/lib/localSchedulingBookSlotTool';
import {
    bookLocalAppointmentDemo,
    cancelLocalAppointment,
    fetchLocalAppointments,
    fetchLocalSchedulingConfig,
    type LocalAppointmentRow,
    type LocalSchedulingConfig,
} from '@/lib/localSchedulingApi';

export function LocalSchedulingSection() {
    const { getAccessToken } = useAuth();
    const [config, setConfig] = useState<LocalSchedulingConfig | null>(null);
    const [appointments, setAppointments] = useState<LocalAppointmentRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [creatingTool, setCreatingTool] = useState(false);
    const [demoPatient, setDemoPatient] = useState('Demo patient');
    const [demoSlot, setDemoSlot] = useState(() => {
        const d = new Date();
        d.setUTCHours(15, 0, 0, 0);
        return d.toISOString();
    });

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const cfg = await fetchLocalSchedulingConfig();
            setConfig(cfg);
            if (cfg.enabled) {
                const token = await getAccessToken();
                const rows = await fetchLocalAppointments(token);
                setAppointments(rows);
            } else {
                setAppointments([]);
            }
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Could not load local calendar');
        } finally {
            setLoading(false);
        }
    }, [getAccessToken]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const handleCreateBookSlotTool = async () => {
        if (!config?.book_slot_url) return;
        setCreatingTool(true);
        try {
            const token = await getAccessToken();
            const response = await createToolApiV1ToolsPost({
                body: {
                    name: 'book_slot',
                    description:
                        'Local demo calendar — books a slot and returns appointment_id for analytics proof.',
                    category: 'http_api',
                    icon: 'globe',
                    icon_color: '#3B82F6',
                    definition: buildLocalBookSlotToolDefinition(config.book_slot_url),
                },
                headers: { Authorization: `Bearer ${token}` },
            });
            if (response.data?.tool_uuid) {
                toast.success('Created book_slot HTTP tool');
                window.open(`/tools/${response.data.tool_uuid}`, '_blank', 'noopener,noreferrer');
            }
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Failed to create tool');
        } finally {
            setCreatingTool(false);
        }
    };

    const handleDemoBook = async () => {
        try {
            const token = await getAccessToken();
            await bookLocalAppointmentDemo(token, {
                slot_start: demoSlot,
                patient_name: demoPatient,
                visit_type: 'general',
            });
            toast.success('Demo appointment booked');
            await refresh();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Booking failed');
        }
    };

    if (loading) {
        return <p className="text-sm text-muted-foreground">Loading local calendar…</p>;
    }

    if (!config?.enabled) {
        return (
            <p className="text-sm text-muted-foreground leading-snug">
                Local demo calendar is off. Set{' '}
                <code className="rounded bg-muted px-1 text-xs">ENABLE_LOCAL_SCHEDULING=true</code> in{' '}
                <code className="rounded bg-muted px-1 text-xs">api/.env</code> (defaults on in{' '}
                <code className="rounded bg-muted px-1 text-xs">ENVIRONMENT=local</code>) and restart the API.
            </p>
        );
    }

    return (
        <div className="space-y-4 text-sm">
            <p className="text-muted-foreground leading-snug">
                Run booking demos without an external scheduler. Point catalog template variables at{' '}
                <code className="rounded bg-muted px-1 text-xs">scheduling_api_base_url</code> = base URL above,
                attach the <strong className="text-foreground">book_slot</strong> tool, and map responses for analytics.
            </p>
            <div className="rounded-md border border-border bg-muted/30 p-3 space-y-1 text-xs font-mono break-all">
                <p>
                    <span className="text-muted-foreground">POST </span>
                    {config.book_slot_url}
                </p>
                <p>
                    <span className="text-muted-foreground">GET </span>
                    {config.lookup_availability_url}?date=YYYY-MM-DD
                </p>
            </div>
            <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" className="gap-1.5" disabled={creatingTool} onClick={handleCreateBookSlotTool}>
                    <Wrench className="h-4 w-4" aria-hidden />
                    {creatingTool ? 'Creating…' : 'Create book_slot HTTP tool'}
                </Button>
                <Button type="button" size="sm" variant="secondary" className="gap-1.5" asChild>
                    <Link href="/workflow/catalog">
                        <CalendarPlus className="h-4 w-4" aria-hidden />
                        Template catalog
                    </Link>
                </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 border-t border-border pt-4">
                <div className="space-y-1.5">
                    <Label htmlFor="demo-slot">Demo slot (ISO UTC)</Label>
                    <Input id="demo-slot" value={demoSlot} onChange={(e) => setDemoSlot(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="demo-patient">Patient name</Label>
                    <Input id="demo-patient" value={demoPatient} onChange={(e) => setDemoPatient(e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                    <Button type="button" variant="outline" size="sm" onClick={handleDemoBook}>
                        Book demo appointment
                    </Button>
                </div>
            </div>
            <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    Appointments ({appointments.length})
                </h3>
                {appointments.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No appointments yet — book via demo or a voice HTTP tool.</p>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>When</TableHead>
                                <TableHead>Patient</TableHead>
                                <TableHead>Code</TableHead>
                                <TableHead />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {appointments.map((a) => (
                                <TableRow key={a.id}>
                                    <TableCell className="font-mono text-xs">{a.slot_start}</TableCell>
                                    <TableCell>{a.patient_name}</TableCell>
                                    <TableCell>{a.confirmation_code}</TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={async () => {
                                                try {
                                                    const token = await getAccessToken();
                                                    await cancelLocalAppointment(token, a.id);
                                                    toast.success('Cancelled');
                                                    await refresh();
                                                } catch (e) {
                                                    toast.error(
                                                        e instanceof Error ? e.message : 'Cancel failed',
                                                    );
                                                }
                                            }}
                                        >
                                            Cancel
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </div>
            <a
                href="https://docs.dograh.com/voice-agent/tools/http-api"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
                HTTP tool docs <ExternalLink className="h-3 w-3" />
            </a>
        </div>
    );
}
