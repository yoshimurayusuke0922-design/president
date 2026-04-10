import type { RuleConfig } from '../types/game';

const labels: Record<keyof RuleConfig, string> = {
  sequenceEnabled: '階段',
  revolutionEnabled: '革命',
  eightCutEnabled: '8切り',
  spadeThreeReturnEnabled: 'スペ3返し',
  bindingEnabled: '縛り',
  fiveSkipEnabled: '5スキップ',
  sevenPassEnabled: '7渡し',
  tenDiscardEnabled: '10捨て',
  elevenBackEnabled: '11バック',
  twelveBomberEnabled: '12ボンバー',
  cardExchangeEnabled: 'カード交換'
};

type RuleSummaryProps = {
  rules: RuleConfig;
};

export function RuleSummary({ rules }: RuleSummaryProps) {
  return (
    <div className="rule-summary">
      {Object.entries(labels).map(([key, label]) => (
        <span className={`rule-chip ${rules[key as keyof RuleConfig] ? 'is-active' : 'is-muted'}`} key={key}>
          {label}
        </span>
      ))}
    </div>
  );
}
