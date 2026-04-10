# Technical Design

## 実装方針

- UI とゲームロジックを分離する
- ゲーム進行はサーバ権威で扱う
- クライアントは表示と入力送信を担う
- CPU 思考はサーバ側で実行する
- 将来拡張しやすいよう、ゲーム状態はシリアライズしやすい形にする

## 推奨技術スタック

- Frontend: React + TypeScript
- Backend: Node.js + TypeScript
- Realtime: Socket.IO または WebSocket
- Styling: Tailwind CSS
- Testing: Vitest または Jest

## ディレクトリ案

```text
frontend/
  src/
    components/
    screens/
    hooks/
    store/
    services/
    types/

backend/
  src/
    game/
      core/
      rules/
      ai/
      types/
      utils/
    rooms/
    sockets/
    services/
    tests/

skills/
  setup/
  debug/
  codegen/
  prompts/

docs/
  00_overview/
  01_rules/
  02_product/
  03_architecture/
  04_ai/
  05_prompts/
```

## 主要モジュール

### backend/game/types

- Card
- Player
- Meld
- GameState
- TurnState
- RuleConfig
- RoomState
- PendingEffect

### backend/game/core

- createDeck
- shuffleDeck
- dealCards
- determineStartingPlayer
- getLegalMoves
- applyMove
- applyPass
- resolvePendingEffect
- checkFinish
- nextTurn
- createNextRoundIfNeeded

### backend/game/rules

- compareMeld
- validateMeld
- detectSequence
- detectRevolution
- detectEightCut
- detectSpadeThreeReturn
- detectBinding
- detectFiveSkip
- detectSevenPass
- detectTenDiscard
- detectElevenBack
- detectTwelveBomber

### backend/game/ai

- chooseMoveEasy
- chooseMoveNormal
- chooseMoveHard
- choosePassCardForSeven
- chooseDiscardCardForTen
- chooseTargetRankForTwelveBomber
- chooseExchangeCards

### backend/rooms

- createRoom
- joinRoom
- addCpuPlayers
- startGame
- handleReconnect
- endRoom

## 型のイメージ

```ts
export type Suit = 'S' | 'H' | 'D' | 'C' | 'JOKER';

export type Rank =
  | '3' | '4' | '5' | '6' | '7' | '8' | '9'
  | '10' | 'J' | 'Q' | 'K' | 'A' | '2' | 'JOKER';

export type Card = {
  id: string;
  suit: Suit;
  rank: Rank;
};

export type MeldType = 'single' | 'pair' | 'triple' | 'quad' | 'sequence';

export type Meld = {
  type: MeldType;
  cards: Card[];
  effectiveRank: number;
  length: number;
  containsEight: boolean;
  containsJoker: boolean;
};

export type PlayerType = 'human' | 'cpu';
export type CpuLevel = 'easy' | 'normal' | 'hard';

export type RuleConfig = {
  sequenceEnabled: boolean;
  revolutionEnabled: boolean;
  eightCutEnabled: boolean;
  spadeThreeReturnEnabled: boolean;
  bindingEnabled: boolean;
  fiveSkipEnabled: boolean;
  sevenPassEnabled: boolean;
  tenDiscardEnabled: boolean;
  elevenBackEnabled: boolean;
  twelveBomberEnabled: boolean;
  cardExchangeEnabled: boolean;
};

export type PendingEffect =
  | { type: 'seven-pass'; playerId: string }
  | { type: 'ten-discard'; playerId: string }
  | { type: 'twelve-bomber'; playerId: string }
  | { type: 'card-exchange'; playerId: string; count: number };

export type Player = {
  id: string;
  name: string;
  type: PlayerType;
  socketId?: string;
  cpuLevel?: CpuLevel;
  hand: Card[];
  rank?: number;
  isEliminated: boolean;
  isPassed: boolean;
  isDisconnected?: boolean;
};

export type TableState = {
  currentMeld: Meld | null;
  lastValidPlayerId: string | null;
  isRevolution: boolean;
  isElevenBack: boolean;
  isBinding: boolean;
  bindingSuit: Suit | null;
};

export type GameState = {
  players: Player[];
  currentPlayerIndex: number;
  table: TableState;
  finishedOrder: string[];
  turnCount: number;
  phase: 'lobby' | 'setup' | 'playing' | 'result';
  log: string[];
  ruleConfig: RuleConfig;
  pendingEffect: PendingEffect | null;
};

export type RoomState = {
  roomId: string;
  hostPlayerId: string;
  players: Player[];
  gameState: GameState | null;
  status: 'waiting' | 'playing' | 'finished';
};
```

## 設計原則

- クライアントから送られた手はサーバで必ず再検証する
- UI から直接ルール判定を書かない
- ルール判定は純関数中心にする
- CPU は合法手生成に依存する
- 追加効果のあるルールは `pendingEffect` で段階処理する
- まずは 1 ルーム単位のメモリ管理でよい
- DB は初期版では必須ではない
