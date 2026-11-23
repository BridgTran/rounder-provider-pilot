/**
 * Feed ordering for a selected scholarship fund.
 *
 * A fund's Required rules decide *who* appears (that decision stays in the database
 * evaluator). This module only decides *where* each eligible candidate is listed:
 * candidates meeting more of the fund's Preferred rules come first, and candidates
 * meeting the same number are listed by candidate code so the order is stable and
 * readable for providers.
 */

export interface OrderableCandidate {
  id: string;
  candidateCode: string;
}

/**
 * Comparator: most Preferred rules met first, then candidate code ascending.
 * `preferencesMet` maps student id -> number of Preferred rules met.
 */
export function compareByPreferencesThenCode(
  a: OrderableCandidate,
  b: OrderableCandidate,
  preferencesMet: ReadonlyMap<string, number>,
): number {
  const difference = (preferencesMet.get(b.id) ?? 0) - (preferencesMet.get(a.id) ?? 0);
  if (difference !== 0) return difference;
  return a.candidateCode.localeCompare(b.candidateCode);
}
