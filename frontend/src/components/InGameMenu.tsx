type InGameMenuProps = {
  open: boolean;
  roomId: string;
  canResetRoom: boolean;
  resetLabel: string;
  busyAction: 'reset' | 'title' | null;
  onClose: () => void;
  onResetRoom: () => void;
  onReturnTitle: () => void;
};

export function InGameMenu({
  open,
  roomId,
  canResetRoom,
  resetLabel,
  busyAction,
  onClose,
  onResetRoom,
  onReturnTitle
}: InGameMenuProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="in-game-menu-backdrop" onClick={onClose} role="presentation">
      <section
        aria-label="ゲームメニュー"
        className="panel in-game-menu"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="in-game-menu-head">
          <div>
            <p className="eyebrow">Menu</p>
            <strong className="in-game-menu-room">ROOM {roomId}</strong>
          </div>
          <button className="chip-button" onClick={onClose} type="button">
            閉じる
          </button>
        </div>
        <div className="in-game-menu-actions">
          {canResetRoom ? (
            <button
              className="secondary-button"
              disabled={busyAction !== null}
              onClick={onResetRoom}
              type="button"
            >
              {busyAction === 'reset' ? '処理中...' : resetLabel}
            </button>
          ) : null}
          <button
            className="primary-button"
            disabled={busyAction !== null}
            onClick={onReturnTitle}
            type="button"
          >
            {busyAction === 'title' ? '戻っています...' : 'タイトルに戻る'}
          </button>
        </div>
        <p className="muted in-game-menu-note">
          タイトルに戻ると、この端末の参加セッションは解除されます。
        </p>
      </section>
    </div>
  );
}
