import type {
  Card,
  GameActionResult,
  GameState,
  LobbyPlayer,
  PendingEffect,
  PendingResolution,
  Player,
  ResolveEffectPayload,
  RoomSettings
} from '../types/index.js';
import { createMeldFromCards, getLegalMelds, isPlayableMeld, isSpadeThreeReturn } from '../rules/melds.js';
import {
  createDeck,
  getDisplayCardLabel,
  getPlayerLabel,
  getRankLabel,
  getStrongestCards,
  shuffleDeck,
  sortCards,
  sortPlayersHand
} from '../utils/cards.js';
import { createLogId } from '../utils/ids.js';

function appendLog(gameState: GameState, message: string): void {
  gameState.log.unshift({
    id: createLogId(),
    message
  });
  gameState.log = gameState.log.slice(0, 30);
}

function getClearReasonLabel(reason: string | null): string | null {
  switch (reason) {
    case 'eight-cut':
      return '8切り';
    case 'spade-three':
      return 'スペ3返し';
    case 'bomber':
      return '12ボンバー';
    case '蜈ｨ蜩｡繝代せ':
      return '全員パス';
    default:
      return reason;
  }
}

function createGamePlayers(players: LobbyPlayer[]): Player[] {
  return players.map((player) => ({
    id: player.id,
    name: player.name,
    type: player.type,
    socketId: player.socketId,
    cpuLevel: player.cpuLevel,
    hand: [],
    finishOrder: null,
    isPassed: false,
    isDisconnected: player.isDisconnected,
    isAutoControlled: player.isAutoControlled
  }));
}

function dealCards(players: Player[]): void {
  const deck = shuffleDeck(createDeck());

  for (let index = 0; index < deck.length; index += 1) {
    players[index % players.length]?.hand.push(deck[index]);
  }

  sortPlayersHand(players);
}

function findPlayer(gameState: GameState, playerId: string): Player | undefined {
  return gameState.players.find((player) => player.id === playerId);
}

function getPlayerIndex(gameState: GameState, playerId: string): number {
  return gameState.players.findIndex((player) => player.id === playerId);
}

function getActivePlayers(gameState: GameState): Player[] {
  return gameState.players.filter((player) => player.finishOrder === null);
}

function getNextActivePlayerId(gameState: GameState, fromPlayerId: string, steps = 1, includeSelf = false): string {
  const activePlayers = getActivePlayers(gameState);
  if (activePlayers.length <= 1) {
    return fromPlayerId;
  }

  const startIndex = getPlayerIndex(gameState, fromPlayerId);
  if (includeSelf) {
    const currentPlayer = gameState.players[startIndex];
    if (currentPlayer && currentPlayer.finishOrder === null && steps === 0) {
      return currentPlayer.id;
    }
  }

  let remaining = steps === 0 ? 1 : steps;
  let cursor = startIndex;

  while (remaining > 0) {
    cursor = (cursor + 1) % gameState.players.length;
    const player = gameState.players[cursor];

    if (player && player.finishOrder === null) {
      remaining -= 1;
    }
  }

  const nextPlayer = gameState.players[cursor] ?? activePlayers[0];
  return nextPlayer.id;
}

function getNextNonPassedPlayerId(gameState: GameState, fromPlayerId: string, steps = 1, includeSelf = false): string {
  const remainingPlayers = gameState.players.filter((player) => player.finishOrder === null && !player.isPassed);
  if (remainingPlayers.length <= 1) {
    return remainingPlayers[0]?.id ?? fromPlayerId;
  }

  const startIndex = getPlayerIndex(gameState, fromPlayerId);
  if (includeSelf) {
    const currentPlayer = gameState.players[startIndex];
    if (currentPlayer && currentPlayer.finishOrder === null && !currentPlayer.isPassed && steps === 0) {
      return currentPlayer.id;
    }
  }

  let remaining = steps === 0 ? 1 : steps;
  let cursor = startIndex;

  while (remaining > 0) {
    cursor = (cursor + 1) % gameState.players.length;
    const player = gameState.players[cursor];
    if (player && player.finishOrder === null && !player.isPassed) {
      remaining -= 1;
    }
  }

  return gameState.players[cursor]?.id ?? remainingPlayers[0].id;
}

