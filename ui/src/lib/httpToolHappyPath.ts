/**
 * WE-01-DUALMODE — HTTP tool authoring happy-path checklist (operator nudges).
 */

export type HttpToolHappyPathStepId =
    | 'endpoint'
    | 'test_call'
    | 'response_mapping'
    | 'saved';

export type HttpToolHappyPathStep = {
    id: HttpToolHappyPathStepId;
    label: string;
    done: boolean;
    detail: string;
};

export function urlIsValidForHappyPath(url: string): boolean {
    const trimmed = url.trim();
    if (!trimmed) return false;
    try {
        const parsed = new URL(trimmed);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

export function hasFilledResponseMapping(
    mappings: ReadonlyArray<{ key: string; value: string }>,
): boolean {
    return mappings.some((m) => m.key.trim() && m.value.trim());
}

export function buildHttpToolHappyPathSteps(input: {
    url: string;
    testCallSucceeded: boolean;
    responseMappings: ReadonlyArray<{ key: string; value: string }>;
    isSaved: boolean;
}): HttpToolHappyPathStep[] {
    const endpointDone = urlIsValidForHappyPath(input.url);
    const mappingDone = hasFilledResponseMapping(input.responseMappings);

    return [
        {
            id: 'endpoint',
            label: 'Endpoint',
            done: endpointDone,
            detail: endpointDone
                ? 'URL looks valid'
                : 'Set an http(s) endpoint URL',
        },
        {
            id: 'test_call',
            label: 'Test call',
            done: input.testCallSucceeded,
            detail: input.testCallSucceeded
                ? 'Latest test succeeded'
                : 'Run Test API Call with sample payload + context',
        },
        {
            id: 'response_mapping',
            label: 'Response mapping',
            done: mappingDone,
            detail: mappingDone
                ? 'At least one output field mapped'
                : 'Map fields for analytics / workflow outputs',
        },
        {
            id: 'saved',
            label: 'Saved',
            done: input.isSaved,
            detail: input.isSaved ? 'Changes persisted' : 'Save tool to use in workflows',
        },
    ];
}

export function httpToolHappyPathComplete(steps: HttpToolHappyPathStep[]): boolean {
    return steps.every((s) => s.done);
}
