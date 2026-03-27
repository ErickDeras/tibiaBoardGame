/**
 * Curvas del diseño en docs/SISTEMA_COMBATE_PROGRESION_Y_CARTAS.md
 * XP umbral para nivel L: 15L² + 85L (L=1 → 100, L=2 → 230)
 * SP umbral para skill level S: 1.5S² + 8.5S (S=1 → 10, S=2 → 23)
 */

export const ATTACK_ALPHA = 0.05;
export const DEFENSE_ALPHA = 0.05;
export const MAGIC_ALPHA = 0.05;

export function xpThresholdForLevel(level: number): number {
  return 15 * level * level + 85 * level;
}

/**
 * Nivel de experiencia desde XP total (carrera). Mínimo 1 para cumplir modelo de personaje base (XP=0).
 * Fórmula: floor((-85 + sqrt(7225 + 60*xp)) / 30), clamp a >= 1
 */
export function experienceLevelFromTotalXp(totalXp: number): number {
  const xp = Math.max(0, Math.floor(totalXp));
  const disc = 85 * 85 + 60 * xp;
  const raw = Math.floor((-85 + Math.sqrt(disc)) / 30);
  return Math.max(1, raw);
}

export function skillPointsThresholdForSkillLevel(skillLevel: number): number {
  const s = Math.max(0, skillLevel);
  return 1.5 * s * s + 8.5 * s;
}

/**
 * Mayor S tal que umbral(S) <= puntos acumulados en la línea.
 */
export function skillLevelFromSkillPoints(skillPoints: number): number {
  const p = Math.max(0, Math.floor(skillPoints));
  let s = 0;
  while (skillPointsThresholdForSkillLevel(s + 1) <= p) {
    s += 1;
  }
  return s;
}

export function computeAttackValue(
  weaponAttackPoints: number,
  experienceLevel: number,
  alpha: number = ATTACK_ALPHA,
): number {
  const w = Math.max(0, weaponAttackPoints);
  const lv = Math.max(1, experienceLevel);
  return Math.floor(w * (1 + alpha * (lv - 1)));
}

export function computeDefenseValue(
  armorDefensePoints: number,
  experienceLevel: number,
  alpha: number = DEFENSE_ALPHA,
): number {
  const d = Math.max(0, armorDefensePoints);
  const lv = Math.max(1, experienceLevel);
  return Math.floor(d * (1 + alpha * (lv - 1)));
}

export function computeMagicAttackValue(
  magicWeaponPoints: number,
  experienceLevel: number,
  alpha: number = MAGIC_ALPHA,
): number {
  const m = Math.max(0, magicWeaponPoints);
  const lv = Math.max(1, experienceLevel);
  return Math.floor(m * (1 + alpha * (lv - 1)));
}
