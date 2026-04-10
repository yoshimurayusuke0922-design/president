type SelectedActionBarProps = {
  selectedCount: number;
  canPlay: boolean;
  canPass: boolean;
  onPlay: () => void;
  onPass: () => void;
};

export function SelectedActionBar({ selectedCount, canPlay, canPass, onPlay, onPass }: SelectedActionBarProps) {
  return (
    <div className="action-bar">
      <div className={`action-buttons ${selectedCount > 0 ? 'has-play' : 'only-pass'}`}>
        {selectedCount > 0 ? (
          <button className="primary-button" disabled={!canPlay} onClick={onPlay} type="button">
            出す
          </button>
        ) : null}
        <button className="secondary-button" disabled={!canPass} onClick={onPass} type="button">
          パス
        </button>
      </div>
    </div>
  );
}