function determineStartingPlayerId(players: Player[]): string {
  const owner = players.find((player) => player.hand.some((card) => card.rank === '3' && card.suit === 'D'));
  return owner?.id ?? players[0]?.id ?? '';
}

function clearTable(gameState: GameState, starterId: string, reason: string | null): void {
  const nextStarter = findPlayer(gameState, starterId)?.finishOrder === null ? starterId : getNextActivePlayerId(gameState, starterId);

  gameState.table.currentMeld = null;
  gameState.table.lastValidPlayerId = null;
  gameState.table.bindingLock = null;
  gameState.table.isElevenBack = false;
  gameState.currentPlayerId = nextStarter;

  for (const player of gameState.players) {
    player.isPassed = false;
  }

  if (reason) {
    appendLog(gameState, `場を流しました: ${getClearReasonLabel(reason)}`);
  }
}

function hasPendingClearAnimation(gameState: GameState): boolean {
  return Boolean(gameState.pendingResolution?.clearToActor);
}

function syncFinishOrder(gameState: GameState): void {
  for (const player of gameState.players) {
    if (player.finishOrder === null && player.hand.length === 0) {
      gameState.finishedOrder.push(player.id);
      player.finishOrder = gameState.finishedOrder.length;
      player.isPassed = true;
      appendLog(gameState, `${getPlayerLabel(player.name, player.type)} が${player.finishOrder}位で上がりました`);
    }
  }

  const remaining = gameState.players.filter((player) => player.finishOrder === null);
  if (remaining.length === 1 && gameState.finishedOrder.length === gameState.players.length - 1) {
    remaining[0].finishOrder = gameState.players.length;
    remaining[0].isPassed = true;
    gameState.finishedOrder.push(remaining[0].id);
    appendLog(gameState, `${getPlayerLabel(remaining[0].name, remaining[0].type)} が${remaining[0].finishOrder}位で終了しました`);
  }

  if (gameState.finishedOrder.length === gameState.players.length) {
    gameState.phase = 'result';
    gameState.winnerIds = [...gameState.finishedOrder];
    gameState.pendingEffect = null;
    gameState.pendingQueue = [];
    gameState.pendingResolution = null;
  }
}

function finalizePendingResolution(gameState: GameState): void {
  const resolution = gameState.pendingResolution;
  gameState.pendingResolution = null;

  if (!resolution || gameState.phase === 'result') {
    return;
  }

  if (resolution.clearToActor) {
    clearTable(gameState, resolution.actorId, resolution.clearReason);
    return;
  }

  gameState.currentPlayerId = getNextActivePlayerId(gameState, resolution.nextPlayerId, 0, true);
}

function finalizeExchangePhase(gameState: GameState): void {
  sortPlayersHand(gameState.players);
  gameState.phase = 'playing';
  gameState.currentPlayerId = determineStartingPlayerId(gameState.players);
  appendLog(gameState, 'カード交換が完了しました');
}

function advancePendingEffect(gameState: GameState): void {
  if (gameState.pendingEffect || gameState.phase === 'result') {
    return;
  }

  while (gameState.pendingQueue.length > 0) {
    const next = gameState.pendingQueue.shift() ?? null;
    if (!next) {
      break;
    }

    const player = findPlayer(gameState, next.playerId);
    if (!player) {
      continue;
    }

    if (next.type !== 'twelve-bomber' && player.finishOrder !== null) {
      continue;
    }

    if ((next.type === 'seven-pass' || next.type === 'ten-discard') && player.hand.length === 0) {
      continue;
    }

    if (next.type === 'exchange' && player.hand.length < next.count) {
      continue;
    }

    gameState.pendingEffect = next;
    return;
  }

  if (gameState.phase === 'exchange') {
    finalizeExchangePhase(gameState);
    return;
  }

  if (hasPendingClearAnimation(gameState)) {
    return;
  }

  finalizePendingResolution(gameState);
}

