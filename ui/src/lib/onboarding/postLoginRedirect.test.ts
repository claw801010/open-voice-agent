import { describe, expect, it } from 'vitest';

import {
    POST_LOGIN_OVERVIEW,
    POST_LOGIN_WORKFLOW_LIST,
    resolvePostLoginPath,
} from './postLoginRedirect';

describe('resolvePostLoginPath', () => {
    it('sends new orgs to overview', () => {
        expect(resolvePostLoginPath(0)).toBe(POST_LOGIN_OVERVIEW);
    });

    it('sends returning orgs to workflow list', () => {
        expect(resolvePostLoginPath(3)).toBe(POST_LOGIN_WORKFLOW_LIST);
    });
});
