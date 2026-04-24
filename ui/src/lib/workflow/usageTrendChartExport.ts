import { toPng } from 'html-to-image';

/**
 * Rasterize a visible chart container (e.g. Recharts ``ResponsiveContainer`` child) to PNG and trigger download.
 * Kept separate from [workflowRunTrends.ts](workflowRunTrends.ts) so light imports (e.g. lookback constants) do not
 * pull ``html-to-image`` into unrelated bundles. Excludes Recharts tooltip wrappers from the snapshot when present.
 */
export async function exportUsageTrendChartToPng(element: HTMLElement, filenameBase: string): Promise<void> {
    const resolvedBg =
        typeof window !== 'undefined'
            ? getComputedStyle(document.documentElement).getPropertyValue('--background').trim() || undefined
            : undefined;
    const dataUrl = await toPng(element, {
        pixelRatio: 2,
        cacheBust: true,
        ...(resolvedBg ? { backgroundColor: resolvedBg } : {}),
        filter: (node) => {
            const el = node as HTMLElement;
            if (el?.classList?.contains?.('recharts-tooltip-wrapper')) {
                return false;
            }
            return true;
        },
    });
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${filenameBase}.png`;
    a.rel = 'noopener';
    a.click();
}
