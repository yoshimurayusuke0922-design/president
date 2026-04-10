import type { RoomSettings, RuleConfig } from '../types/index.js';

export function createDefaultRuleConfig(): RuleConfig {
  return {
    sequenceEnabled: true,
    revolutionEnabled: true,
    eightCutEnabled: true,
    spadeThreeReturnEnabled: true,
    bindingEnabled: true,
    fiveSkipEnabled: true,
    sevenPassEnabled: true,
    tenDiscardEnabled: true,
    elevenBackEnabled: true,
    twelveBomberEnabled: true,
    cardExchangeEnabled: true
  };
}

export function createDefaultRoomSettings(): RoomSettings {
  return {
    cpuCount: 3,
    cpuLevel: 'normal',
    ruleConfig: createDefaultRuleConfig()
  };
}
