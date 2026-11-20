/**
 * DX-01-BUILDER — in-app recipe index (mirrors recipes/*.md in the repo).
 */

export type BuilderRecipeId = 'embed-widget' | 'inbound-pstn' | 'outbound-campaign';

export type BuilderRecipe = {
    id: BuilderRecipeId;
    title: string;
    outcome: string;
    tier: string;
    primaryApi: string;
    envVars: string[];
    steps: string[];
    repoDocPath: string;
};

export const BUILDER_RECIPES: BuilderRecipe[] = [
    {
        id: 'embed-widget',
        title: 'Website voice widget',
        outcome: 'Visitors talk to a published workflow over WebRTC from your site.',
        tier: 'Builder — minimal code',
        primaryApi: 'POST /api/v1/workflow/{workflow_id}/embed-token',
        envVars: ['BACKEND_API_ENDPOINT', 'NEXT_PUBLIC_BACKEND_URL'],
        steps: [
            'Publish the workflow in the editor.',
            'Call embed-token with your user JWT; set allowed_domains to your site origin.',
            'Paste the returned embed_script on your page.',
            'Open the widget — audio uses /api/v1/ws/... signaling (no PSTN).',
        ],
        repoDocPath: 'recipes/embed-widget.md',
    },
    {
        id: 'inbound-pstn',
        title: 'Inbound phone (PSTN)',
        outcome: 'A phone number routes caller audio into the same graph you built in the UI.',
        tier: 'Builder — provider webhooks',
        primaryApi: 'POST /api/v1/telephony/inbound/{workflow_id}',
        envVars: ['BACKEND_API_ENDPOINT', 'Provider credentials (Twilio / Vonage / Telnyx)'],
        steps: [
            'Configure telephony credentials in the dashboard.',
            'Publish the target workflow and note its numeric id.',
            'Point your carrier webhook at the inbound URL on your public API host.',
            'Place a test call — media streams on /api/v1/telephony/ws/...',
        ],
        repoDocPath: 'recipes/inbound-pstn.md',
    },
    {
        id: 'outbound-campaign',
        title: 'Outbound campaign',
        outcome: 'Batch outbound runs tied to a workflow (CSV / list upload is your compliance process).',
        tier: 'Builder — REST setup; scale with ADK for automation',
        primaryApi: 'POST /api/v1/campaign/create → POST .../start',
        envVars: ['BACKEND_API_ENDPOINT', 'Outbound caller ID + provider settings'],
        steps: [
            'Publish the workflow and configure outbound telephony.',
            'Create a campaign via POST /api/v1/campaign/create.',
            'Upload or attach your dial list per your consent process.',
            'Start with POST /api/v1/campaign/{id}/start; monitor progress + report endpoints.',
        ],
        repoDocPath: 'recipes/outbound-campaign.md',
    },
];

export function builderRecipeById(id: BuilderRecipeId): BuilderRecipe | undefined {
    return BUILDER_RECIPES.find((r) => r.id === id);
}
