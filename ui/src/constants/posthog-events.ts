/**
 * PostHog event names — frontend events only.
 */
export const PostHogEvent = {
  WORKFLOW_EDITOR_OPENED: "workflow_editor_opened",
  WORKFLOW_NODE_ADDED: "workflow_node_added",
  WORKFLOW_RUN_DETAILS_VIEWED: "workflow_run_details_viewed",
  RECORDING_PLAYED: "recording_played",
  TRANSCRIPT_VIEWED: "transcript_viewed",
  WEB_CALL_INITIATED: "web_call_initiated",
  GITHUB_STAR_CLICKED: "github_star_clicked",
  SLACK_COMMUNITY_CLICKED: "slack_community_clicked",
  /** WE-01-HEADER: optional `NEXT_PUBLIC_FEEDBACK_URL` link from workflow editor */
  FEEDBACK_LINK_CLICKED: "feedback_link_clicked",
  /** WE-01-FEEDBACK: in-app dialog submit to POST /api/v1/feedback */
  FEEDBACK_IN_APP_SUBMITTED: "feedback_in_app_submitted",
} as const;
