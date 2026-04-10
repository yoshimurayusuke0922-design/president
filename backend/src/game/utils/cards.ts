import type { Card, Meld, Player, Rank, Suit } from '../types/index.js';
import { createUuid } from './uuid.js';

export const SUITS: Suit[] = ['S', 'H', 'D', 'C'];
export const NON_JOKER_RANKS: Rank[] = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
export const ALL_RANKS: Rank[] = [...NON_JOKER_RANKS, 'JOKER'];
export const SUIT_SORT_ORDER: Suit[] = ['D', 'C', 'H', 'S', 'JOKER'];

export const RANK_VALUE: Record<Rank, number> = {
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
  '2': 15,
  JOKER: 16
};

export function createDeck(): Card[] {
  const deck: Card[] = [];

  for (const suit of SUITS) {
    for (const rank of NON_JOKER_RANKS) {
      deck.push({
        id: createUuid(),
        suit,
        rank
      });
    }
  }

  deck.push(
    { id: createUuid(), suit: 'JOKER', rank: 'JOKER' },
    { id: createUuid(), suit: 'JOKER', rank: 'JOKER' }
  );

  return deck;
}

export function shuffleDeck(cards: Card[]): Card[] {
  const deck = [...cards];

  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [deck[index], deck[swapIndex]] = [deck[swapIndex], deck[index]];
  }

  return deck;
}

export function sortCards(cards: Card[]): Card[] {
  return [...cards].sort((left, right) => {
    const rankDiff = RANK_VALUE[left.rank] - RANK_VALUE[right.rank];
    if (rankDiff !== 0) {
      return rankDiff;
    }

    return SUIT_SORT_ORDER.indexOf(left.suit) - SUIT_SORT_ORDER.indexOf(right.suit);
  });
}

export function sortPlayersHand(players: Player[]): void {
  for (const player of players) {
    player.hand = sortCards(player.hand);
  }
}

export function getDisplayCardLabel(card: Card): string {
  const suitMap: Record<Suit, string> = {
    S: 'S',
    H: 'H',
    D: 'D',
    C: 'C',
    JOKER: 'JK'
  };

  return `${suitMap[card.suit]}-${card.rank}`;
}

export function getCardStrength(rank: Rank, isReversed: boolean): number {
  if (rank === 'JOKER') {
    return 100;
  }

  const base = RANK_VALUE[rank];
  return isReversed ? 18 - base : base;
}

export function isReversedStrength(meld: Meld | null, isRevolution: boolean, isElevenBack: boolean): boolean {
  if (!meld) {
    return isRevolution;
  }

  return isRevolution !== isElevenBack;
}

export function getStrongestCards(hand: Card[], count: number): Card[] {
  return [...sortCards(hand)].reverse().slice(0, count);
}

export function createCardIdSet(cardIds: string[]): Set<string> {
  return new Set(cardIds);
}

export function getRankLabel(rank: Rank): string {
  return rank === 'JOKER' ? 'Joker' : rank;
}

export function getPlayerLabel(name: string, type: 'human' | 'cpu'): string {
  return type === 'cpu' ? `${name} (CPU)` : name;
}
