export type Suit = 'S' | 'H' | 'D' | 'C' | 'JOKER';

export type Rank =
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '10'
  | 'J'
  | 'Q'
  | 'K'
  | 'A'
  | '2'
  | 'JOKER';

export type CpuLevel = 'easy' | 'normal' | 'hard';
export type RoomStatus = 'waiting' | 'playing' | 'finished';
export type GamePhase = 'exchange' | 'playing' | 'result';

export type Card = {
  id: string;
  suit: Suit;
  rank: Rank;
};

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

export type RoomSettings = {
  cpuCount: number;
  cpuLevel: CpuLevel;
  ruleConfig: RuleConfig;
};

export type PlayerView = {
  id: string;
  name: string;
  type: 'human' | 'cpu';
  cpuLevel: CpuLevel;
  cardCount: number;
  rank: number | null;
  isDisconnected: boolean;
  isAutoControlled: boolean;
  isPassed: boolean;
  isHost: boolean;
  hand?: Card[];
};

export type TableState = {
  currentMeld: {
    type: 'single' | 'pair' | 'triple' | 'quad' | 'sequence';
    cards: Card[];
    length: number;
    effectiveRank: number;
    lockKey: string | null;
    containsEight: boolean;
    containsJoker: boolean;
    fiveCount: number;
    containsSeven: boolean;
    containsTen: boolean;
    containsJack: boolean;
    containsQueen: boolean;
    isSpadeThreeSingle: boolean;
  } | null;
  lastValidPlayerId: string | null;
  isRevolution: boolean;
  isElevenBack: boolean;
  bindingLock: string | null;
};

export type PendingEffectView =
  | {
      type: 'seven-pass';
      playerId: string;
      count: number;
      targetPlayerId?: string;
    }
  | {
      type: 'ten-discard';
      playerId: string;
      count: number;
    }
  | {
      type: 'twelve-bomber';
      playerId: string;
      choices: Rank[];
    }
  | {
      type: 'exchange';
      playerId: string;
      targetPlayerId: string;
      count: number;
    };

export type RecentBomberEvent = {
  id: string;
  playerId: string;
  targetRank: Rank;
};

export type RecentRevolutionEvent = {
  id: string;
  playerId: string;
  isCounter: boolean;
  isActive: boolean;
};

export type GameView = {
  phase: GamePhase;
  currentPlayerId: string;
  table: TableState;
  pendingClearReason: 'eight-cut' | 'spade-three' | 'bomber' | null;
  finishedOrder: string[];
  ruleConfig: RuleConfig;
  pendingEffect: PendingEffectView | null;
  recentBomberEvent: RecentBomberEvent | null;
  recentRevolutionEvent: RecentRevolutionEvent | null;
  latestLogEntry: {
    id: string;
    message: string;
  } | null;
  legalMoveCardIds: string[][];
  canPass: boolean;
  round: number;
};

export type RoomView = {
  roomId: string;
  hostPlayerId: string;
  players: PlayerView[];
  status: RoomStatus;
  settings: RoomSettings;
  gameState: GameView | null;
  lastFinishedOrder: string[] | null;
  selfPlayerId: string;
};

export type Session = {
  roomId: string;
  playerId: string;
};
