'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';

import {
    createQuickPersonaTestSessionApiV1LooptalkTestSessionsQuickPersonaPost,
    createWorkflowRunApiV1WorkflowWorkflowIdRunsPost,
    installWorkflowFromCatalogApiV1WorkflowInstallFromCatalogPost,
} from '@/client/sdk.gen';
import { WORKFLOW_RUN_MODES } from '@/constants/workflowRunModes';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useAuth } from '@/lib/auth';
import {
    catalogFacets,
    defaultCatalogFilters,
    filterVerticalPacks,
    type CatalogFilters,
    type CatalogJson,
    type VerticalPack,
} from '@/lib/catalog/filterVerticalPacks';
import { getRandomId } from '@/lib/utils';
import logger from '@/lib/logger';

type MarketplaceCatalogProps = {
    catalog: CatalogJson | null;
    loadError: string | null;
    /** When true, show Install and run install-from-catalog; when false (public browse), show sign-in CTA */
    installable: boolean;
    title?: string;
    subtitle?: string;
    backButton?: ReactNode;
};

function toggleString(arr: string[], value: string, checked: boolean): string[] {
    const set = new Set(arr);
    if (checked) {
        set.add(value);
    } else {
        set.delete(value);
    }
    return [...set];
}

export function MarketplaceCatalog({
    catalog,
    loadError,
    installable,
    title = 'Template catalog',
    subtitle = 'Filter by industry, use case, language, and compliance. Install adds a workflow to your organization.',
    backButton,
}: MarketplaceCatalogProps) {
    const router = useRouter();
    const { getAccessToken } = useAuth();
    const [filters, setFilters] = useState<CatalogFilters>(defaultCatalogFilters);
    const [installSlug, setInstallSlug] = useState<string | null>(null);
    const [installName, setInstallName] = useState('');
    const [installing, setInstalling] = useState(false);
    const [tryPack, setTryPack] = useState<VerticalPack | null>(null);
    const [tryLoading, setTryLoading] = useState(false);
    const [loopTalkPack, setLoopTalkPack] = useState<VerticalPack | null>(null);
    const [loopTalkLoading, setLoopTalkLoading] = useState(false);

    const packs = catalog?.packs ?? [];
    const facets = useMemo(() => catalogFacets(packs), [packs]);
    const filtered = useMemo(() => filterVerticalPacks(packs, filters), [packs, filters]);

    const resetFilters = useCallback(() => {
        setFilters(defaultCatalogFilters());
    }, []);

    const openInstall = useCallback((pack: VerticalPack) => {
        setInstallSlug(pack.slug);
        setInstallName(pack.display_name);
    }, []);

    const confirmInstall = useCallback(async () => {
        if (!installSlug || !installName.trim()) {
            toast.error('Enter a name for the workflow');
            return;
        }
        setInstalling(true);
        try {
            const token = await getAccessToken();
            const res = await installWorkflowFromCatalogApiV1WorkflowInstallFromCatalogPost({
                body: { slug: installSlug, workflow_name: installName.trim() },
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            if (res.data?.id) {
                toast.success('Installed workflow in your organization');
                setInstallSlug(null);
                router.push(`/workflow/${res.data.id}`);
            }
        } catch (e) {
            logger.error(`Install failed: ${e}`);
            toast.error('Install failed — check that the API is running and you are signed in');
        } finally {
            setInstalling(false);
        }
    }, [installSlug, installName, getAccessToken, router]);

    const confirmTryWeb = useCallback(async () => {
        if (!tryPack) return;
        setTryLoading(true);
        try {
            const token = await getAccessToken();
            const workflowName = `Try · ${tryPack.display_name}`.slice(0, 200);
            const installRes = await installWorkflowFromCatalogApiV1WorkflowInstallFromCatalogPost({
                body: { slug: tryPack.slug, workflow_name: workflowName },
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            const wfId = installRes.data?.id;
            if (!wfId) {
                toast.error('Could not create workflow for try');
                return;
            }
            const runName = `Try-${getRandomId()}`;
            const runRes = await createWorkflowRunApiV1WorkflowWorkflowIdRunsPost({
                path: { workflow_id: wfId },
                body: {
                    mode: WORKFLOW_RUN_MODES.SMALL_WEBRTC,
                    name: runName,
                },
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            const runId = runRes.data?.id;
            if (runId) {
                setTryPack(null);
                router.push(`/workflow/${wfId}/run/${runId}`);
            } else {
                toast.error('Workflow created but Web run failed — open the workflow and use Web Call');
                setTryPack(null);
                router.push(`/workflow/${wfId}`);
            }
        } catch (e) {
            logger.error(`Try Web failed: ${e}`);
            toast.error('Try failed — ensure you are signed in and the API is reachable');
        } finally {
            setTryLoading(false);
        }
    }, [tryPack, getAccessToken, router]);

    const confirmLoopTalkTry = useCallback(async () => {
        if (!loopTalkPack) return;
        setLoopTalkLoading(true);
        try {
            const token = await getAccessToken();
            const workflowName = `Try · ${loopTalkPack.display_name}`.slice(0, 200);
            const installRes = await installWorkflowFromCatalogApiV1WorkflowInstallFromCatalogPost({
                body: { slug: loopTalkPack.slug, workflow_name: workflowName },
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            const wfId = installRes.data?.id;
            if (!wfId) {
                toast.error('Could not create workflow for LoopTalk try');
                return;
            }
            const sessionRes = await createQuickPersonaTestSessionApiV1LooptalkTestSessionsQuickPersonaPost({
                body: {
                    actor_workflow_id: wfId,
                    name: `Catalog · ${loopTalkPack.display_name} · LoopTalk`.slice(0, 200),
                },
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            const sessionId = sessionRes.data?.id;
            if (sessionId) {
                setLoopTalkPack(null);
                router.push(`/looptalk/${sessionId}`);
            } else {
                toast.error('Workflow created but LoopTalk session failed — open LoopTalk from the app menu');
                setLoopTalkPack(null);
                router.push(`/workflow/${wfId}`);
            }
        } catch (e) {
            logger.error(`LoopTalk try failed: ${e}`);
            toast.error('LoopTalk try failed — ensure you are signed in and the API is reachable');
        } finally {
            setLoopTalkLoading(false);
        }
    }, [loopTalkPack, getAccessToken, router]);

    const hasActiveFilters =
        filters.industry !== 'all' ||
        filters.useCaseSearch.trim() !== '' ||
        filters.languages.length > 0 ||
        filters.complianceTags.length > 0;

    return (
        <div className="container mx-auto max-w-5xl px-4 py-8">
            <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold">{title}</h1>
                    <p className="text-muted-foreground max-w-2xl">{subtitle}</p>
                    {!installable && (
                        <p className="mt-2 text-sm text-muted-foreground">
                            Sign in to install a pack into your workspace. Web-only try flows use LLM/STT/TTS (no PSTN charges on this page).
                        </p>
                    )}
                </div>
                {backButton}
            </div>

            {loadError && <p className="text-destructive mb-4">{loadError}</p>}

            {packs.length === 0 && !loadError && (
                <p className="py-10 text-center text-muted-foreground" role="status">
                    No vertical packs are available in the catalog right now. Check back after a catalog update, or
                    confirm the API returned data.
                </p>
            )}

            {packs.length > 0 && (
                <section
                    className="mb-8 rounded-lg border bg-card p-4 shadow-sm"
                    aria-label="Filter templates"
                >
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="catalog-industry">Industry</Label>
                            <Select
                                value={filters.industry}
                                onValueChange={(v) => setFilters((f) => ({ ...f, industry: v }))}
                            >
                                <SelectTrigger id="catalog-industry" className="w-full">
                                    <SelectValue placeholder="All industries" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All industries</SelectItem>
                                    {facets.industries.map((ind) => (
                                        <SelectItem key={ind} value={ind}>
                                            {ind}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="catalog-use-case">Use case search</Label>
                            <Input
                                id="catalog-use-case"
                                value={filters.useCaseSearch}
                                onChange={(e) =>
                                    setFilters((f) => ({ ...f, useCaseSearch: e.target.value }))
                                }
                                placeholder="e.g. triage, WISMO, trial"
                                aria-describedby="catalog-use-case-hint"
                            />
                            <p id="catalog-use-case-hint" className="text-xs text-muted-foreground">
                                Matches template name, summary, and use case tags
                            </p>
                        </div>
                    </div>

                    <div className="mt-4 grid gap-6 md:grid-cols-2">
                        <fieldset>
                            <legend className="text-sm font-medium mb-2">Languages</legend>
                            <div className="flex flex-wrap gap-3">
                                {facets.languages.map((lang) => (
                                    <label
                                        key={lang}
                                        className="flex items-center gap-2 text-sm cursor-pointer"
                                    >
                                        <Checkbox
                                            checked={filters.languages.includes(lang)}
                                            onCheckedChange={(checked) =>
                                                setFilters((f) => ({
                                                    ...f,
                                                    languages: toggleString(
                                                        f.languages,
                                                        lang,
                                                        checked === true,
                                                    ),
                                                }))
                                            }
                                        />
                                        {lang}
                                    </label>
                                ))}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Leave empty for all. Selecting one or more shows packs that support any of them.
                            </p>
                        </fieldset>
                        <fieldset>
                            <legend className="text-sm font-medium mb-2">Compliance tags</legend>
                            <div className="flex flex-wrap gap-3">
                                {facets.compliance.map((tag) => (
                                    <label
                                        key={tag}
                                        className="flex items-center gap-2 text-sm cursor-pointer"
                                    >
                                        <Checkbox
                                            checked={filters.complianceTags.includes(tag)}
                                            onCheckedChange={(checked) =>
                                                setFilters((f) => ({
                                                    ...f,
                                                    complianceTags: toggleString(
                                                        f.complianceTags,
                                                        tag,
                                                        checked === true,
                                                    ),
                                                }))
                                            }
                                        />
                                        <span className="break-all">{tag}</span>
                                    </label>
                                ))}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Leave empty for all. Selecting tags shows packs that include any selected tag.
                            </p>
                        </fieldset>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={resetFilters} disabled={!hasActiveFilters}>
                            Clear filters
                        </Button>
                        <span className="text-sm text-muted-foreground">
                            Showing {filtered.length} of {packs.length} templates
                        </span>
                    </div>
                </section>
            )}

            <div className="grid gap-6 md:grid-cols-2">
                {filtered.map((pack) => (
                    <article key={pack.slug}>
                        <Card className="flex h-full flex-col">
                            <CardHeader>
                                <CardTitle className="text-lg">{pack.display_name}</CardTitle>
                                <CardDescription>{pack.industry}</CardDescription>
                            </CardHeader>
                            <CardContent className="flex-1 space-y-2 text-sm text-muted-foreground">
                                <p>{pack.summary}</p>
                                {pack.use_cases && pack.use_cases.length > 0 && (
                                    <p>
                                        <span className="font-medium text-foreground">Use cases: </span>
                                        {pack.use_cases.join(', ')}
                                    </p>
                                )}
                                {pack.languages && pack.languages.length > 0 && (
                                    <p>
                                        <span className="font-medium text-foreground">Languages: </span>
                                        {pack.languages.join(', ')}
                                    </p>
                                )}
                                {pack.compliance_tags && pack.compliance_tags.length > 0 && (
                                    <p>
                                        <span className="font-medium text-foreground">Compliance: </span>
                                        {pack.compliance_tags.join(', ')}
                                    </p>
                                )}
                                {pack.default_template_variables &&
                                    Object.keys(pack.default_template_variables).length > 0 && (
                                    <p>
                                        <span className="font-medium text-foreground">Variables: </span>
                                        {Object.keys(pack.default_template_variables).join(', ')}
                                    </p>
                                )}
                                {pack.pack_semver ? (
                                    <p className="text-xs text-muted-foreground/80">Pack v{pack.pack_semver}</p>
                                ) : null}
                            </CardContent>
                            <CardFooter className="flex flex-col gap-2">
                                {installable ? (
                                    <>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="w-full"
                                            onClick={() => setTryPack(pack)}
                                        >
                                            Try (Web only)
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="w-full"
                                            onClick={() => setLoopTalkPack(pack)}
                                        >
                                            Try (LoopTalk persona)
                                        </Button>
                                        <Button type="button" className="w-full" onClick={() => openInstall(pack)}>
                                            Install into my org
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        <Button className="w-full" variant="default" asChild>
                                            <Link href="/workflow/catalog">Sign in to install</Link>
                                        </Button>
                                        <Button className="w-full" variant="outline" asChild>
                                            <Link href="/">Back to app home</Link>
                                        </Button>
                                    </>
                                )}
                            </CardFooter>
                        </Card>
                    </article>
                ))}
            </div>

            {filtered.length === 0 && packs.length > 0 && (
                <p className="py-12 text-center text-muted-foreground" role="status">
                    No templates match these filters. Use <span className="font-medium text-foreground">Clear filters</span>{' '}
                    above or broaden the use case search.
                </p>
            )}

            {installable && (
                <Dialog open={installSlug !== null} onOpenChange={(open) => !open && setInstallSlug(null)}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Name your workflow</DialogTitle>
                            <DialogDescription>
                                This creates a new workflow in your organization only (no cross-org access).
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-2 py-2">
                            <Label htmlFor="wf-name">Workflow name</Label>
                            <Input
                                id="wf-name"
                                value={installName}
                                onChange={(e) => setInstallName(e.target.value)}
                                placeholder="e.g. Clinic screening — Main St"
                            />
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setInstallSlug(null)}>
                                Cancel
                            </Button>
                            <Button onClick={confirmInstall} disabled={installing || !installName.trim()}>
                                {installing ? 'Installing…' : 'Install'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}

            {installable && (
                <Dialog open={tryPack !== null} onOpenChange={(open) => !open && setTryPack(null)}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Try in browser (Web only)</DialogTitle>
                            <DialogDescription asChild>
                                <div className="space-y-3 text-left text-sm text-muted-foreground">
                                    <p>
                                        This starts a <strong className="text-foreground">browser WebRTC</strong> session
                                        — same path as &quot;Web Call&quot; in the workflow editor.
                                    </p>
                                    <ul className="list-disc pl-4 space-y-1">
                                        <li>
                                            <strong className="text-foreground">Costs:</strong> LLM + speech (STT/TTS)
                                            usage; <strong className="text-foreground">no PSTN or carrier</strong>{' '}
                                            charges on this try.
                                        </li>
                                        <li>
                                            <strong className="text-foreground">No outbound dials:</strong> this path
                                            never calls a real phone number—browser mic only.
                                        </li>
                                        <li>
                                            <strong className="text-foreground">Phone try:</strong> install the pack,
                                            then use <strong className="text-foreground">Phone Call</strong> from the
                                            editor — telephony charges may apply.
                                        </li>
                                    </ul>
                                    <p className="text-xs">
                                        For <strong className="text-foreground">two-agent</strong> simulation (your
                                        template vs a system caller), use <strong className="text-foreground">Try
                                        (LoopTalk persona)</strong> on the card.
                                    </p>
                                </div>
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter className="gap-2 sm:gap-0">
                            <Button type="button" variant="outline" onClick={() => setTryPack(null)}>
                                Cancel
                            </Button>
                            <Button type="button" onClick={confirmTryWeb} disabled={tryLoading}>
                                {tryLoading ? 'Starting…' : 'Start Web try'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}

            {installable && (
                <Dialog open={loopTalkPack !== null} onOpenChange={(open) => !open && setLoopTalkPack(null)}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Try with LoopTalk (simulated caller)</DialogTitle>
                            <DialogDescription asChild>
                                <div className="space-y-3 text-left text-sm text-muted-foreground">
                                    <p>
                                        Creates a <strong className="text-foreground">LoopTalk test session</strong>:
                                        your new workflow is the <strong className="text-foreground">actor</strong>{' '}
                                        (agent under test); a <strong className="text-foreground">system-managed</strong>{' '}
                                        simulated caller workflow is the adversary. Audio is routed{' '}
                                        <strong className="text-foreground">inside the platform</strong> — no PSTN or
                                        carrier charges, and <strong className="text-foreground">no calls to external
                                        phone numbers</strong>.
                                    </p>
                                    <ul className="list-disc pl-4 space-y-1">
                                        <li>
                                            <strong className="text-foreground">Costs:</strong> LLM + speech for{' '}
                                            <strong className="text-foreground">both</strong> agents (typically higher
                                            than a single Web call).
                                        </li>
                                        <li>
                                            After continue, open the session and press <strong className="text-foreground">Start</strong>{' '}
                                            on the LoopTalk page to run the test.
                                        </li>
                                        <li>
                                            <strong className="text-foreground">Single-agent mic test?</strong> Use{' '}
                                            <strong className="text-foreground">Try (Web only)</strong> instead.
                                        </li>
                                    </ul>
                                </div>
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter className="gap-2 sm:gap-0">
                            <Button type="button" variant="outline" onClick={() => setLoopTalkPack(null)}>
                                Cancel
                            </Button>
                            <Button type="button" onClick={confirmLoopTalkTry} disabled={loopTalkLoading}>
                                {loopTalkLoading ? 'Creating…' : 'Create LoopTalk session'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
