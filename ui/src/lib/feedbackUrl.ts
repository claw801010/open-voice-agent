/**
 * WE-01-HEADER: optional public URL for product feedback (issues, form, mailto).
 * Set `NEXT_PUBLIC_FEEDBACK_URL` in the UI env (e.g. GitHub issues or Typeform).
 */
export function getPublicFeedbackUrl(): string | null {
    const raw = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_FEEDBACK_URL : undefined;
    if (!raw?.trim()) return null;
    try {
        const u = new URL(raw.trim());
        if (u.protocol === 'http:' || u.protocol === 'https:' || u.protocol === 'mailto:') {
            return u.href;
        }
        return null;
    } catch {
        return null;
    }
}
