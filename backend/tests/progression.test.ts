import { describe, expect, it } from "vitest";
import {
  computeAttackValue,
  computeDefenseValue,
  experienceLevelFromTotalXp,
  skillLevelFromSkillPoints,
  skillPointsThresholdForSkillLevel,
  xpThresholdForLevel,
} from "../src/services/progression.js";

describe("progression", () => {
  it("xpThresholdForLevel matches document anchors", () => {
    expect(xpThresholdForLevel(1)).toBe(100);
    expect(xpThresholdForLevel(2)).toBe(230);
    expect(xpThresholdForLevel(3)).toBe(390);
  });

  it("experienceLevelFromTotalXp at boundaries", () => {
    expect(experienceLevelFromTotalXp(0)).toBe(1);
    expect(experienceLevelFromTotalXp(99)).toBe(1);
    expect(experienceLevelFromTotalXp(100)).toBe(1);
    expect(experienceLevelFromTotalXp(229)).toBe(1);
    expect(experienceLevelFromTotalXp(230)).toBe(2);
  });

  it("overrides wrong client experienceLevel via formula", () => {
    expect(experienceLevelFromTotalXp(400)).toBeGreaterThanOrEqual(2);
  });

  it("skill points thresholds", () => {
    expect(skillPointsThresholdForSkillLevel(1)).toBe(10);
    expect(skillPointsThresholdForSkillLevel(2)).toBe(23);
    expect(skillPointsThresholdForSkillLevel(0)).toBe(0);
  });

  it("skillLevelFromSkillPoints", () => {
    expect(skillLevelFromSkillPoints(0)).toBe(0);
    expect(skillLevelFromSkillPoints(9)).toBe(0);
    expect(skillLevelFromSkillPoints(10)).toBe(1);
    expect(skillLevelFromSkillPoints(22)).toBe(1);
    expect(skillLevelFromSkillPoints(23)).toBe(2);
  });

  it("computeAttackValue scales with level not skill", () => {
    expect(computeAttackValue(20, 1, 0.05)).toBe(20);
    expect(computeAttackValue(20, 2, 0.05)).toBe(Math.floor(20 * 1.05));
  });

  it("computeDefenseValue", () => {
    expect(computeDefenseValue(30, 3, 0.05)).toBe(Math.floor(30 * 1.1));
  });
});
