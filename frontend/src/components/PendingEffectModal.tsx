import { useMemo } from 'react';

import type { Card, PendingEffectView, PlayerView, Rank } from '../types/game';

import { CardView } from './CardView';

type PendingEffectModalProps = {
  effect: PendingEffectView;
  self: PlayerView;
  players: PlayerView[];
  selectedCardIds: string[];
  onToggleCard: (cardId: string) => void;
  onConfirmCards: () => void;
  onSelectRank: (rank: Rank) => void;
};

export function PendingEffectModal({
  effect,
  self,
  players,
  selectedCardIds,
  onToggleCard,
  onConfirmCards,
  onSelectRank
}: PendingEffectModalProps) {
  const targetPlayer = useMemo(
    () => players.find((player) => player.id === ('targetPlayerId' in effect ? effect.targetPlayerId : '')),
    [effect, players]
  );
  const hand = self.hand ?? [];

  return (
    <div className="modal-backdrop">
      <div className="pending-modal">
        {effect.type === 'seven-pass' ? (
          <>
            <h3>7渡し</h3>
            <p>{targetPlayer ? `${targetPlayer.name} に渡すカードを 1 枚選んでください。` : '渡すカードを選んでください。'}</p>
            <div className="modal-card-grid">
              {hand.map((card: Card) => (
                <CardView card={card} key={card.id} onClick={() => onToggleCard(card.id)} selected={selectedCardIds.includes(card.id)} />
              ))}
            </div>
            <button className="primary-button" disabled={selectedCardIds.length !== effect.count} onClick={onConfirmCards} type="button">
              確定
            </button>
          </>
        ) : null}

        {effect.type === 'ten-discard' ? (
          <>
            <h3>10捨て</h3>
            <p>追加で捨てるカードを 1 枚選んでください。</p>
            <div className="modal-card-grid">
              {hand.map((card: Card) => (
                <CardView card={card} key={card.id} onClick={() => onToggleCard(card.id)} selected={selectedCardIds.includes(card.id)} />
              ))}
            </div>
            <button className="primary-button" disabled={selectedCardIds.length !== effect.count} onClick={onConfirmCards} type="button">
              捨てる
            </button>
          </>
        ) : null}

        {effect.type === 'exchange' ? (
          <>
            <h3>カード交換</h3>
            <p>{targetPlayer ? `${targetPlayer.name} に渡すカードを ${effect.count} 枚選んでください。` : `渡すカードを ${effect.count} 枚選んでください。`}</p>
            <div className="modal-card-grid">
              {hand.map((card: Card) => (
                <CardView card={card} key={card.id} onClick={() => onToggleCard(card.id)} selected={selectedCardIds.includes(card.id)} />
              ))}
            </div>
            <button className="primary-button" disabled={selectedCardIds.length !== effect.count} onClick={onConfirmCards} type="button">
              交換を確定
            </button>
          </>
        ) : null}

        {effect.type === 'twelve-bomber' ? (
          <>
            <h3>12ボンバー</h3>
            <p>全員に捨てさせる数字を選んでください。</p>
            <div className="rank-grid">
              {effect.choices.map((rank) => (
                <button className="chip-button" key={rank} onClick={() => onSelectRank(rank)} type="button">
                  {rank === 'JOKER' ? 'Joker' : rank}
                </button>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
