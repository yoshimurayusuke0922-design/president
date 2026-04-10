type TitleScreenProps = {
  playerName: string;
  onPlayerNameChange: (value: string) => void;
  onLocal: () => void;
  onCreate: () => void;
  onJoin: () => void;
};

export function TitleScreen({ playerName, onPlayerNameChange, onLocal, onCreate, onJoin }: TitleScreenProps) {
  const canStart = playerName.trim().length > 0;

  return (
    <section className="hero-screen panel">
      <div className="hero-copy">
        <p className="eyebrow">Daifugo</p>
        <h1>大富豪オンライン</h1>
        <p>プレイヤー名を入力してください</p>
      </div>

      <label className="field hero-name-field">
        <span>名前</span>
        <input
          maxLength={20}
          onChange={(event) => onPlayerNameChange(event.target.value)}
          placeholder="名前を入力"
          value={playerName}
        />
      </label>

      <div className="hero-actions">
        <button className="primary-button" disabled={!canStart} onClick={onLocal} type="button">
          ローカルプレイ
        </button>
        <button className="primary-button" disabled={!canStart} onClick={onCreate} type="button">
          ルーム作成
        </button>
        <button className="secondary-button" disabled={!canStart} onClick={onJoin} type="button">
          ルーム参加
        </button>
      </div>
    </section>
  );
}
