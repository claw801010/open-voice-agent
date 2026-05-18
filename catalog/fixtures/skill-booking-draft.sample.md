# Patient booking skill (fixture)

Use a concise, HIPAA-aware tone. Confirm {{patient_name}} and {{callback_phone}} before scheduling.

## Steps

1. Greet and verify identity.
2. Offer slots in {{timezone}}.
3. When confirmed, call the scheduling HTTP tool (configure in editor).

## Constraints

- Do not store full SSN or card numbers in the transcript.
- Escalate to a human if the caller requests clinical advice.
