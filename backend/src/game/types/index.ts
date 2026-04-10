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

export type MeldType = 'single' | 'pair' | 'triple' | 'quad' | 'sequence';
export type PlayerType = 'human' | 'cpu';
export type CpuLevel = 'easy' | 'normal' | 'hard';
export type RoomStatus = 'waiting' | 'playing' | 'finished';
export type GamePhase = 'exchange' | 'playing' | 'result';

export type Card = {
  id: string;
  suit: Suit;
  rank: Rank;
};

export type Meld = {
  type: MeldType;
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

export type LobbyPlayer = {
  id: string;
  name: string;
  type: PlayerType;
  socketId: string | null;
  cpuLevel: CpuLevel;
  isDisconnected: boolean;
  isAutoControlled: boolean;
};

export type Player = {
  id: string;
  name: string;
  type: PlayerType;
  socketId: string | null;
  cpuLevel: CpuLevel;
  hand: Card[];
  finishOrder: number | null;
  isPassed: boolean;
  isDisconnected: boolean;
  isAutoControlled: boolean;
};

export type TableState = {
  currentMeld: Meld | null;
  lastValidPlayerId: string | null;
  isRevolution: boolean;
  isElevenBack: boolean;
  bindingLock: string | null;
};

export type SevenPassEffect = {
  type: 'seven-pass';
  playerId: string;
  targetPlayerId: string;
  count: number;
};

export type TenDiscardEffect = {
  type: 'ten-discard';
  playerId: string;
  count: number;
};

export type TwelveBomberEffect = {
  type: 'twelve-bomber';
  playerId: string;
  choices: Rank[];
};

export type ExchangeEffect = {
  type: 'exchange';
  playerId: string;
  targetPlayerId: string;
  count: number;
  incomingCards: Card[];
};

export type PendingEffect =
  | SevenPassEffect
  | TenDiscardEffect
  | TwelveBomberEffect
  | ExchangeEffect;

export type PendingResolution = {
  actorId: string;
  nextPlayerId: string;
  clearToActor: boolean;
  clearReason: 'eight-cut' | 'spade-three' | 'bomber' | null;
};

export type LogEntry = {
  id: string;
  message: string;
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

export type GameState = {
  phase: GamePhase;
  players: Player[];
  currentPlayerId: string;
  table: TableState;
  finishedOrder: string[];
  turnCount: number;
  ruleConfig: RuleConfig;
  pendingEffect: PendingEffect | null;
  pendingQueue: PendingEffect[];
  pendingResolution: PendingResolution | null;
  recentBomberEvent: RecentBomberEvent | null;
  recentRevolutionEvent: RecentRevolutionEvent | null;
  log: LogEntry[];
  winnerIds: string[];
  round: number;
};

export type RoomState = {
  roomId: string;
  hostPlayerId: string;
  players: LobbyPlayer[];
  status: RoomStatus;
  settings: RoomSettings;
  gameState: GameState | null;
  lastFinishedOrder: string[] | null;
};

export type PlayCardsPayload = {
  playerId: string;
  cardIds: string[];
};

export type ResolveEffectPayload =
  | {
      playerId: string;
      effectType: 'seven-pass' | 'ten-discard' | 'exchange';
      cardIds: string[];
    }
  | {
      playerId: string;
      effectType: 'twelve-bomber';
      targetRank: Rank;
    };

export type GameActionResult = {
  ok: boolean;
  message?: string;
};

export type PlayerView = {
  id: string;
  name: string;
  type: PlayerType;
  cpuLevel: CpuLevel;
  cardCount: number;
  rank: number | null;
  isDisconnected: boolean;
  isAutoControlled: boolean;
  isPassed: boolean;
  isHost: boolean;
  hand?: Card[];
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

export type GameView = {
  phase: GamePhase;
  currentPlayerId: string;
  table: TableState;
  pendingClearReason: PendingResolution['clearReason'];
  finishedOrder: string[];
  ruleConfig: RuleConfig;
  pendingEffect: PendingEffectView | null;
  recentBomberEvent: RecentBomberEvent | null;
  recentRevolutionEvent: RecentRevolutionEvent | null;
  latestLogEntry: LogEntry | null;
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
