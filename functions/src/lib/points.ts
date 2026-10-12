export function computeAwardPoints(
  plannedMinutes: number,
  actualMinutes: number,
  bonusEligible: boolean,
): number {
  const effective = Math.min(plannedMinutes, actualMinutes);
  const base = Math.floor(effective / 10) * 2; // 2 points per 10 min
  const bonus = bonusEligible ? 5 : 0;
  return base + bonus;
}

export function missedTaskPenalty(): number {
  return -5;
}