function removeCardsFromHand(player: Player, cardIds: string[]): Card[] {
  const idSet = new Set(cardIds);
  const removed: Card[] = [];
  const remaining: Card[] = [];

  for (const card of player.hand) {
    if (idSet.has(card.id)) {
      removed.push(card);
    } else {
      remaining.push(card);
    }
  }

  player.hand = remaining;
  return removed;
}

function getSelectedCards(player: Player, cardIds: string[]): Card[] | null {
  const idSet = new Set(cardIds);
  const cards = player.hand.filter((card) => idSet.has(card.id));
  return cards.length === cardIds.length ? cards : null;
}

function createExchangeQueue(gameState: GameState, previousOrder: string[]): PendingEffect[] {
  const entries = [
    { winnerId: previousOrder[0], loserId: previousOrder[3], count: 2 },
    { winnerId: previousOrder[1], loserId: previousOrder[2], count: 1 }
  ];

  const queue: PendingEffect[] = [];

  for (const entry of entries) {
    const winner = findPlayer(gameState, entry.winnerId);
    const loser = findPlayer(gameState, entry.loserId);

    if (!winner || !loser || entry.count <= 0) {
      continue;
    }

    const incomingCards = getStrongestCards(loser.hand, entry.count);
    removeCardsFromHand(
      loser,
      incomingCards.map((card) => card.id)
    );

    queue.push({
      type: 'exchange',
      playerId: winner.id,
      targetPlayerId: loser.id,
      count: entry.count,
      incomingCards
    });
  }

  return queue;
}

function triggerRevolution(gameState: GameState, playerId: string): void {
  const wasRevolutionActive = gameState.table.isRevolution;
  gameState.table.isRevolution = !wasRevolutionActive;
  gameState.recentRevolutionEvent = {
    id: createLogId(),
    playerId,
    isCounter: wasRevolutionActive,
    isActive: gameState.table.isRevolution
  };
  appendLog(gameState, `革命 ${gameState.table.isRevolution ? '発生' : '解除'}`);
}

function applyStaticEffects(gameState: GameState, playerId: string, containsJack: boolean, isQuad: boolean): void {
  if (gameState.ruleConfig.revolutionEnabled && isQuad) {
    triggerRevolution(gameState, playerId);
  }

  if (gameState.ruleConfig.elevenBackEnabled && containsJack) {
    gameState.table.isElevenBack = true;
    appendLog(gameState, '11バック');
  }
}

function getPureRankMeldRank(cards: Card[]): Card['rank'] | null {
  const nonJokers = cards.filter((card) => card.rank !== 'JOKER');
  if (nonJokers.length === 0) {
    return null;
  }

  const rank = nonJokers[0]?.rank ?? null;
  return rank && nonJokers.every((card) => card.rank === rank) ? rank : null;
}

function shouldActivateElevenBack(
  meld: NonNullable<GameState['table']['currentMeld']>,
  cards: Card[],
  ruleConfig: GameState['ruleConfig']
): boolean {
  return ruleConfig.elevenBackEnabled && meld.type !== 'sequence' && getPureRankMeldRank(cards) === 'J';
}

function shouldActivateTwelveBomber(
  meld: NonNullable<GameState['table']['currentMeld']>,
  cards: Card[],
  ruleConfig: GameState['ruleConfig']
): boolean {
  return ruleConfig.twelveBomberEnabled && meld.type !== 'sequence' && getPureRankMeldRank(cards) === 'Q';
}

function getTenDiscardCount(meld: NonNullable<GameState['table']['currentMeld']>): number {
  return meld.cards.filter((card) => card.rank === '10').length;
}

function getSevenPassCount(meld: NonNullable<GameState['table']['currentMeld']>): number {
  return meld.cards.filter((card) => card.rank === '7').length;
}

function getQueenBomberCount(meld: NonNullable<GameState['table']['currentMeld']>): number {
  return meld.cards.filter((card) => card.rank === 'Q').length;
}

