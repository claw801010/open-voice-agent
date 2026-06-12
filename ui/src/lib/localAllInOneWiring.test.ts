import { describe, expect, it } from 'vitest';

import { VERTICAL_HTTP_PROOF_HINTS } from './analyticsVerticalHttpHints';
import {
    buildLocalIntegrationToolDefinition,
    LOCAL_INTEGRATION_TOOL_SPECS,
} from './localIntegrationToolDefinitions';
import {
    buildLocalBookSlotToolDefinition,
    buildLocalRescheduleToolDefinition,
    LOCAL_SCHEDULING_TOOL_BUILDERS,
} from './localSchedulingToolDefinitions';
import { LOCAL_PAYMENT_TOOL_BUILDERS } from './localPaymentToolDefinitions';

const PAYMENT_TOOLS = new Set(Object.keys(LOCAL_PAYMENT_TOOL_BUILDERS));

function isSchedulingTool(name: string): boolean {
    if (name in LOCAL_SCHEDULING_TOOL_BUILDERS) {
        return true;
    }
    return name.startsWith('book_') || name.startsWith('schedule_') || name.includes('reschedule');
}

describe('local all-in-one wiring helpers', () => {
    it('integration tool specs produce valid HTTP tool definitions', () => {
        const base = 'http://127.0.0.1:8000/api/v1/local-integrations';
        for (const name of Object.keys(LOCAL_INTEGRATION_TOOL_SPECS)) {
            const def = buildLocalIntegrationToolDefinition(base, name);
            expect(def.type).toBe('http_api');
            expect(def.config.url).toContain(base);
            expect(def.config.method).toBe('POST');
            expect(Object.keys(def.config.response_mapping ?? {}).length).toBeGreaterThan(0);
        }
    });

    it('scheduling builders target local-scheduling appointments or reschedule', () => {
        const base = 'http://127.0.0.1:8000/api/v1/local-scheduling';
        const book = buildLocalBookSlotToolDefinition(`${base}/api/v1/appointments`);
        expect(book.config.url).toContain('/appointments');
        const resched = buildLocalRescheduleToolDefinition(base, {
            appointment_id: 'appointment.id',
        });
        expect(resched.config.url).toContain('/appointments/reschedule');
    });

    it('explicit scheduling builders exist for catalog booking_complex schedule_* tools', () => {
        const scheduleTools = [
            'schedule_adjuster_callback',
            'schedule_branch_appointment',
            'schedule_civic_callback',
            'schedule_lead_callback',
            'schedule_service_callback',
            'schedule_interview',
        ];
        for (const name of scheduleTools) {
            expect(name in LOCAL_SCHEDULING_TOOL_BUILDERS, name).toBe(true);
        }
    });

    it('every catalog hint tool is covered by local scheduling, payments, or integrations', () => {
        const uncovered: string[] = [];
        for (const [slug, hint] of Object.entries(VERTICAL_HTTP_PROOF_HINTS)) {
            for (const tool of hint.example_tool_names) {
                if (tool === 'lookup_availability' || tool === 'reserve_pickup_slot') {
                    continue;
                }
                const covered =
                    isSchedulingTool(tool) ||
                    PAYMENT_TOOLS.has(tool) ||
                    tool in LOCAL_INTEGRATION_TOOL_SPECS;
                if (!covered) {
                    uncovered.push(`${slug}:${tool}`);
                }
            }
        }
        expect(uncovered, `add spec or builder for: ${uncovered.join(', ')}`).toEqual([]);
    });
});
