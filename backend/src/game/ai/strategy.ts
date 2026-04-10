import type { Card, GameState, PendingEffect, Player, Rank } from '../types/index.js';
import { getLegalMelds } from '../rules/melds.js';
import { ALL_RANKS, RANK_VALUE, sortCards } from '../utils/cards.js';

export type CpuTurnAction =
  | {
      type: 'play';
      cardIds: string[];
    }
  | {
      type: 'pass';
    };

function getRemainingOpponents(gameState: GameState, playerId: string): Player[] {
  return gameState.players.filter((player) => player.id !== playerId && player.finishOrder === null);
}

function scoreMove(gameState: GameState, player: Player, cardIds: string[]): number {
  const meld = getLegalMelds(gameState, player.hand).find(
    (candidate) => candidate.cards.map((card) => card.id).sort().join(',') === [...cardIds].sort().join(',')
  );

  if (!meld) {
    return Number.NEGATIVE_INFINITY;
  }

  const remainingAfterPlay = player.hand.length - meld.cards.length;
  const endgame = remainingAfterPlay <= 3;
  let score = meld.cards.length * 24;

  score -= meld.effectiveRank * 1.4;

  if (meld.containsJoker && !endgame) {
    score -= 22;
  }

  if (meld.effectiveRank >= RANK_VALUE['2'] && !endgame) {
    score -= 16;
  }

  if (meld.containsEight) {
    score += endgame ? 20 : 10;
  }

  if (meld.containsQueen) {
    const opponentLoad = getRemainingOpponents(gameState, player.id).reduce((total, target) => total + target.hand.length, 0);
    score += opponentLoad * 0.8;
  }

  if (meld.type === 'quad' && gameState.ruleConfig.revolutionEnabled) {
    const lowCards = player.hand.filter((card) => RANK_VALUE[card.rank] <= 8).length;
    score += lowCards > player.hand.length / 2 ? 18 : -8;
  }

  if (remainingAfterPlay === 0) {
    score += 1000;
  }

  if (remainingAfterPlay === 1) {
    score += 60;
  }

  return score;
}

function chooseRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)] as T;
}

export function chooseCpuTurnAction(gameState: GameState, player: Player): CpuTurnAction {
  const legalMelds = getLegalMelds(gameState, player.hand);

  if (legalMelds.length === 0) {
    return { type: 'pass' };
  }

  if (player.cpuLevel === 'easy') {
    const choice = chooseRandom(legalMelds);
    return {
      type: 'play',
      cardIds: choice.cards.map((card) => card.id)
    };
  }

  const scored = legalMelds.map((meld) => ({
    meld,
    score: scoreMove(
      gameState,
      player,
      meld.cards.map((card) => card.id)
    )
  }));

  scored.sort((left, right) => right.score - left.score);

  const candidates = player.cpuLevel === 'hard' ? scored.slice(0, 1) : scored.slice(0, Math.min(3, scored.length));
  const selected = player.cpuLevel === 'hard' ? candidates[0] : chooseRandom(candidates);

  return {
    type: 'play',
    cardIds: selected.meld.cards.map((card) => card.id)
  };
}

export function chooseCpuCardSelection(player: Player, count: number): Card[] {
  return sortCards(player.hand).slice(0, count);
}

export function chooseBomberTarget(gameState: GameState, playerId: string, level: Player['cpuLevel']): Rank {
  if (level === 'easy') {
    return chooseRandom(ALL_RANKS);
  }

  const opponents = getRemainingOpponents(gameState, playerId);
  const tallies = new Map<Rank, number>();

  for (const rank of ALL_RANKS) {
    tallies.set(rank, 0);
  }

  for (const opponent of opponents) {
    for (const card of opponent.hand) {
      const current = tallies.get(card.rank) ?? 0;
      const weight = level === 'hard' ? Math.max(1, 8 - opponent.hand.length) : 1;
      tallies.set(card.rank, current + weight);
    }
  }

  const ranked = [...tallies.entries()].sort((left, right) => right[1] - left[1]);
  return ranked[0]?.[0] ?? '3';
}

export function resolveCpuPendingEffect(gameState: GameState, effect: PendingEffect, player: Player): string[] | Rank {
  if (effect.type === 'twelve-bomber') {
    return chooseBomberTarget(gameState, player.id, player.cpuLevel);
  }

  return chooseCpuCardSelection(player, effect.count).map((card) => card.id);
}
