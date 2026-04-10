import { memo } from 'react';

import type { PlayerView } from '../types/game';

type PlayerStatusProps = {
  player: PlayerView;
  isCurrentTurn: boolean;
  className?: string;
  compact?: boolean;
  minimal?: boolean;
  countOnly?: boolean;
  showNameOnBadge?: boolean;
  showBackFan?: boolean;
  fanSeat?: 'top' | 'left' | 'right';
};

function getOpponentFanCount(cardCount: number): number {
  if (cardCount <= 0) {
    return 0;
  }

  if (cardCount <= 3) {
    return cardCount;
  }

  if (cardCount <= 8) {
    return 4;
  }

  return 5;
}

function PlayerStatusComponent({
  player,
  isCurrentTurn,
  className = '',
  compact = false,
  minimal = false,
  countOnly = false,
  showNameOnBadge = false,
  showBackFan = false,
  fanSeat = 'top'
}: PlayerStatusProps) {
  if (minimal) {
    if (countOnly) {
      if (showBackFan) {
        const fanCount = getOpponentFanCount(player.cardCount);

        return (
          <article
            className={`player-status player-opponent-seat fan-seat-${fanSeat} ${compact ? 'is-compact' : ''} ${isCurrentTurn ? 'is-current' : ''} ${className}`.trim()}
          >
            <div className="player-seat-name">{player.name}</div>
            <div className="opponent-hand-fan" style={{ ['--fan-count' as string]: String(fanCount) }}>
              {Array.from({ length: fanCount }, (_, index) => {
                const center = (fanCount - 1) / 2;
                const distance = index - center;
                return (
                  <span
                    className="opponent-card-back"
                    key={`${player.id}-back-${index}`}
                    style={{
                      ['--fan-rotation' as string]: `${distance * 11}deg`,
                      ['--fan-lift' as string]: `${(center - Math.abs(distance)) * 0.14}rem`,
                      ['--fan-z' as string]: String(index + 1)
                    }}
                  />
                );
              })}
            </div>
            <div className="player-seat-count">{`${player.cardCount}枚`}</div>
          </article>
        );
      }

      return (
        <article
          className={`player-status player-count-badge ${showNameOnBadge ? 'has-name' : ''} ${compact ? 'is-compact' : ''} ${isCurrentTurn ? 'is-current' : ''} ${className}`.trim()}
        >
          {showNameOnBadge ? <div className="player-badge-name">{player.name}</div> : null}
          <div className="player-count-total">
            {player.cardCount}
            <span>枚</span>
          </div>
        </article>
      );
    }

    return (
      <article className={`player-status player-seat ${compact ? 'is-compact' : ''} ${isCurrentTurn ? 'is-current' : ''} ${className}`.trim()}>
        <div className="player-seat-name">{player.name}</div>
        <div className={`player-seat-avatar ${player.type === 'cpu' ? 'is-cpu' : 'is-human'}`} />
        <div className="player-seat-count">{`${player.cardCount}枚`}</div>
      </article>
    );
  }

  return (
    <article className={`player-status ${compact ? 'is-compact' : ''} ${isCurrentTurn ? 'is-current' : ''} ${className}`.trim()}>
      <div className="player-status-row">
        <strong>{player.name}</strong>
        <span>{player.type === 'cpu' ? `CPU ${player.cpuLevel}` : 'Human'}</span>
      </div>
      <div className="player-status-row">
        <span>{player.rank ? `${player.rank}位` : `${player.cardCount}枚`}</span>
        {player.isHost ? <span>Host</span> : null}
      </div>
      <div className="player-status-row">
        {player.isDisconnected ? <span className="status-pill warn">切断</span> : null}
        {player.isAutoControlled ? <span className="status-pill">自動</span> : null}
        {player.isPassed ? <span className="status-pill">Pass</span> : null}
      </div>
    </article>
  );
}

export const PlayerStatus = memo(PlayerStatusComponent, (previousProps, nextProps) => {
  return (
    previousProps.isCurrentTurn === nextProps.isCurrentTurn &&
    previousProps.className === nextProps.className &&
    previousProps.compact === nextProps.compact &&
    previousProps.minimal === nextProps.minimal &&
    previousProps.countOnly === nextProps.countOnly &&
    previousProps.showNameOnBadge === nextProps.showNameOnBadge &&
    previousProps.showBackFan === nextProps.showBackFan &&
    previousProps.fanSeat === nextProps.fanSeat &&
    previousProps.player.id === nextProps.player.id &&
    previousProps.player.name === nextProps.player.name &&
    previousProps.player.type === nextProps.player.type &&
    previousProps.player.cpuLevel === nextProps.player.cpuLevel &&
    previousProps.player.cardCount === nextProps.player.cardCount &&
    previousProps.player.rank === nextProps.player.rank &&
    previousProps.player.isDisconnected === nextProps.player.isDisconnected &&
    previousProps.player.isAutoControlled === nextProps.player.isAutoControlled &&
    previousProps.player.isPassed === nextProps.player.isPassed &&
    previousProps.player.isHost === nextProps.player.isHost
  );
});