function updateBinding(gameState: GameState, previousMeld: GameState['table']['currentMeld'], nextMeld: NonNullable<GameState['table']['currentMeld']>): void {
  if (!gameState.ruleConfig.bindingEnabled || !previousMeld) {
    return;
  }

  if (previousMeld.type === nextMeld.type && previousMeld.length === nextMeld.length && previousMeld.lockKey && previousMeld.lockKey === nextMeld.lockKey) {
    if (gameState.table.bindingLock !== previousMeld.lockKey) {
      appendLog(gameState, `縛り発生: ${previousMeld.lockKey}`);
    }
    gameState.table.bindingLock = previousMeld.lockKey;
  }
}

function createPendingResolution(actorId: string, nextPlayerId: string, clearReason: PendingResolution['clearReason']): PendingResolution {
  return {
    actorId,
    nextPlayerId,
    clearToActor: clearReason !== null,
    clearReason
  };
}

export function createGameState(players: LobbyPlayer[], settings: RoomSettings, round: number, previousOrder: string[] | null): GameState {
  const gamePlayers = createGamePlayers(players);
  dealCards(gamePlayers);

  const gameState: GameState = {
    phase: 'playing',
    players: gamePlayers,
    currentPlayerId: determineStartingPlayerId(gamePlayers),
    table: {
      currentMeld: null,
      lastValidPlayerId: null,
      isRevolution: false,
      isElevenBack: false,
      bindingLock: null
    },
    finishedOrder: [],
    turnCount: 0,
    ruleConfig: settings.ruleConfig,
    pendingEffect: null,
    pendingQueue: [],
    pendingResolution: null,
    recentBomberEvent: null,
    recentRevolutionEvent: null,
    log: [],
    winnerIds: [],
    round
  };

  appendLog(gameState, `Round ${round} を開始しました`);

  if (settings.ruleConfig.cardExchangeEnabled && previousOrder && previousOrder.length === 4) {
    gameState.phase = 'exchange';
    gameState.pendingQueue = createExchangeQueue(gameState, previousOrder);
    advancePendingEffect(gameState);
  }

  return gameState;
}

export function getLegalMoveCardIds(gameState: GameState, playerId: string): string[][] {
  if (
    gameState.phase !== 'playing' ||
    gameState.pendingEffect ||
    hasPendingClearAnimation(gameState) ||
    gameState.currentPlayerId !== playerId
  ) {
    return [];
  }

  const player = findPlayer(gameState, playerId);
  if (!player) {
    return [];
  }

  return getLegalMelds(gameState, player.hand).map((meld) => meld.cards.map((card) => card.id).sort());
}

