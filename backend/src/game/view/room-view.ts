import type { Card, GameView, LogEntry, PendingEffectView, PlayerView, RoomView, TableState } from '../types/index.js';

function cloneCard(card: Card): Card {
  return { ...card };
}

function cloneCards(cards: Card[]): Card[] {
  return cards.map(cloneCard);
}

function cloneTableState(table: TableState): TableState {
  return {
    ...table,
    currentMeld: table.currentMeld
      ? {
          ...table.currentMeld,
          cards: cloneCards(table.currentMeld.cards)
        }
      : null
  };
}

function clonePendingEffectView(effect: PendingEffectView | null): PendingEffectView | null {
  if (!effect) {
    return null;
  }

  if (effect.type === 'twelve-bomber') {
    return {
      ...effect,
      choices: [...effect.choices]
    };
  }

  return { ...effect };
}

function cloneLogEntry(entry: LogEntry | null): LogEntry | null {
  return entry ? { ...entry } : null;
}

function clonePlayerView(player: PlayerView): PlayerView {
  return {
    ...player,
    ...(player.hand ? { hand: cloneCards(player.hand) } : {})
  };
}

function cloneGameView(gameState: GameView): GameView {
  return {
    ...gameState,
    table: cloneTableState(gameState.table),
    finishedOrder: [...gameState.finishedOrder],
    ruleConfig: { ...gameState.ruleConfig },
    pendingEffect: clonePendingEffectView(gameState.pendingEffect),
    recentBomberEvent: gameState.recentBomberEvent ? { ...gameState.recentBomberEvent } : null,
    recentRevolutionEvent: gameState.recentRevolutionEvent ? { ...gameState.recentRevolutionEvent } : null,
    latestLogEntry: cloneLogEntry(gameState.latestLogEntry),
    legalMoveCardIds: gameState.legalMoveCardIds.map((cardIds) => [...cardIds])
  };
}

export function snapshotRoomView(roomView: RoomView): RoomView {
  return {
    ...roomView,
    players: roomView.players.map(clonePlayerView),
    settings: {
      ...roomView.settings,
      ruleConfig: { ...roomView.settings.ruleConfig }
    },
    gameState: roomView.gameState ? cloneGameView(roomView.gameState) : null,
    lastFinishedOrder: roomView.lastFinishedOrder ? [...roomView.lastFinishedOrder] : null
  };
}
