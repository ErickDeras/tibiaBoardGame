/** Daño efectivo: solo si raw > defensa se resta HP (mínimo 0 de daño). */
export function effectiveDamage(rawAttack: number, defenseValue: number): number {
  const d = rawAttack - defenseValue;
  return d > 0 ? d : 0;
}
