/** Quick actions in the global command palette (WE-01-HYPER-DENSITY slice 3). */
export type AppPaletteAction = {
    id: string;
    title: string;
    group: 'Actions';
    keywords?: string[];
};

export const APP_PALETTE_ACTIONS: AppPaletteAction[] = [
    {
        id: 'copy-page-url',
        title: 'Copy link to this page',
        group: 'Actions',
        keywords: ['clipboard', 'url', 'share', 'link', 'copy', 'address'],
    },
    {
        id: 'reload-data',
        title: 'Reload app data',
        group: 'Actions',
        keywords: ['refresh', 'reload', 'router', 'refetch', 'sync'],
    },
];