export function playCards(gameState: GameState, playerId: string, cardIds: string[]): GameActionResult {
  if (gameState.phase !== 'playing') {
    return { ok: false, message: 'まだカードを出せる状態ではありません' };
  }

  if (gameState.pendingEffect) {
    return { ok: false, message: '追加効果を先に解決してください' };
  }

  if (hasPendingClearAnimation(gameState)) {
    return { ok: false, message: '演出中です' };
  }

  if (gameState.currentPlayerId !== playerId) {
    return { ok: false, message: 'あなたの番ではありません' };
  }

  const player = findPlayer(gameState, playerId);
  if (!player || player.finishOrder !== null) {
    return { ok: false, message: 'プレイヤーが見つかりません' };
  }

  const selectedCards = getSelectedCards(player, cardIds);
  if (!selectedCards) {
    return { ok: false, message: '手札にないカードです' };
  }

  const meld = createMeldFromCards(selectedCards, gameState.ruleConfig);
  if (!meld) {
    return { ok: false, message: 'その組み合わせでは出せません' };
  }

  if (!isPlayableMeld(gameState, meld)) {
    return { ok: false, message: 'その札は場に出せません' };
  }

  const previousMeld = gameState.table.currentMeld;
  const spadeThreeReturn = isSpadeThreeReturn(meld, previousMeld, gameState.ruleConfig);
  const activatesElevenBack = shouldActivateElevenBack(meld, selectedCards, gameState.ruleConfig);
  const activatesTwelveBomber = shouldActivateTwelveBomber(meld, selectedCards, gameState.ruleConfig);

  removeCardsFromHand(player, cardIds);
  player.isPassed = false;
  gameState.turnCount += 1;
  gameState.table.currentMeld = meld;
  gameState.table.lastValidPlayerId = playerId;

  appendLog(
    gameState,
    `${getPlayerLabel(player.name, player.type)} が ${meld.cards.map((card) => getDisplayCardLabel(card)).join(', ')} を出しました`
  );

  applyStaticEffects(gameState, playerId, activatesElevenBack, meld.type === 'quad');
  updateBinding(gameState, previousMeld, meld);

  const skipCount = gameState.ruleConfig.fiveSkipEnabled ? meld.fiveCount : 0;
  if (skipCount > 0) {
    appendLog(gameState, `5スキップ ${skipCount}人`);
  }

  const nextPlayerId = getNextNonPassedPlayerId(gameState, playerId, 1 + skipCount);
  const pendingQueue: PendingEffect[] = [];

  if (gameState.ruleConfig.sevenPassEnabled && meld.containsSeven && player.hand.length > 0) {
    const sevenPassCount = Math.min(getSevenPassCount(meld), player.hand.length);
    pendingQueue.push({
      type: 'seven-pass',
      playerId,
      targetPlayerId: nextPlayerId,
      count: sevenPassCount
    });
  }

  if (gameState.ruleConfig.tenDiscardEnabled && meld.containsTen && player.hand.length > 0) {
    const tenDiscardCount = Math.min(getTenDiscardCount(meld), player.hand.length);
    pendingQueue.push({
      type: 'ten-discard',
      playerId,
      count: tenDiscardCount
    });
  }

  if (activatesTwelveBomber) {
    const bomberCount = Math.max(1, getQueenBomberCount(meld));
    for (let index = 0; index < bomberCount; index += 1) {
      pendingQueue.push({
        type: 'twelve-bomber',
        playerId,
        choices: ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2', 'JOKER']
      });
    }
  }

  const clearReason: PendingResolution['clearReason'] =
    gameState.ruleConfig.eightCutEnabled && meld.containsEight
      ? 'eight-cut'
      : spadeThreeReturn
        ? 'spade-three'
        : null;

  if (clearReason) {
    appendLog(gameState, getClearReasonLabel(clearReason) ?? clearReason);
  }

  gameState.pendingResolution = createPendingResolution(playerId, nextPlayerId, clearReason);
  gameState.pendingQueue = pendingQueue;

  syncFinishOrder(gameState);
  advancePendingEffect(gameState);

  return { ok: true };
}

export function passTurn(gameState: GameState, playerId: string): GameActionResult {
  if (gameState.phase !== 'playing') {
    return { ok: false, message: 'まだ対戦中ではありません' };
  }

  if (gameState.pendingEffect) {
    return { ok: false, message: '追加効果を先に解決してください' };
  }

  if (hasPendingClearAnimation(gameState)) {
    return { ok: false, message: '演出中です' };
  }

  if (gameState.currentPlayerId !== playerId) {
    return { ok: false, message: 'あなたの番ではありません' };
  }

  if (!gameState.table.currentMeld) {
    return { ok: false, message: '場が空のときはパスできません' };
  }

  const player = findPlayer(gameState, playerId);
  if (!player || player.finishOrder !== null) {
    return { ok: false, message: 'プレイヤーが見つかりません' };
  }

  player.isPassed = true;
  appendLog(gameState, `${getPlayerLabel(player.name, player.type)} がパスしました`);

  const activeUnpassedPlayers = gameState.players.filter((candidate) => candidate.finishOrder === null && !candidate.isPassed);

  if (activeUnpassedPlayers.length <= 1) {
    const lastValidPlayerId = gameState.table.lastValidPlayerId ?? activeUnpassedPlayers[0]?.id ?? playerId;
    clearTable(gameState, lastValidPlayerId, '蜈ｨ蜩｡繝代せ');
    return { ok: true };
  }

  gameState.currentPlayerId = getNextNonPassedPlayerId(gameState, playerId);
  return { ok: true };
}

