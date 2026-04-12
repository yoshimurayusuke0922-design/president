import { memo, useMemo } from 'react';

import type { Card } from '../types/game';

import { CardView } from './CardView';

type HandAreaProps = {
  cards: Card[];
  selectedCardIds: string[];
  disabled: boolean;
  onToggle: (cardId: string) => void;
};

function HandAreaComponent({ cards, selectedCardIds, disabled, onToggle }: HandAreaProps) {
  const selectedCardIdSet = useMemo(() => new Set(selectedCardIds), [selectedCardIds]);

  return (
    <section className="hand-area">
      {cards.map((card, index) => {
        const selected = selectedCardIdSet.has(card.id);
        const center = (cards.length - 1) / 2;
        const distance = index - center;
        const maxDistance = Math.max(center, 1);
        const normalizedDistance = Math.abs(distance) / maxDistance;
        const fanRotation = cards.length >= 12 ? 2.45 : cards.length >= 9 ? 2.7 : 2.95;
        const edgePull = cards.length >= 12 ? 0.62 : cards.length >= 9 ? 0.54 : 0.44;
        const rotation = `${distance * fanRotation}deg`;
        const lift = `${(maxDistance - Math.abs(distance)) * 0.22}rem`;
        const inwardShift = `${-Math.sign(distance) * Math.pow(normalizedDistance, 1.35) * edgePull}rem`;

        return (
          <div
            className={`hand-card-slot ${selected ? 'is-selected' : ''}`}
            key={card.id}
            style={{
              ['--card-index' as string]: String(index),
              ['--card-total' as string]: String(cards.length),
              ['--card-center' as string]: String(center),
              ['--card-rotation' as string]: rotation,
              ['--card-lift' as string]: lift,
              ['--card-shift-x' as string]: inwardShift
            }}
          >
            <CardView card={card} disabled={disabled} onClick={() => onToggle(card.id)} selected={selected} />
          </div>
        );
      })}
    </section>
  );
}

export const HandArea = memo(HandAreaComponent, (previousProps, nextProps) => {
  if (previousProps.disabled !== nextProps.disabled || previousProps.onToggle !== nextProps.onToggle) {
    return false;
  }

  if (previousProps.selectedCardIds.length !== nextProps.selectedCardIds.length || previousProps.cards.length !== nextProps.cards.length) {
    return false;
  }

  for (let index = 0; index < previousProps.selectedCardIds.length; index += 1) {
    if (previousProps.selectedCardIds[index] !== nextProps.selectedCardIds[index]) {
      return false;
    }
  }

  for (let index = 0; index < previousProps.cards.length; index += 1) {
    const previousCard = previousProps.cards[index];
    const nextCard = nextProps.cards[index];
    if (
      previousCard?.id !== nextCard?.id ||
      previousCard?.rank !== nextCard?.rank ||
      previousCard?.suit !== nextCard?.suit
    ) {
      return false;
    }
  }

  return true;
});
