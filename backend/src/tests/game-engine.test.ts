import { describe, expect, it } from 'vitest';

import { createDefaultRuleConfig } from '../game/core/config.js';
import { advancePendingResolution, getLegalMoveCardIds, playCards, resolvePendingEffect } from '../game/core/engine.js';
import type { Card, GameState, Player } from '../game/types/index.js';
import { createMeldFromCards, getAllMelds } from '../game/rules/melds.js';

let counter = 0;

function makeCard(rank: Card['rank'], suit: Card['suit']): Card {
  counter += 1;
  return {
    id: `${suit}-${rank}-${counter}`,
    rank,
    suit
  };
}

function makePlayer(id: string, hand: Card[]): Player {
  return {
    id,
    name: id,
    type: 'human',
    socketId: id,
    cpuLevel: 'normal',
    hand,
    finishOrder: null,
    isPassed: false,
    isDisconnected: false,
    isAutoControlled: false
  };
}

function makeGame(players: Player[]): GameState {
  return {
    phase: 'playing',
    players,
    currentPlayerId: players[0].id,
    table: {
      currentMeld: null,
      lastValidPlayerId: null,
      isRevolution: false,
      isElevenBack: false,
      bindingLock: null
    },
    finishedOrder: [],
    turnCount: 0,
    ruleConfig: createDefaultRuleConfig(),
    pendingEffect: null,
    pendingQueue: [],
    pendingResolution: null,
    recentBomberEvent: null,
    recentRevolutionEvent: null,
    log: [],
    winnerIds: [],
    round: 1
  };
}

describe('meld validation', () => {
  it('builds a sequence with one joker', () => {
    const cards = [makeCard('5', 'S'), makeCard('JOKER', 'JOKER'), makeCard('7', 'S')];
    const meld = createMeldFromCards(cards, createDefaultRuleConfig());

    expect(meld?.type).toBe('sequence');
    expect(meld?.length).toBe(3);
    expect(meld?.effectiveRank).toBe(7);
  });
});

