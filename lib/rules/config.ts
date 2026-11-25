// Values marked [A DEFINIR] in docs/PLANO_DESENVOLVIMENTO.md (section 2.4).
// Defaults proposed in the plan; change here, not inside the rules.

/** Above this cost (BRL) every incident goes to human review (B15). */
export const REVIEW_VALUE_LIMIT = 10_000;

/** Below this extraction confidence (0–1) the incident goes to human review (B15). */
export const CONFIDENCE_THRESHOLD = 0.75;

/** Days after delivery to protest hidden damage (Código Civil, art. 754). */
export const HIDDEN_DAMAGE_CLAIM_DAYS = 10;

/** Maximum extraction attempts before sending the report to review (B5). */
export const MAX_EXTRACTION_ATTEMPTS = 2;

/** How long the graph waits for the transcription webhook before moving on (B4). */
export const TRANSCRIPTION_WAIT_MINUTES = 3;

/** Messages from the same phone within this window join the same report (B2). */
export const REPORT_WINDOW_SECONDS = 60;

/** Fixed fee added to the freight cost of a redelivery (B8). */
export const REDELIVERY_FEE = 50;

/** Share of the invoice used when a discrepancy has no stated value (B8). */
export const DISCREPANCY_FALLBACK_SHARE = 0.1;

/** Model used by extract_multimodal. Overridden by the EXTRACTION_MODEL env var. */
export const DEFAULT_EXTRACTION_MODEL = "claude-haiku-5-5";
