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
        example_tool_names: ["schedule_adjuster_callback", "capture_quote_intent"],
        suggested_response_mapping_keys: ["callback_id", "intent_id", "slot_start", "confirmation_code"],
    },
};

export function verticalHttpProofHintForSlug(slug: string | null | undefined): VerticalHttpProofHint | null {
    const s = (slug || "").trim();
    if (!s) return null;
    return VERTICAL_HTTP_PROOF_HINTS[s] ?? null;
}