describe('game engine', () => {
  it('pauses on eight cut before clearing the table and keeps the actor lead after the clear', () => {
    const players = [
      makePlayer('p1', [makeCard('8', 'S'), makeCard('9', 'H')]),
      makePlayer('p2', [makeCard('4', 'S')]),
      makePlayer('p3', [makeCard('5', 'S')]),
      makePlayer('p4', [makeCard('6', 'S')])
    ];
    const game = makeGame(players);

    const result = playCards(game, 'p1', [players[0].hand[0].id]);

    expect(result.ok).toBe(true);
    expect(game.table.currentMeld?.cards[0]?.rank).toBe('8');
    expect(game.pendingResolution?.clearReason).toBe('eight-cut');
    expect(getLegalMoveCardIds(game, 'p1')).toEqual([]);

    advancePendingResolution(game);

    expect(game.table.currentMeld).toBeNull();
    expect(game.currentPlayerId).toBe('p1');
  });

  it('resolves 12 bomber without clearing the table and passes the turn normally', () => {
    const players = [
      makePlayer('p1', [makeCard('Q', 'S'), makeCard('9', 'H')]),
      makePlayer('p2', [makeCard('A', 'S'), makeCard('5', 'H')]),
      makePlayer('p3', [makeCard('A', 'D')]),
      makePlayer('p4', [makeCard('6', 'C')])
    ];
    const game = makeGame(players);

    const playResult = playCards(game, 'p1', [players[0].hand[0].id]);
    expect(playResult.ok).toBe(true);
    expect(game.pendingEffect?.type).toBe('twelve-bomber');

    const resolveResult = resolvePendingEffect(game, {
      playerId: 'p1',
      effectType: 'twelve-bomber',
      targetRank: 'A'
    });

    expect(resolveResult.ok).toBe(true);
    expect(players[1].hand.some((card) => card.rank === 'A')).toBe(false);
    expect(players[2].hand.some((card) => card.rank === 'A')).toBe(false);
    expect(game.table.currentMeld?.cards.map((card) => card.rank)).toEqual(['Q']);
    expect(game.currentPlayerId).toBe('p2');
    expect(game.recentBomberEvent?.targetRank).toBe('A');
  });

  it('queues one bomber per queen played and keeps resolving after the player finishes', () => {
    const players = [
      makePlayer('p1', [makeCard('Q', 'S'), makeCard('Q', 'H')]),
      makePlayer('p2', [makeCard('A', 'S'), makeCard('K', 'S')]),
      makePlayer('p3', [makeCard('A', 'D')]),
      makePlayer('p4', [makeCard('6', 'C')])
    ];
    const game = makeGame(players);

    const playResult = playCards(game, 'p1', [players[0].hand[0].id, players[0].hand[1].id]);

    expect(playResult.ok).toBe(true);
    expect(players[0].finishOrder).toBe(1);
    expect(game.pendingEffect?.type).toBe('twelve-bomber');
    expect(game.pendingQueue).toHaveLength(1);

    const firstBomber = resolvePendingEffect(game, {
      playerId: 'p1',
      effectType: 'twelve-bomber',
      targetRank: 'A'
    });

    expect(firstBomber.ok).toBe(true);
    expect(players[1].hand.some((card) => card.rank === 'A')).toBe(false);
    expect(players[2].hand.some((card) => card.rank === 'A')).toBe(false);
    expect(game.pendingEffect?.type).toBe('twelve-bomber');
    expect(game.pendingQueue).toHaveLength(0);
    expect(game.table.currentMeld).not.toBeNull();

    const secondBomber = resolvePendingEffect(game, {
      playerId: 'p1',
      effectType: 'twelve-bomber',
      targetRank: 'K'
    });

    expect(secondBomber.ok).toBe(true);
    expect(players[1].hand.some((card) => card.rank === 'K')).toBe(false);
    expect(game.pendingEffect).toBeNull();
    expect(game.pendingResolution).toBeNull();
    expect(game.phase === 'result' || game.table.currentMeld === null).toBe(true);
  });

  it('passes a card after a seven effect and moves to the next turn', () => {
    const players = [
      makePlayer('p1', [makeCard('7', 'S'), makeCard('9', 'H')]),
      makePlayer('p2', [makeCard('3', 'C')]),
      makePlayer('p3', [makeCard('4', 'C')]),
      makePlayer('p4', [makeCard('5', 'C')])
    ];
    const game = makeGame(players);

    const playResult = playCards(game, 'p1', [players[0].hand[0].id]);
    expect(playResult.ok).toBe(true);
    expect(game.pendingEffect?.type).toBe('seven-pass');

    const resolveResult = resolvePendingEffect(game, {
      playerId: 'p1',
      effectType: 'seven-pass',
      cardIds: [players[0].hand[0].id]
    });

    expect(resolveResult.ok).toBe(true);
    expect(players[0].finishOrder).toBe(1);
    expect(players[1].hand.length).toBe(2);
    expect(game.currentPlayerId).toBe('p2');
  });

  it('passes as many cards as the number of sevens played', () => {
    const players = [
      makePlayer('p1', [makeCard('7', 'S'), makeCard('7', 'H'), makeCard('9', 'H'), makeCard('10', 'D')]),
      makePlayer('p2', [makeCard('3', 'C')]),
      makePlayer('p3', [makeCard('4', 'C')]),
      makePlayer('p4', [makeCard('5', 'C')])
    ];
    const game = makeGame(players);

    const playResult = playCards(game, 'p1', [players[0].hand[0].id, players[0].hand[1].id]);
    expect(playResult.ok).toBe(true);
    expect(game.pendingEffect?.type).toBe('seven-pass');
    expect(game.pendingEffect && game.pendingEffect.type === 'seven-pass' ? game.pendingEffect.count : null).toBe(2);

    const resolveResult = resolvePendingEffect(game, {
      playerId: 'p1',
      effectType: 'seven-pass',
      cardIds: [players[0].hand[0].id, players[0].hand[1].id]
    });

    expect(resolveResult.ok).toBe(true);
    expect(players[0].hand).toHaveLength(0);
    expect(players[1].hand).toHaveLength(3);
    expect(game.currentPlayerId).toBe('p2');
  });

  it('lets a player discard as many cards as the number of tens played', () => {
    const players = [
      makePlayer('p1', [makeCard('10', 'S'), makeCard('10', 'H'), makeCard('3', 'C'), makeCard('4', 'D')]),
      makePlayer('p2', [makeCard('5', 'S')]),
      makePlayer('p3', [makeCard('6', 'S')]),
      makePlayer('p4', [makeCard('7', 'S')])
    ];
    const game = makeGame(players);

    const playResult = playCards(game, 'p1', [players[0].hand[0].id, players[0].hand[1].id]);

    expect(playResult.ok).toBe(true);
    expect(game.pendingEffect?.type).toBe('ten-discard');
    expect(game.pendingEffect && game.pendingEffect.type === 'ten-discard' ? game.pendingEffect.count : null).toBe(2);

    const resolveResult = resolvePendingEffect(game, {
      playerId: 'p1',
      effectType: 'ten-discard',
      cardIds: [players[0].hand[0].id, players[0].hand[1].id]
    });

    expect(resolveResult.ok).toBe(true);
    expect(players[0].hand).toHaveLength(0);
  });

  it('keeps the table after an eleven back and reverses the next legal replies', () => {
    const players = [
      makePlayer('p1', [makeCard('J', 'S'), makeCard('9', 'H')]),
      makePlayer('p2', [makeCard('10', 'H'), makeCard('A', 'S'), makeCard('2', 'S'), makeCard('3', 'S')]),
      makePlayer('p3', [makeCard('4', 'C')]),
      makePlayer('p4', [makeCard('5', 'C')])
    ];
    const game = makeGame(players);

    const playResult = playCards(game, 'p1', [players[0].hand[0].id]);

    expect(playResult.ok).toBe(true);
    expect(game.table.currentMeld?.cards[0]?.rank).toBe('J');
    expect(game.table.isElevenBack).toBe(true);
    expect(game.currentPlayerId).toBe('p2');

    const legalMoveKeys = getLegalMoveCardIds(game, 'p2').map((cardIds) => cardIds.sort().join('|'));

    expect(legalMoveKeys).toContain([players[1].hand[0].id].sort().join('|'));
    expect(legalMoveKeys).toContain([players[1].hand[3].id].sort().join('|'));
    expect(legalMoveKeys).not.toContain([players[1].hand[1].id].sort().join('|'));
    expect(legalMoveKeys).not.toContain([players[1].hand[2].id].sort().join('|'));
    expect(game.pendingEffect).toBeNull();
  });

  it('does not trigger twelve bomber or clear the table when a jack is played over an existing meld', () => {
    const players = [
      makePlayer('p1', [makeCard('J', 'S'), makeCard('9', 'H')]),
      makePlayer('p2', [makeCard('10', 'H')]),
      makePlayer('p3', [makeCard('Q', 'C')]),
      makePlayer('p4', [makeCard('K', 'C')])
    ];
    const game = makeGame(players);

    game.table.currentMeld = createMeldFromCards([players[1].hand[0]], game.ruleConfig);
    game.table.lastValidPlayerId = 'p2';
    game.currentPlayerId = 'p1';

    const result = playCards(game, 'p1', [players[0].hand[0].id]);

    expect(result.ok).toBe(true);
    expect(game.table.currentMeld?.cards[0]?.rank).toBe('J');
    expect(game.table.currentMeld?.containsQueen).toBe(false);
    expect(game.pendingEffect).toBeNull();
    expect(game.pendingResolution?.clearReason ?? null).toBeNull();
  });

  it('allows playing a pair of jacks and only activates eleven back', () => {
    const players = [
      makePlayer('p1', [makeCard('J', 'S'), makeCard('J', 'H'), makeCard('5', 'C')]),
      makePlayer('p2', [makeCard('Q', 'S')]),
      makePlayer('p3', [makeCard('4', 'C')]),
      makePlayer('p4', [makeCard('5', 'D')])
    ];
    const game = makeGame(players);

    const legalMoveKeys = getLegalMoveCardIds(game, 'p1').map((cardIds) => cardIds.sort().join('|'));
    const jackPairKey = [players[0].hand[0].id, players[0].hand[1].id].sort().join('|');

    expect(legalMoveKeys).toContain(jackPairKey);

    const result = playCards(game, 'p1', [players[0].hand[0].id, players[0].hand[1].id]);

    expect(result.ok).toBe(true);
    expect(game.table.currentMeld?.type).toBe('pair');
    expect(game.table.currentMeld?.length).toBe(2);
    expect(game.table.currentMeld?.containsJack).toBe(true);
    expect(game.table.currentMeld?.containsQueen).toBe(false);
    expect(game.table.isElevenBack).toBe(true);
    expect(game.pendingEffect).toBeNull();
    expect(game.pendingResolution?.clearReason ?? null).toBeNull();
  });

  it('allows playing four jacks as a legal quad meld', () => {
    const players = [
      makePlayer('p1', [makeCard('J', 'S'), makeCard('J', 'H'), makeCard('J', 'D'), makeCard('J', 'C')]),
      makePlayer('p2', [makeCard('Q', 'S')]),
      makePlayer('p3', [makeCard('4', 'C')]),
      makePlayer('p4', [makeCard('5', 'D')])
    ];
    const game = makeGame(players);

    const jackQuadKey = players[0].hand.map((card) => card.id).sort().join('|');
    const legalMoveKeys = getLegalMoveCardIds(game, 'p1').map((cardIds) => cardIds.sort().join('|'));

    expect(legalMoveKeys).toContain(jackQuadKey);

    const result = playCards(game, 'p1', players[0].hand.map((card) => card.id));

    expect(result.ok).toBe(true);
    expect(game.table.currentMeld?.type).toBe('quad');
    expect(game.table.currentMeld?.length).toBe(4);
    expect(game.table.currentMeld?.containsJack).toBe(true);
    expect(game.table.isElevenBack).toBe(true);
  });

  it('treats a jack with joker as eleven back and never as twelve bomber', () => {
    const players = [
      makePlayer('p1', [makeCard('J', 'S'), makeCard('JOKER', 'JOKER'), makeCard('5', 'C')]),
      makePlayer('p2', [makeCard('Q', 'S')]),
      makePlayer('p3', [makeCard('4', 'C')]),
      makePlayer('p4', [makeCard('5', 'D')])
    ];
    const game = makeGame(players);

    const result = playCards(game, 'p1', [players[0].hand[0].id, players[0].hand[1].id]);

    expect(result.ok).toBe(true);
    expect(game.table.currentMeld?.type).toBe('pair');
    expect(game.table.currentMeld?.containsJack).toBe(true);
    expect(game.table.currentMeld?.containsQueen).toBe(false);
    expect(game.table.isElevenBack).toBe(true);
    expect(game.pendingEffect).toBeNull();
    expect(game.pendingResolution?.clearReason ?? null).toBeNull();
  });

  it('skips players who already passed after a new meld is played', () => {
    const players = [
      makePlayer('p1', [makeCard('10', 'S'), makeCard('3', 'S')]),
      makePlayer('p2', [makeCard('J', 'H')]),
      makePlayer('p3', [makeCard('4', 'C')]),
      makePlayer('p4', [makeCard('5', 'C')])
    ];
    const game = makeGame(players);

    game.table.currentMeld = createMeldFromCards([players[0].hand[0]], game.ruleConfig);
    game.table.lastValidPlayerId = 'p1';
    game.currentPlayerId = 'p2';
    players[2].isPassed = true;
    players[3].isPassed = true;

    const result = playCards(game, 'p2', [players[1].hand[0].id]);

    expect(result.ok).toBe(true);
    expect(game.table.currentMeld?.cards[0]?.rank).toBe('J');
    expect(game.currentPlayerId).toBe('p1');
  });

  it('does not trigger eleven back or twelve bomber from a sequence containing J or Q', () => {
    const players = [
      makePlayer('p1', [makeCard('J', 'S'), makeCard('Q', 'S'), makeCard('K', 'S')]),
      makePlayer('p2', [makeCard('A', 'C')]),
      makePlayer('p3', [makeCard('4', 'C')]),
      makePlayer('p4', [makeCard('5', 'C')])
    ];
    const game = makeGame(players);

    const result = playCards(game, 'p1', players[0].hand.map((card) => card.id));

    expect(result.ok).toBe(true);
    expect(game.table.currentMeld?.type).toBe('sequence');
    expect(game.table.isElevenBack).toBe(false);
    expect(game.pendingEffect).toBeNull();
    expect(game.pendingResolution?.clearReason ?? null).toBeNull();
    expect(game.table.currentMeld).not.toBeNull();
  });

  it('never treats jack-based melds as twelve bomber and never treats queen-based melds as eleven back', () => {
    const hand = [
      makeCard('J', 'S'),
      makeCard('J', 'H'),
      makeCard('Q', 'S'),
      makeCard('Q', 'H'),
      makeCard('JOKER', 'JOKER'),
      makeCard('5', 'C')
    ];
    const allMelds = getAllMelds(hand, createDefaultRuleConfig()).filter((meld) =>
      meld.cards.some((card) => card.rank === 'J' || card.rank === 'Q')
    );

    for (const meld of allMelds) {
      const players = [
        makePlayer(
          'p1',
          meld.cards.map((card) => ({
            ...card
          }))
        ),
        makePlayer('p2', [makeCard('3', 'D')]),
        makePlayer('p3', [makeCard('4', 'D')]),
        makePlayer('p4', [makeCard('5', 'D')])
      ];
      const game = makeGame(players);
      const result = playCards(
        game,
        'p1',
        players[0].hand.map((card) => card.id)
      );

      expect(result.ok).toBe(true);

      if (meld.cards.some((card) => card.rank === 'J') && !meld.cards.some((card) => card.rank === 'Q') && meld.type !== 'sequence') {
        expect(game.table.isElevenBack).toBe(true);
        expect(game.pendingEffect).toBeNull();
        expect(game.pendingResolution?.clearReason ?? null).toBeNull();
      }

      if (meld.cards.some((card) => card.rank === 'Q') && !meld.cards.some((card) => card.rank === 'J') && meld.type !== 'sequence') {
        expect(game.table.isElevenBack).toBe(false);
        expect(game.pendingEffect?.type === 'twelve-bomber' || game.pendingEffect === null).toBe(true);
      }
    }
  });

  it('tracks counter-revolution as a dedicated recent event', () => {
    const players = [
      makePlayer('p1', [makeCard('9', 'S'), makeCard('9', 'H'), makeCard('9', 'D'), makeCard('9', 'C'), makeCard('A', 'S')]),
      makePlayer('p2', [makeCard('4', 'S')]),
      makePlayer('p3', [makeCard('5', 'S')]),
      makePlayer('p4', [makeCard('6', 'S')])
    ];
    const game = makeGame(players);
    game.table.isRevolution = true;

    const result = playCards(
      game,
      'p1',
      players[0].hand.slice(0, 4).map((card) => card.id)
    );

    expect(result.ok).toBe(true);
    expect(game.table.isRevolution).toBe(false);
    expect(game.recentRevolutionEvent).toMatchObject({
      playerId: 'p1',
      isCounter: true,
      isActive: false
    });
  });
});
