import { memo } from 'react';

import type { Card } from '../types/game';
import { getCardAssetPath, getCardLabel } from '../lib/card-assets';

type CardViewProps = {
  card: Card;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  compact?: boolean;
  table?: boolean;
};

function CardViewComponent({ card, selected = false, disabled = false, onClick, compact = false, table = false }: CardViewProps) {
  const interactive = Boolean(onClick);
  const imagePath = getCardAssetPath(card);
  const label = getCardLabel(card);
  const isFaceCard = card.rank === 'J' || card.rank === 'Q' || card.rank === 'K';

  return (
    <button
      aria-label={label}
      aria-pressed={interactive ? selected : undefined}
      className={`card-view ${selected ? 'is-selected' : ''} ${compact ? 'is-compact' : ''} ${table ? 'is-table' : ''} ${isFaceCard ? 'is-face-card' : ''} ${interactive ? '' : 'is-static'}`.trim()}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <img alt="" className="card-asset" decoding="async" draggable={false} loading="eager" src={imagePath} />
    </button>
  );
}

export const CardView = memo(CardViewComponent, (previousProps, nextProps) => {
  return (
    previousProps.card.id === nextProps.card.id &&
    previousProps.card.rank === nextProps.card.rank &&
    previousProps.card.suit === nextProps.card.suit &&
    previousProps.selected === nextProps.selected &&
    previousProps.disabled === nextProps.disabled &&
    previousProps.compact === nextProps.compact &&
    previousProps.table === nextProps.table &&
    previousProps.onClick === nextProps.onClick
  );
});
