/**
 * Post-login routing — new orgs land on Home (/overview) for guided + AI onboarding.
 */

export const POST_LOGIN_OVERVIEW = '/overview';
export const POST_LOGIN_WORKFLOW_LIST = '/workflow';
export const POST_LOGIN_AI_CREATE = '/workflow/create';

/** OSS / Stack admin: 0 active workflows → overview; else workflow list. */
export function resolvePostLoginPath(activeWorkflowCount: number): string {
    if (activeWorkflowCount > 0) {
        return POST_LOGIN_WORKFLOW_LIST;
    }
    return POST_LOGIN_OVERVIEW;
}
