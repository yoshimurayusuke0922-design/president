import { useState } from 'react';

import { ConnectionStatus } from '../components/ConnectionStatus';
import type { RoomView } from '../types/game';

type LobbyScreenProps = {
  room: RoomView;
  connected: boolean;
  inviteUrl: string | null;
  onUpdateSettings: (next: Partial<RoomView['settings']>) => Promise<void>;
  onStart: () => Promise<void>;
  onBack: () => void;
};

const ruleKeys = [
  ['sequenceEnabled', '階段'],
  ['revolutionEnabled', '革命'],
  ['eightCutEnabled', '8切り'],
  ['spadeThreeReturnEnabled', 'スペ3返し'],
  ['bindingEnabled', '縛り'],
  ['fiveSkipEnabled', '5スキップ'],
  ['sevenPassEnabled', '7渡し'],
  ['tenDiscardEnabled', '10捨て'],
  ['elevenBackEnabled', '11バック'],
  ['twelveBomberEnabled', '12ボンバー'],
  ['cardExchangeEnabled', 'カード交換']
] as const;

async function copyText(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // fall through
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    return true;
  } catch {
    return false;
  }
}

export function LobbyScreen({ room, connected, inviteUrl, onUpdateSettings, onStart, onBack }: LobbyScreenProps) {
  const self = room.players.find((player) => player.id === room.selfPlayerId);
  const isHost = room.hostPlayerId === room.selfPlayerId;
  const humanCount = room.players.filter((player) => player.type === 'human').length;
  const maxCpuCount = 4 - humanCount;
  const enabledRuleCount = ruleKeys.filter(([key]) => room.settings.ruleConfig[key]).length;
  const projectedPlayers = humanCount + room.settings.cpuCount;
  const isOnlineRoom = !room.roomId.startsWith('LOCAL-');
  const [shareNotice, setShareNotice] = useState<string | null>(null);

  const showNotice = (message: string) => {
    setShareNotice(message);
    window.setTimeout(() => {
      setShareNotice((current) => (current === message ? null : current));
    }, 1800);
  };

  return (
    <section className="panel rule-select-screen">
      <div className="rule-select-header">
        <p className="eyebrow">Room</p>
        <h2>ルーム待機</h2>
      </div>

      <div className="rule-select-intro">
        <p>{isHost ? 'このルームのルールを設定して開始してください。' : 'このルームのルールで参加します。開始を待ってください。'}</p>
        <p className="muted">不足人数は開始時に CPU {room.settings.cpuCount} 人で補完されます。</p>
      </div>

      <div className="lobby-meta-strip">
        <span className="status-pill strong">ROOM {room.roomId}</span>
        <span className="status-pill">{projectedPlayers}/4 人</span>
        <span className="status-pill">{enabledRuleCount} ルールON</span>
      </div>

      {isOnlineRoom ? (
        <div className="lobby-share-card">
          <div className="lobby-share-head">
            <div>
              <span className="lobby-share-label">招待</span>
              <strong className="lobby-share-code">{room.roomId}</strong>
            </div>
            <ConnectionStatus connected={connected} />
          </div>
          <div className="lobby-share-actions">
            <button
              className="secondary-button"
              onClick={() => {
                void copyText(room.roomId).then((ok) => showNotice(ok ? 'ルームコードをコピーしました' : 'コピーできませんでした'));
              }}
              type="button"
            >
              コードをコピー
            </button>
            <button
              className="secondary-button"
              disabled={!inviteUrl}
              onClick={() => {
                if (!inviteUrl) {
                  return;
                }

                void copyText(inviteUrl).then((ok) => showNotice(ok ? '招待URLをコピーしました' : 'コピーできませんでした'));
              }}
              type="button"
            >
              招待URLをコピー
            </button>
            <button
              className="secondary-button"
              disabled={!inviteUrl}
              onClick={() => {
                if (!inviteUrl) {
                  return;
                }

                if (navigator.share) {
                  void navigator
                    .share({
                      title: '大富豪オンライン',
                      text: `ルームコード ${room.roomId} で参加してください`,
                      url: inviteUrl
                    })
                    .catch(() => undefined);
                  return;
                }

                void copyText(inviteUrl).then((ok) => showNotice(ok ? '招待URLをコピーしました' : 'コピーできませんでした'));
              }}
              type="button"
            >
              共有する
            </button>
          </div>
          <p className="lobby-share-note">同じ URL を開くと、参加画面にルームコードが入った状態で始まります。</p>
          {shareNotice ? <p className="lobby-share-feedback">{shareNotice}</p> : null}
        </div>
      ) : null}

      <div className="lobby-player-strip">
        {room.players.map((player) => (
          <span className="lobby-player-pill" key={player.id}>
            {player.name}
          </span>
        ))}
      </div>

      <div className="rule-controls-compact">
        <label className="rule-control-card">
          <span>CPU人数</span>
          <select
            disabled={!isHost}
            onChange={(event) => void onUpdateSettings({ cpuCount: Number(event.target.value) })}
            value={room.settings.cpuCount}
          >
            {Array.from({ length: maxCpuCount + 1 }, (_, index) => (
              <option key={index} value={index}>
                {index} 人
              </option>
            ))}
          </select>
        </label>
        <label className="rule-control-card">
          <span>CPU強さ</span>
          <select
            disabled={!isHost}
            onChange={(event) => void onUpdateSettings({ cpuLevel: event.target.value as RoomView['settings']['cpuLevel'] })}
            value={room.settings.cpuLevel}
          >
            <option value="easy">Easy</option>
            <option value="normal">Normal</option>
            <option value="hard">Hard</option>
          </select>
        </label>
      </div>

      <div className="rule-tile-grid">
        <div className="rule-tile is-static">
          <span>対戦人数</span>
          <strong>4人</strong>
        </div>
        {ruleKeys.map(([key, label]) => (
          <button
            aria-pressed={room.settings.ruleConfig[key]}
            className={`rule-tile ${room.settings.ruleConfig[key] ? 'is-active' : 'is-inactive'}`}
            disabled={!isHost}
            key={key}
            onClick={() =>
              void onUpdateSettings({
                ruleConfig: {
                  ...room.settings.ruleConfig,
                  [key]: !room.settings.ruleConfig[key]
                }
              })
            }
            type="button"
          >
            <span>{label}</span>
          </button>
        ))}
      </div>

      <div className="lobby-actions-compact">
        <button className="secondary-button" onClick={onBack} type="button">
          もどる
        </button>
        <button
          className="primary-button"
          disabled={!isHost || projectedPlayers !== 4 || !self}
          onClick={() => void onStart()}
          type="button"
        >
          {isHost ? 'ゲーム開始' : 'ホスト待ち'}
        </button>
      </div>
    </section>
  );
}
