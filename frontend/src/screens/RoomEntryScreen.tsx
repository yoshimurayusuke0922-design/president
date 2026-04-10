import { useEffect, useState } from 'react';

type RoomEntryScreenProps = {
  initialPlayerName: string;
  initialRoomId?: string;
  mode: 'create' | 'join';
  onBack: () => void;
  onSubmit: (playerName: string, roomId?: string) => Promise<void>;
};

export function RoomEntryScreen({ initialPlayerName, initialRoomId = '', mode, onBack, onSubmit }: RoomEntryScreenProps) {
  const [playerName, setPlayerName] = useState(initialPlayerName);
  const [roomId, setRoomId] = useState(initialRoomId);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setPlayerName(initialPlayerName);
  }, [initialPlayerName]);

  useEffect(() => {
    setRoomId(initialRoomId);
  }, [initialRoomId]);

  return (
    <section className="panel screen-panel">
      <h2>{mode === 'create' ? 'ルーム作成' : 'ルーム参加'}</h2>
      <label className="field">
        <span>プレイヤー名</span>
        <input
          maxLength={20}
          onChange={(event) => setPlayerName(event.target.value)}
          placeholder="プレイヤー名を入力"
          value={playerName}
        />
      </label>
      {mode === 'join' ? (
        <label className="field">
          <span>ルームコード</span>
          <input onChange={(event) => setRoomId(event.target.value.toUpperCase())} placeholder="ABC123" value={roomId} />
        </label>
      ) : null}
      <div className="hero-actions">
        <button
          className="primary-button"
          disabled={loading || !playerName.trim() || (mode === 'join' && !roomId.trim())}
          onClick={async () => {
            setLoading(true);
            try {
              await onSubmit(playerName.trim(), roomId.trim().toUpperCase());
            } finally {
              setLoading(false);
            }
          }}
          type="button"
        >
          {mode === 'create' ? '作成する' : '参加する'}
        </button>
        <button className="secondary-button" onClick={onBack} type="button">
          もどる
        </button>
      </div>
    </section>
  );
}
