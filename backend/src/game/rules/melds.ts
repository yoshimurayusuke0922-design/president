import type { Card, GameState, Meld, MeldType, Rank, RuleConfig } from '../types/index.js';
import { NON_JOKER_RANKS, RANK_VALUE, getCardStrength, sortCards } from '../utils/cards.js';

function createMeldRecord(type: MeldType, cards: Card[], effectiveRank: number, lockKey: string | null): Meld {
  const ranks = cards.map((card) => card.rank);

  return {
    type,
    cards: sortCards(cards),
    length: cards.length,
    effectiveRank,
    lockKey,
    containsEight: ranks.includes('8'),
    containsJoker: ranks.includes('JOKER'),
    fiveCount: ranks.filter((rank) => rank === '5').length,
    containsSeven: ranks.includes('7'),
    containsTen: ranks.includes('10'),
    containsJack: ranks.includes('J'),
    containsQueen: ranks.includes('Q'),
    isSpadeThreeSingle: cards.length === 1 && cards[0]?.rank === '3' && cards[0]?.suit === 'S'
  };
}

function getMultiplicityLockKey(cards: Card[]): string | null {
  const suits = cards
    .filter((card) => card.rank !== 'JOKER')
    .map((card) => card.suit)
    .sort();

  return suits.length === 0 ? null : suits.join('|');
}

function buildSequence(cards: Card[]): Meld | null {
  const sorted = sortCards(cards);
  const nonJokers = sorted.filter((card) => card.rank !== 'JOKER');
  const jokerCount = sorted.length - nonJokers.length;

  if (jokerCount > 1 || nonJokers.length === 0) {
    return null;
  }

  const suitSet = new Set(nonJokers.map((card) => card.suit));
  if (suitSet.size !== 1) {
    return null;
  }

  const values = nonJokers.map((card) => RANK_VALUE[card.rank]).sort((left, right) => left - right);

  if (new Set(values).size !== values.length) {
    return null;
  }

  const minStart = Math.max(3, values[0] - jokerCount);
  const maxStart = values[0];

  for (let start = minStart; start <= maxStart; start += 1) {
    const end = start + sorted.length - 1;
    if (end > 15) {
      continue;
    }

    let missing = 0;
    let invalid = false;

    for (const value of values) {
      if (value < start || value > end) {
        invalid = true;
        break;
      }
    }

    if (invalid) {
      continue;
    }

    for (let candidate = start; candidate <= end; candidate += 1) {
      if (!values.includes(candidate)) {
        missing += 1;
      }
    }

    if (missing === jokerCount) {
      return createMeldRecord('sequence', sorted, end, nonJokers[0]?.suit ?? null);
    }
  }

  return null;
}

export function createMeldFromCards(cards: Card[], ruleConfig: RuleConfig): Meld | null {
  if (cards.length === 0) {
    return null;
  }

  const sorted = sortCards(cards);
  const nonJokers = sorted.filter((card) => card.rank !== 'JOKER');
  const uniqueRanks = [...new Set(nonJokers.map((card) => card.rank))];

  if (sorted.length === 1) {
    const effectiveRank = sorted[0].rank === 'JOKER' ? 16 : RANK_VALUE[sorted[0].rank];
    const lockKey = sorted[0].rank === 'JOKER' ? null : sorted[0].suit;
    return createMeldRecord('single', sorted, effectiveRank, lockKey);
  }

  if (uniqueRanks.length <= 1 && sorted.length <= 4) {
    const typeMap: Record<number, MeldType> = {
      2: 'pair',
      3: 'triple',
      4: 'quad'
    };

    const rank = uniqueRanks[0] ?? 'JOKER';
    return createMeldRecord(typeMap[sorted.length], sorted, RANK_VALUE[rank], getMultiplicityLockKey(sorted));
  }

  if (!ruleConfig.sequenceEnabled || sorted.length < 3) {
    return null;
  }

  return buildSequence(sorted);
}

export function isBindingMatch(meld: Meld, bindingLock: string | null): boolean {
  if (!bindingLock) {
    return true;
  }

  if (!meld.lockKey) {
    return meld.containsJoker;
  }

  return meld.lockKey === bindingLock;
}

export function isSpadeThreeReturn(meld: Meld, currentMeld: Meld | null, ruleConfig: RuleConfig): boolean {
  return Boolean(
    ruleConfig.spadeThreeReturnEnabled &&
      currentMeld &&
      currentMeld.type === 'single' &&
      currentMeld.cards[0]?.rank === 'JOKER' &&
      meld.isSpadeThreeSingle
  );
}

export function isMeldStronger(candidate: Meld, currentMeld: Meld, isReversed: boolean): boolean {
  const candidateStrength = candidate.effectiveRank === 16 ? 100 : isReversed ? 18 - candidate.effectiveRank : candidate.effectiveRank;
  const currentStrength = currentMeld.effectiveRank === 16 ? 100 : isReversed ? 18 - currentMeld.effectiveRank : currentMeld.effectiveRank;
  return candidateStrength > currentStrength;
}