export function resolvePendingEffect(gameState: GameState, payload: ResolveEffectPayload): GameActionResult {
  const effect = gameState.pendingEffect;
  if (!effect) {
    return { ok: false, message: '解決待ちの追加効果がありません' };
  }

  if (effect.playerId !== payload.playerId) {
    return { ok: false, message: 'この効果を解決できるプレイヤーではありません' };
  }

  const player = findPlayer(gameState, payload.playerId);
  if (!player) {
    return { ok: false, message: 'プレイヤーが見つかりません' };
  }

  if (effect.type === 'twelve-bomber') {
    if (payload.effectType !== 'twelve-bomber' || !effect.choices.includes(payload.targetRank)) {
      return { ok: false, message: '無効なボンバー指定です' };
    }

    gameState.recentBomberEvent = {
      id: createLogId(),
      playerId: payload.playerId,
      targetRank: payload.targetRank
    };

    let discarded = 0;
    for (const target of gameState.players) {
      const removed = target.hand.filter((card) => card.rank === payload.targetRank);
      if (removed.length > 0) {
        removeCardsFromHand(
          target,
          removed.map((card) => card.id)
        );
        discarded += removed.length;
      }
    }

    appendLog(gameState, `${getPlayerLabel(player.name, player.type)} が12ボンバーで ${getRankLabel(payload.targetRank)} を指定しました`);
    if (discarded > 0) {
      appendLog(gameState, `12ボンバーで ${discarded} 枚が一度に捨てられました`);
    }
  } else {
    if (payload.effectType !== effect.type) {
      return { ok: false, message: '効果タイプが一致しません' };
    }

    if (payload.cardIds.length !== effect.count) {
      return { ok: false, message: '選ぶ枚数が正しくありません' };
    }

    const selectedCards = getSelectedCards(player, payload.cardIds);
    if (!selectedCards) {
      return { ok: false, message: '手札にないカードです' };
    }

    if (effect.type === 'seven-pass') {
      const targetPlayer = findPlayer(gameState, effect.targetPlayerId);
      if (!targetPlayer) {
        return { ok: false, message: '渡し先が見つかりません' };
      }

      const passedCards = removeCardsFromHand(player, payload.cardIds);
      targetPlayer.hand.push(...passedCards);
      targetPlayer.hand = sortCards(targetPlayer.hand);
      appendLog(
        gameState,
        `${getPlayerLabel(player.name, player.type)} が7渡しで ${getPlayerLabel(targetPlayer.name, targetPlayer.type)} に ${passedCards.length} 枚渡しました`
      );
    }

    if (effect.type === 'ten-discard') {
      const discardedCards = removeCardsFromHand(player, payload.cardIds);
      appendLog(
        gameState,
        `${getPlayerLabel(player.name, player.type)} が10捨てで ${discardedCards.map((card) => getDisplayCardLabel(card)).join(', ')} を捨てました`
      );
    }

    if (effect.type === 'exchange') {
      const targetPlayer = findPlayer(gameState, effect.targetPlayerId);
      if (!targetPlayer) {
        return { ok: false, message: '交換相手が見つかりません' };
      }

      const sentCards = removeCardsFromHand(player, payload.cardIds);
      player.hand.push(...effect.incomingCards);
      targetPlayer.hand.push(...sentCards);
      player.hand = sortCards(player.hand);
      targetPlayer.hand = sortCards(targetPlayer.hand);
      appendLog(gameState, `${getPlayerLabel(player.name, player.type)} がカード交換を完了しました`);
    }
  }

  gameState.pendingEffect = null;
  syncFinishOrder(gameState);
  advancePendingEffect(gameState);
  return { ok: true };
}

export function advancePendingResolution(gameState: GameState): void {
  if (!hasPendingClearAnimation(gameState) || gameState.pendingEffect || gameState.phase !== 'playing') {
    return;
  }

  finalizePendingResolution(gameState);
}
