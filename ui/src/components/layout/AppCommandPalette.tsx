'use client';

import { Copy, RefreshCw, Search } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { APP_NAV_COMMANDS } from '@/lib/appNavigationCommands';
import { APP_PALETTE_ACTIONS } from '@/lib/appPaletteActions';
import { cn } from '@/lib/utils';

/** Dispatched to open the palette from header buttons etc. */
export const COMMAND_PALETTE_OPEN_EVENT = 'dograh:command-palette-open';

function isTypingTarget(el: EventTarget | null): boolean {
    if (!el || !(el instanceof HTMLElement)) return false;
    const tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (el.isContentEditable) return true;
    if (el.closest('[role="combobox"]')) return true;
    return false;
}

function matchesQuery(q: string, title: string, group: string, keywords?: string[]): boolean {
    if (!q) return true;
    const blob = [title, group, ...(keywords ?? [])].join(' ').toLowerCase();
    return blob.includes(q);
}

export function AppCommandPalette() {
    const router = useRouter();
    const pathname = usePathname();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    const q = query.trim().toLowerCase();

    const filteredActions = useMemo(
        () => APP_PALETTE_ACTIONS.filter((a) => matchesQuery(q, a.title, a.group, a.keywords)),
        [q],
    );

    const filteredNav = useMemo(
        () =>
            APP_NAV_COMMANDS.filter((c) => {
                const blob = [c.title, c.group, c.href, ...(c.keywords ?? [])].join(' ').toLowerCase();
                return !q || blob.includes(q);
            }),
        [q],
    );

    const toggle = useCallback(() => {
        setOpen((o) => !o);
    }, []);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== 'k' || !(e.metaKey || e.ctrlKey)) return;
            if (isTypingTarget(e.target) && !open) return;
            e.preventDefault();
            toggle();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, toggle]);

    useEffect(() => {
        const openEvt = () => setOpen(true);
        window.addEventListener(COMMAND_PALETTE_OPEN_EVENT, openEvt);
        return () => window.removeEventListener(COMMAND_PALETTE_OPEN_EVENT, openEvt);
    }, []);

    useEffect(() => {
        if (!open) setQuery('');
    }, [open]);

    const onSelect = useCallback(
        (href: string) => {
            setOpen(false);
            router.push(href);
        },
        [router],
    );

    const runAction = useCallback(
        async (id: string) => {
            if (id === 'copy-page-url') {
                try {
                    const url = typeof window !== 'undefined' ? window.location.href : pathname;
                    await navigator.clipboard.writeText(url);
                    toast.success('Link copied to clipboard');
                } catch {
                    toast.error('Could not copy link');
                }
                setOpen(false);
                return;
            }
            if (id === 'reload-data') {
                router.refresh();
                toast.success('Refreshing data');
                setOpen(false);
            }
        },
        [pathname, router],
    );

    const hasAnyResults = filteredActions.length > 0 || filteredNav.length > 0;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent
                className={cn(
                    'max-w-lg gap-0 overflow-hidden p-0 sm:max-w-lg',
                    'border-border/60 bg-popover/92 shadow-2xl backdrop-blur-xl',
                )}
                onOpenAutoFocus={(e) => {
                    e.preventDefault();
                    queueMicrotask(() => inputRef.current?.focus());
                }}
            >
                <DialogHeader className="sr-only">
                    <DialogTitle>Command palette</DialogTitle>
                    <DialogDescription>Search pages and quick actions.</DialogDescription>
                </DialogHeader>
                <div className="flex items-center gap-2 border-b border-border/50 px-3 py-2">
                    <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <Input
                        ref={inputRef}
                        value={query}
                        onChange={(ev) => setQuery(ev.target.value)}
                        placeholder="Search pages or actions…"
                        className="h-9 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
                        aria-label="Filter commands and actions"
                        autoComplete="off"
                    />
                    <kbd className="ovo-command-kbd hidden shrink-0 rounded border border-border/60 bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">
                        esc
                    </kbd>
                </div>
                <div className="max-h-[min(60vh,360px)] overflow-y-auto p-1" aria-label="Command palette results">
                    {!hasAnyResults ? (
                        <p className="px-3 py-6 text-center text-sm text-muted-foreground" role="status">
                            No matches. Try another keyword.
                        </p>
                    ) : (
                        <>
                            {filteredActions.length > 0 ? (
                                <div className="mb-1">
                                    <p className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                        Actions
                                    </p>
                                    <ul className="space-y-0.5" aria-label="Quick actions">
                                        {filteredActions.map((a) => (
                                            <li key={a.id}>
                                                <button
                                                    type="button"
                                                    className={cn(
                                                        'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm outline-none',
                                                        'hover:bg-accent/80 focus-visible:bg-accent/80 focus-visible:ring-2 focus-visible:ring-ring',
                                                    )}
                                                    onClick={() => void runAction(a.id)}
                                                >
                                                    {a.id === 'copy-page-url' ? (
                                                        <Copy className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                                                    ) : (
                                                        <RefreshCw className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                                                    )}
                                                    <span className="font-medium tracking-tight text-foreground">{a.title}</span>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ) : null}
                            {filteredNav.length > 0 ? (
                                <div>
                                    {filteredActions.length > 0 ? (
                                        <p className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                            Pages
                                        </p>
                                    ) : null}
                                    <div aria-label="Matching destinations">
                                        {filteredNav.map((cmd) => (
                                            <Link
                                                key={cmd.id}
                                                href={cmd.href}
                                                className={cn(
                                                    'flex flex-col gap-0.5 rounded-md px-3 py-2 text-sm outline-none',
                                                    'hover:bg-accent/80 focus-visible:bg-accent/80 focus-visible:ring-2 focus-visible:ring-ring',
                                                )}
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    onSelect(cmd.href);
                                                }}
                                            >
                                                <span className="font-medium tracking-tight text-foreground">{cmd.title}</span>
                                                <span className="text-[11px] text-muted-foreground">
                                                    {cmd.group} · {cmd.href}
                                                </span>
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            ) : null}
                        </>
                    )}
                </div>
                <div className="border-t border-border/50 px-3 py-2 text-[10px] text-muted-foreground">
                    <span className="font-medium text-foreground/80">Tip:</span>{' '}
                    <kbd className="ovo-command-kbd rounded border border-border/50 bg-muted/40 px-1 py-px font-mono">
                        ⌘K
                    </kbd>{' '}
                    or{' '}
                    <kbd className="ovo-command-kbd rounded border border-border/50 bg-muted/40 px-1 py-px font-mono">
                        Ctrl+K
                    </kbd>{' '}
                    from anywhere (except while typing in a field).
                </div>
            </DialogContent>
        </Dialog>
    );
}
