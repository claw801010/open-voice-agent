/** Routes surfaced in the global command palette (WE-01-HYPER-DENSITY). */
export type AppNavCommand = {
    id: string;
    title: string;
    href: string;
    group: string;
    keywords?: string[];
};

export const APP_NAV_COMMANDS: AppNavCommand[] = [
    { id: 'home', title: 'Home', href: '/', group: 'General', keywords: ['start', 'landing'] },
    { id: 'overview', title: 'Overview', href: '/overview', group: 'General', keywords: ['dashboard'] },
    { id: 'workflow', title: 'Voice Agents', href: '/workflow', group: 'Build', keywords: ['agents', 'voice', 'flows'] },
    {
        id: 'catalog',
        title: 'Template catalog',
        href: '/workflow/catalog',
        group: 'Build',
        keywords: ['marketplace', 'templates', 'vertical', 'install'],
    },
    {
        id: 'templates-public',
        title: 'Public templates',
        href: '/templates',
        group: 'Build',
        keywords: ['browse', 'seo', 'catalog'],
    },
    { id: 'campaigns', title: 'Campaigns', href: '/campaigns', group: 'Build', keywords: ['outbound'] },
    { id: 'models', title: 'Models', href: '/model-configurations', group: 'Build', keywords: ['llm', 'ai'] },
    { id: 'telephony', title: 'Telephony', href: '/telephony-configurations', group: 'Build', keywords: ['pstn', 'phone', 'twilio'] },
    { id: 'tools', title: 'Tools', href: '/tools', group: 'Build', keywords: ['functions', 'webhooks'] },
    { id: 'files', title: 'Files', href: '/files', group: 'Build', keywords: ['uploads'] },
    { id: 'recordings', title: 'Recordings', href: '/recordings', group: 'Build', keywords: ['calls', 'audio'] },
    { id: 'api-keys', title: 'Developers', href: '/api-keys', group: 'Build', keywords: ['api', 'keys', 'adk'] },
    { id: 'usage', title: 'Usage', href: '/usage', group: 'Observe', keywords: ['billing', 'tokens', 'quota'] },
    { id: 'reports', title: 'Reports', href: '/reports', group: 'Observe', keywords: ['analytics'] },
    {
        id: 'analytics-calls',
        title: 'Call analytics',
        href: '/analytics/calls',
        group: 'Observe',
        keywords: ['calls', 'qm', 'qa', 'tools', 'http', 'outcomes', 'vertical'],
    },
    { id: 'settings', title: 'Platform settings', href: '/settings', group: 'General', keywords: ['account', 'prefs'] },
];
