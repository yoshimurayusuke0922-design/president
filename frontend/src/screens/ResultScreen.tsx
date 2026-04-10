import type { RoomView } from '../types/game';

type ResultScreenProps = {
  room: RoomView;
  canResetRoom: boolean;
  resetLabel: string;
  onRematch: () => Promise<void>;
  onResetRoom: () => Promise<void>;
  onReturnTitle: () => Promise<void>;
};

function getRankTitle(place: number, totalPlayers: number): string {
  if (totalPlayers <= 1) {
    return '勝者';
  }

  if (totalPlayers === 2) {
    return place === 1 ? '大富豪' : '大貧民';
  }

  if (totalPlayers === 3) {
    if (place === 1) {
      return '大富豪';
    }

    if (place === 2) {
      return '平民';
    }

    return '大貧民';
  }

  if (place === 1) {
    return '大富豪';
  }

  if (place === 2) {
    return '富豪';
  }

  if (place === totalPlayers - 1) {
    return '貧民';
  }

  if (place === totalPlayers) {
    return '大貧民';
  }

  return '平民';
}

function getRankTone(rankTitle: string): string {
  switch (rankTitle) {
    case '大富豪':
      return 'daifugo';
    case '富豪':
      return 'fugo';
    case '貧民':
      return 'hinmin';
    case '大貧民':
      return 'daihinmin';
    default:
      return 'heimin';
  }
}

export function ResultScreen({ room, canResetRoom, resetLabel, onRematch, onResetRoom, onReturnTitle }: ResultScreenProps) {
  const order = room.lastFinishedOrder ?? room.gameState?.finishedOrder ?? [];
  const totalPlayers = order.length;
  const ranking = order
    .map((playerId, index) => ({
      place: index + 1,
      rankTitle: getRankTitle(index + 1, totalPlayers),
      player: room.players.find((candidate) => candidate.id === playerId)
    }))
    .filter((entry) => entry.player);

  const isHost = room.hostPlayerId === room.selfPlayerId;

  return (
    <section className="panel result-panel">
      <p className="eyebrow">Result</p>
      <h2>順位確定</h2>
      <div className="result-list">
        {ranking.map(({ place, rankTitle, player }) => (
          <div className={`result-row result-row-${getRankTone(rankTitle)}`} key={player?.id}>
            <div className="result-rank-block">
              <strong className="result-rank-title">{rankTitle}</strong>
              <span className="result-place">{place}位</span>
            </div>
            <div className="result-player-block">
              <span className="result-player-name">{player?.name}</span>
              {player?.id === room.selfPlayerId ? <span className="result-player-tag">あなた</span> : null}
            </div>
          </div>
        ))}
      </div>
      <div className="hero-actions">
        <button className="primary-button" disabled={!isHost} onClick={() => void onRematch()} type="button">
          もう一度遊ぶ
        </button>
        {canResetRoom ? (
          <button className="secondary-button" onClick={() => void onResetRoom()} type="button">
            {resetLabel}
          </button>
        ) : null}
        <button className="secondary-button" onClick={() => void onReturnTitle()} type="button">
          タイトルに戻る
        </button>
      </div>
    </section>
  );
}
