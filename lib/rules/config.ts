// Values marked [A DEFINIR] in docs/PLANO_DESENVOLVIMENTO.md (section 2.4).
// Defaults proposed in the plan; change here, not inside the rules.

/** Above this cost (BRL) every incident goes to human review (B15). */
export const REVIEW_VALUE_LIMIT = 10_000;

/** Below this extraction confidence (0–1) the incident goes to human review (B15). */
export const CONFIDENCE_THRESHOLD = 0.75;

/** Days after delivery to protest hidden damage (Código Civil, art. 754). */
export const HIDDEN_DAMAGE_CLAIM_DAYS = 10;

/** Fixed fee added to the freight cost of a redelivery (B8). */
export const REDELIVERY_FEE = 50;

/** Share of the invoice used when a discrepancy has no stated value (B8). */
export const DISCREPANCY_FALLBACK_SHARE = 0.1;
