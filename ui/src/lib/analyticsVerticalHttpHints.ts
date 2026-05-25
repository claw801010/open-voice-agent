/**
 * MK-01 vertical hints: tie packaged catalog slugs to example HTTP tool names and
 * stable response_mapping keys (→ analytics call detail mapped_data). Keep in sync
 * with catalog/VERTICAL_ANALYTICS_HTTP_MATRIX.md.
 */
export type VerticalHttpProofHint = {
    example_tool_names: string[];
    suggested_response_mapping_keys: string[];
};

export const VERTICAL_HTTP_PROOF_HINTS: Record<string, VerticalHttpProofHint> = {
    "healthcare-clinic-screening": {
        example_tool_names: ["book_slot", "lookup_availability"],
        suggested_response_mapping_keys: ["appointment_id", "slot_start", "confirmation_code"],
    },
    "retail-wismo-faq": {
        example_tool_names: ["reserve_pickup_slot"],
        suggested_response_mapping_keys: ["pickup_slot_id", "order_id", "window_start"],
    },
    "b2b-saas-trial-nurture": {
        example_tool_names: ["book_demo"],
        suggested_response_mapping_keys: ["meeting_id", "meeting_start", "crm_stage"],
    },
    "insurance-fnol-faq": {
        example_tool_names: ["schedule_adjuster_callback", "capture_quote_intent", "lookup_claim_status"],
        suggested_response_mapping_keys: ["callback_id", "intent_id", "claim_id", "status_code", "confirmation_code"],
    },
    "hospitality-travel-concierge": {
        example_tool_names: ["modify_reservation", "apply_cancellation_waiver", "offer_room_upgrade"],
        suggested_response_mapping_keys: ["reservation_id", "new_check_in", "waiver_id", "offer_id", "confirmation_code"],
    },
    "financial-services-banking-faq": {
        example_tool_names: ["schedule_branch_appointment", "lookup_account_balance", "report_card_lost_stolen"],
        suggested_response_mapping_keys: ["appointment_id", "slot_start", "account_id", "balance_available", "as_of_date", "block_id", "status_code", "blocked_at", "confirmation_code"],
    },
    "smb-franchise-location-faq": {
        example_tool_names: ["schedule_lead_callback", "route_call_to_location", "capture_lead_intent"],
        suggested_response_mapping_keys: ["callback_id", "slot_start", "route_id", "target_location_code", "transfer_extension", "intent_id", "follow_up_by", "confirmation_code"],
    },
    "telecom-utilities-outage-faq": {
        example_tool_names: ["schedule_service_callback", "lookup_outage_status", "confirm_payment_redirect"],
        suggested_response_mapping_keys: ["callback_id", "slot_start", "outage_id", "restoration_eta", "status_code", "redirect_id", "portal_url", "expires_at", "confirmation_code"],
    },
    "public-sector-civic-services-faq": {
        example_tool_names: ["schedule_civic_callback", "lookup_permit_status", "route_by_language"],
        suggested_response_mapping_keys: ["callback_id", "slot_start", "permit_id", "status_code", "last_updated", "route_id", "target_queue", "language_code", "confirmation_code"],
    },
    "hr-staffing-recruiting-faq": {
        example_tool_names: ["schedule_interview", "lookup_application_status", "confirm_or_reschedule_interview"],
        suggested_response_mapping_keys: ["interview_id", "slot_start", "application_id", "status_code", "last_updated", "confirmation_code", "invite_download_url"],
    },
};

export function verticalHttpProofHintForSlug(slug: string | null | undefined): VerticalHttpProofHint | null {
    const s = (slug || "").trim();
    if (!s) return null;
    return VERTICAL_HTTP_PROOF_HINTS[s] ?? null;
}