export function isPlayableMeld(gameState: GameState, meld: Meld): boolean {
  const currentMeld = gameState.table.currentMeld;
  const isReversed = gameState.table.isRevolution !== gameState.table.isElevenBack;

  if (!isBindingMatch(meld, gameState.table.bindingLock)) {
    return false;
  }

  if (!currentMeld) {
    return true;
  }

  if (isSpadeThreeReturn(meld, currentMeld, gameState.ruleConfig)) {
    return true;
  }

  if (currentMeld.type !== meld.type || currentMeld.length !== meld.length) {
    return false;
  }

  return isMeldStronger(meld, currentMeld, isReversed);
}

function getCombinationSets<T>(items: T[], pickCount: number, startIndex = 0, prefix: T[] = [], result: T[][] = []): T[][] {
  if (prefix.length === pickCount) {
    result.push(prefix);
    return result;
  }

  for (let index = startIndex; index < items.length; index += 1) {
    getCombinationSets(items, pickCount, index + 1, [...prefix, items[index]], result);
  }

  return result;
}

function getSequenceMelds(hand: Card[], ruleConfig: RuleConfig): Meld[] {
  if (!ruleConfig.sequenceEnabled) {
    return [];
  }

  const sequences = new Map<string, Meld>();
  const jokerCards = hand.filter((card) => card.rank === 'JOKER');
  const suitCards = new Map<string, Map<number, Card>>();

  for (const suit of ['S', 'H', 'D', 'C']) {
    suitCards.set(suit, new Map<number, Card>());
  }

  for (const card of hand) {
    if (card.rank === 'JOKER') {
      continue;
    }

    suitCards.get(card.suit)?.set(RANK_VALUE[card.rank], card);
  }

  for (const [suit, cardMap] of suitCards.entries()) {
    for (let start = 3; start <= 15; start += 1) {
      const cards: Card[] = [];
      let jokerUsed = false;

      for (let value = start; value <= 15; value += 1) {
        const card = cardMap.get(value);

        if (card) {
          cards.push(card);
        } else if (jokerCards[0] && !jokerUsed) {
          cards.push(jokerCards[0]);
          jokerUsed = true;
        } else {
          break;
        }

        if (cards.length >= 3) {
          const meld = createMeldFromCards(cards, ruleConfig);
          if (meld) {
            const key = meld.cards.map((item) => item.id).sort().join(',');
            sequences.set(key, meld);
          }
        }
      }

      if (jokerCards[0] && !jokerUsed && cards.length >= 2) {
        const extended = [...cards, jokerCards[0]];
        const meld = createMeldFromCards(extended, ruleConfig);
        if (meld) {
          const key = meld.cards.map((item) => item.id).sort().join(',');
          sequences.set(key, meld);
        }
      }
    }
  }

  return [...sequences.values()];
}

export function getAllMelds(hand: Card[], ruleConfig: RuleConfig): Meld[] {
  const melds = new Map<string, Meld>();
  const jokers = hand.filter((card) => card.rank === 'JOKER');

  for (const card of hand) {
    const meld = createMeldFromCards([card], ruleConfig);
    if (meld) {
      melds.set(card.id, meld);
    }
  }

  for (const rank of NON_JOKER_RANKS) {
    const sameRankCards = hand.filter((card) => card.rank === rank);

    for (const size of [2, 3, 4]) {
      for (let jokerCount = 0; jokerCount <= Math.min(jokers.length, size); jokerCount += 1) {
        const naturalCount = size - jokerCount;
        if (naturalCount < 1 || naturalCount > sameRankCards.length) {
          continue;
        }

        for (const selectedCards of getCombinationSets(sameRankCards, naturalCount)) {
          const jokerSelections = jokerCount === 0 ? [[]] : getCombinationSets(jokers, jokerCount);
          for (const selectedJokers of jokerSelections) {
            const cards = [...selectedCards, ...selectedJokers];
            const meld = createMeldFromCards(cards, ruleConfig);
            if (meld) {
              const key = meld.cards.map((card) => card.id).sort().join(',');
              melds.set(key, meld);
            }
          }
        }
      }
    }
  }

  if (jokers.length === 2) {
    const jokerPair = createMeldFromCards(jokers, ruleConfig);
    if (jokerPair) {
      const key = jokerPair.cards.map((card) => card.id).sort().join(',');
      melds.set(key, jokerPair);
    }
  }

  for (const meld of getSequenceMelds(hand, ruleConfig)) {
    const key = meld.cards.map((card) => card.id).sort().join(',');
    melds.set(key, meld);
  }

  return [...melds.values()].sort((left, right) => {
    if (left.cards.length !== right.cards.length) {
      return left.cards.length - right.cards.length;
    }

    return left.effectiveRank - right.effectiveRank;
  });
}

export function getLegalMelds(gameState: GameState, hand: Card[]): Meld[] {
  return getAllMelds(hand, gameState.ruleConfig).filter((meld) => isPlayableMeld(gameState, meld));
}

export function getCardSelectionKey(cardIds: string[]): string {
  return [...cardIds].sort().join(',');
}
