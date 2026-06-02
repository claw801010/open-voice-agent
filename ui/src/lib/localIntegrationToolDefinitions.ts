import type { HttpApiToolDefinition } from '@/client/types.gen';

function postTool(
    baseUrl: string,
    path: string,
    body: Record<string, string>,
    response_mapping: Record<string, string>,
): HttpApiToolDefinition {
    const url = `${baseUrl.replace(/\/$/, '')}${path}`;
    return {
        schema_version: 1,
        type: 'http_api',
        config: {
            method: 'POST',
            url,
            headers: { 'Content-Type': 'application/json' },
            body_template: JSON.stringify(body, null, 2),
            response_mapping,
        },
    };
}

export type LocalIntegrationToolSpec = {
    varKey: string;
    path: string;
    body: Record<string, string>;
    response_mapping: Record<string, string>;
};

export const LOCAL_INTEGRATION_TOOL_SPECS: Record<string, LocalIntegrationToolSpec> = {
    offer_warranty_addon: {
        varKey: 'product_api_base_url',
        path: '/api/v1/offers/attach',
        body: { product_sku: '{{upsell_product_sku}}', order_id: '{{order_id}}' },
        response_mapping: {
            offer_id: 'appointment.id',
            confirmation_code: 'confirmation_code',
            slot_start: 'appointment.slot.start',
        },
    },
    update_crm_deal_stage: {
        varKey: 'crm_api_base_url',
        path: '/api/v1/deals/stage',
        body: { deal_id: '{{deal_id}}', target_stage: '{{target_deal_stage}}' },
        response_mapping: {
            deal_id: 'appointment.id',
            stage_updated_at: 'appointment.slot.start',
            confirmation_code: 'confirmation_code',
        },
    },
    sync_crm_health: {
        varKey: 'crm_api_base_url',
        path: '/api/v1/accounts/health',
        body: { account_id: '{{account_id}}', health_tier: '{{account_health_tier}}' },
        response_mapping: {
            account_id: 'appointment.id',
            health_score: 'confirmation_code',
            as_of_date: 'appointment.slot.start',
        },
    },
    capture_lead_intent: {
        varKey: 'crm_api_base_url',
        path: '/api/v1/leads/intent',
        body: { lead_source: '{{crm_lead_source_code}}', brand: '{{brand_name}}' },
        response_mapping: {
            intent_id: 'appointment.id',
            confirmation_code: 'confirmation_code',
            follow_up_by: 'appointment.slot.start',
        },
    },
    capture_quote_intent: {
        varKey: 'quoting_api_base_url',
        path: '/api/v1/quotes/intent',
        body: {
            product_code: '{{quote_product_code}}',
            line_of_business: '{{line_of_business}}',
        },
        response_mapping: {
            intent_id: 'appointment.id',
            confirmation_code: 'confirmation_code',
            follow_up_by: 'appointment.slot.start',
        },
    },
    lookup_claim_status: {
        varKey: 'claims_api_base_url',
        path: '/api/v1/claims/status',
        body: { claim_id: '{{claim_id}}', line_of_business: '{{line_of_business}}' },
        response_mapping: {
            claim_id: 'appointment.id',
            status_code: 'confirmation_code',
            last_updated: 'appointment.slot.start',
        },
    },
    modify_reservation: {
        varKey: 'pms_api_base_url',
        path: '/api/v1/reservations/modify',
        body: {
            confirmation_prefix: '{{confirmation_prefix}}',
            room_type: '{{default_room_type}}',
            slot_start: '{{slot_start}}',
        },
        response_mapping: {
            reservation_id: 'appointment.id',
            new_check_in: 'appointment.slot.start',
            confirmation_code: 'confirmation_code',
        },
    },
    apply_cancellation_waiver: {
        varKey: 'policy_api_base_url',
        path: '/api/v1/cancellations/waiver',
        body: {
            waiver_policy_code: '{{waiver_policy_code}}',
            confirmation_prefix: '{{confirmation_prefix}}',
        },
        response_mapping: {
            waiver_id: 'appointment.id',
            confirmation_code: 'confirmation_code',
            credit_amount: 'appointment.slot.start',
        },
    },
    offer_room_upgrade: {
        varKey: 'crs_api_base_url',
        path: '/api/v1/offers/attach',
        body: {
            upgrade_room_type: '{{upgrade_room_type}}',
            confirmation_prefix: '{{confirmation_prefix}}',
        },
        response_mapping: {
            offer_id: 'appointment.id',
            confirmation_code: 'confirmation_code',
            upgrade_effective: 'appointment.slot.start',
        },
    },
    lookup_account_balance: {
        varKey: 'banking_api_base_url',
        path: '/api/v1/accounts/balance',
        body: { account_reference: '{{account_reference}}', institution: '{{institution_name}}' },
        response_mapping: {
            account_id: 'appointment.id',
            balance_available: 'confirmation_code',
            as_of_date: 'appointment.slot.start',
        },
    },
    report_card_lost_stolen: {
        varKey: 'cards_api_base_url',
        path: '/api/v1/cards/block',
        body: {
            card_last_four: '{{card_last_four}}',
            reason_code: '{{card_block_reason_code}}',
        },
        response_mapping: {
            block_id: 'appointment.id',
            status_code: 'confirmation_code',
            blocked_at: 'appointment.slot.start',
        },
    },
    route_call_to_location: {
        varKey: 'locations_api_base_url',
        path: '/api/v1/locations/route',
        body: {
            routing_policy_code: '{{routing_policy_code}}',
            brand_name: '{{brand_name}}',
        },
        response_mapping: {
            route_id: 'appointment.id',
            target_location_code: 'confirmation_code',
            transfer_extension: 'appointment.slot.start',
        },
    },
    lookup_outage_status: {
        varKey: 'oss_api_base_url',
        path: '/api/v1/outages/status',
        body: {
            service_area_code: '{{default_service_area_code}}',
            utility_name: '{{utility_name}}',
        },
        response_mapping: {
            outage_id: 'appointment.id',
            restoration_eta: 'confirmation_code',
            status_code: 'appointment.slot.start',
        },
    },
    lookup_permit_status: {
        varKey: 'records_api_base_url',
        path: '/api/v1/permits/status',
        body: {
            permit_id: '{{permit_id}}',
            department_code: '{{default_department_code}}',
        },
        response_mapping: {
            permit_id: 'appointment.id',
            status_code: 'confirmation_code',
            last_updated: 'appointment.slot.start',
        },
    },
    route_by_language: {
        varKey: 'routing_api_base_url',
        path: '/api/v1/calls/route-by-language',
        body: {
            language_code: '{{language_code}}',
            policy_code: '{{language_routing_policy_code}}',
        },
        response_mapping: {
            route_id: 'appointment.id',
            target_queue: 'confirmation_code',
            language_code: 'appointment.slot.start',
        },
    },
    lookup_application_status: {
        varKey: 'ats_api_base_url',
        path: '/api/v1/applications/status',
        body: {
            application_id: '{{application_id}}',
            requisition_code: '{{default_requisition_code}}',
        },
        response_mapping: {
            application_id: 'appointment.id',
            status_code: 'confirmation_code',
            last_updated: 'appointment.slot.start',
        },
    },
};

export function buildLocalIntegrationToolDefinition(
    baseUrl: string,
    toolName: string,
): HttpApiToolDefinition {
    const spec = LOCAL_INTEGRATION_TOOL_SPECS[toolName];
    if (!spec) {
        throw new Error(`Unknown local integration tool: ${toolName}`);
    }
    return postTool(baseUrl, spec.path, spec.body, spec.response_mapping);
}

export const LOCAL_INTEGRATION_TOOL_NAMES = Object.keys(LOCAL_INTEGRATION_TOOL_SPECS);

export const LOCAL_INTEGRATION_VAR_KEYS = [
    ...new Set(Object.values(LOCAL_INTEGRATION_TOOL_SPECS).map((s) => s.varKey)),
];
