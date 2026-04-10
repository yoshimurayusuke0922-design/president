import { memo } from 'react';

import type { TableState } from '../types/game';

import { CardView } from './CardView';

type TableAreaProps = {
  table: TableState;
};

function TableAreaComponent({ table }: TableAreaProps) {
  return (
    <section className={`table-area ${table.isRevolution ? 'is-revolution' : ''}`.trim()}>
      <div className="table-cards">
        {table.currentMeld ? (
          <div className="table-meld">
            <div aria-hidden="true" className="table-shadow-stack">
              <span className="table-shadow-card is-back" />
              <span className="table-shadow-card is-front" />
            </div>
            {table.currentMeld.cards.map((card, index, cards) => {
              const center = (cards.length - 1) / 2;
              const distance = index - center;
              const maxDistance = Math.max(center, 1);
              const rotationStep = cards.length <= 4 ? 10.5 : cards.length <= 6 ? 7.5 : 5;
              const spread = cards.length <= 4 ? 0.95 : cards.length <= 6 ? 0.78 : 0.58;
              const lift = `${(maxDistance - Math.abs(distance)) * 0.24}rem`;

              return (
                <div
                  className="table-card-slot"
                  key={card.id}
                  style={{
                    ['--meld-rotation' as string]: `${distance * rotationStep}deg`,
                    ['--meld-shift' as string]: `${distance * spread}rem`,
                    ['--meld-lift' as string]: lift,
                    ['--meld-z' as string]: String(index + 1)
                  }}
                >
                  <CardView card={card} table />
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export const TableArea = memo(TableAreaComponent, (previousProps, nextProps) => {
  if (
    previousProps.table.isRevolution !== nextProps.table.isRevolution ||
    previousProps.table.isElevenBack !== nextProps.table.isElevenBack ||
    previousProps.table.bindingLock !== nextProps.table.bindingLock
  ) {
    return false;
  }

  const previousMeld = previousProps.table.currentMeld;
  const nextMeld = nextProps.table.currentMeld;

  if (!previousMeld || !nextMeld) {
    return previousMeld === nextMeld;
  }

  if (
    previousMeld.type !== nextMeld.type ||
    previousMeld.length !== nextMeld.length ||
    previousMeld.effectiveRank !== nextMeld.effectiveRank ||
    previousMeld.cards.length !== nextMeld.cards.length
  ) {
    return false;
  }

  for (let index = 0; index < previousMeld.cards.length; index += 1) {
    const previousCard = previousMeld.cards[index];
    const nextCard = nextMeld.cards[index];
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
