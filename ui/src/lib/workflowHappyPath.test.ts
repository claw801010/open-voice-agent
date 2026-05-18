import { describe, expect, it } from 'vitest';

import type { FlowNode } from '@/components/flow/types';

import {
    buildWorkflowHappyPathSteps,
    flowHasAgentSpine,
    httpToolsStepDone,
    workflowHappyPathComplete,
} from './workflowHappyPath';

const spine: FlowNode[] = [
    { id: '1', type: 'startCall', position: { x: 0, y: 0 }, data: { name: 'start', tool_uuids: [] } },
    {
        id: '2',
        type: 'agentNode',
        position: { x: 0, y: 0 },
        data: { name: 'agent', tool_uuids: ['uuid-book'] },
    },
    { id: '3', type: 'endCall', position: { x: 0, y: 0 }, data: { name: 'end' } },
];

describe('workflowHappyPath', () => {
    it('detects agent spine', () => {
        expect(flowHasAgentSpine(spine)).toBe(true);
        expect(flowHasAgentSpine([spine[0]!])).toBe(false);
    });

    it('prefers catalog example tool names when slug set', () => {
        const map = new Map([['uuid-book', 'book_slot']]);
        expect(
            httpToolsStepDone({
                nodes: spine,
                toolNamesByUuid: map,
                catalogSlug: 'healthcare-clinic-screening',
            }),
        ).toBe(true);
        expect(
            httpToolsStepDone({
                nodes: spine,
                toolNamesByUuid: new Map([['uuid-book', 'other_tool']]),
                catalogSlug: 'healthcare-clinic-screening',
            }),
        ).toBe(false);
    });

    it('builds four steps', () => {
        const steps = buildWorkflowHappyPathSteps({
            nodes: spine,
            validationErrorCount: 0,
            hasPublishedVersion: false,
            toolNamesByUuid: new Map([['uuid-book', 'book_slot']]),
            catalogSlug: 'healthcare-clinic-screening',
        });
        expect(steps).toHaveLength(4);
        expect(workflowHappyPathComplete(steps)).toBe(false);
    });
});
