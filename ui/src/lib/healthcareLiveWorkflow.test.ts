import { describe, expect, it } from 'vitest';

import type { AnalyticsCallDetail } from '@/lib/analyticsCallsApi';
import { buildHealthcareLiveWorkflowSteps } from '@/lib/healthcareLiveWorkflow';

describe('healthcareLiveWorkflow', () => {
    it('builds timeline from EHR tool spans', () => {
        const detail = {
            workflow_slug: 'healthcare-clinic-screening',
            catalog_variant_id: 'ehr_sync_complex',
            outcomes: {},
            tool_spans: [
                {
                    tool_name: 'verify_prior_auth',
                    http: {
                        mapped_data: { status_code: 'approved', expires_at: '2026-03-15T00:00:00Z' },
                    },
                },
                {
                    tool_name: 'sync_chart_to_ehr',
                    http: { mapped_data: { ehr_vendor: 'athenahealth' } },
                },
            ],
        } as unknown as AnalyticsCallDetail;

        const steps = buildHealthcareLiveWorkflowSteps(detail);
        expect(steps.some((s) => s.label.includes('Prior auth'))).toBe(true);
        expect(steps.some((s) => s.label.includes('Chart synced'))).toBe(true);
    });
});
