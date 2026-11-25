/** Every rule returns its result plus the rule id and a short reason (Portuguese) for the audit trail. */
export type RuleResult<T> = {
  result: T;
  rule: string;
  reason: string;
};
