import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { HandArea } from '../components/HandArea';
import { InGameMenu } from '../components/InGameMenu';
import { PendingEffectModal } from '../components/PendingEffectModal';
import { PlayerStatus } from '../components/PlayerStatus';
import { SelectedActionBar } from '../components/SelectedActionBar';
import { TableArea } from '../components/TableArea';
import type { PendingEffectView, Rank, RecentBomberEvent, RecentRevolutionEvent, RoomView } from '../types/game';

type GameScreenProps = {
  room: RoomView;
  connected: boolean;
  canResetRoom: boolean;
  resetLabel: string;
  onResetRoom: () => Promise<void>;
  onReturnTitle: () => Promise<void>;
  onPlay: (cardIds: string[]) => Promise<void>;
  onPass: () => Promise<void>;
  onResolveCardEffect: (effectType: 'seven-pass' | 'ten-discard' | 'exchange', cardIds: string[]) => Promise<void>;
  onResolveBomber: (rank: Rank) => Promise<void>;
};

function getRuleEffectLabel(message: string | null): string | null {
  if (!message) {
    return null;
  }

  if (message.includes('場を流しました')) {
    return null;
  }

  if (message.includes('革命')) {
    return '革命';
  }

  if (message.includes('縛り')) {
    return '縛り';
  }

  if (message.includes('5スキップ')) {
    return '5スキップ';
  }

  if (message.includes('7渡し')) {
    return '7渡し';
  }

  if (message.includes('10捨て')) {
    return '10捨て';
  }

  if (message.includes('8切り')) {
    return '8切り';
  }

  if (message.includes('スペ3返し')) {
    return 'スペ3返し';
  }

  return null;
}

function getPendingClearLabel(reason: Exclude<RoomView['gameState'], null>['pendingClearReason']): string | null {
  switch (reason) {
    case 'eight-cut':
      return '8切り';
    case 'spade-three':
      return 'スペ3返し';
    case 'bomber':
      return '12ボンバー';
    default:
      return null;
  }
}

function createCardIdsKey(cardIds: string[]): string {
  return [...cardIds].sort().join('|');
}

function isInlineHandEffect(
  effect: PendingEffectView | null
): effect is Extract<PendingEffectView, { type: 'seven-pass' | 'ten-discard' | 'exchange' }> {
  return effect?.type === 'seven-pass' || effect?.type === 'ten-discard' || effect?.type === 'exchange';
}

function getPendingEffectLabel(effect: PendingEffectView | null): string | null {
  if (!effect) {
    return null;
  }

  switch (effect.type) {
    case 'seven-pass':
      return '7渡し';
    case 'ten-discard':
      return '10捨て';
    case 'exchange':
      return 'カード交換';
    case 'twelve-bomber':
      return '12ボンバー';
    default:
      return null;
  }
}

function getActiveLogEffectLabel(game: RoomView['gameState'] | null): string | null {
  if (!game) {
    return null;
  }

  if (game.pendingEffect?.type === 'twelve-bomber' && game.table.currentMeld?.containsQueen) {
    return '12ボンバー';
  }

  if (game.table.isElevenBack && game.table.currentMeld?.containsJack && !game.table.currentMeld.containsQueen) {
    return '11バック';
  }

  return getRuleEffectLabel(game.latestLogEntry?.message ?? null);
}

function getRankBurstLabel(rank: Rank): string {
  return rank === 'JOKER' ? 'JOKER' : rank;
}

export function GameScreen({
  room,
  connected,
  canResetRoom,
  resetLabel,
  onResetRoom,
  onReturnTitle,
  onPlay,
  onPass,
  onResolveCardEffect,
  onResolveBomber
}: GameScreenProps) {
  const game = room.gameState;
  const self = room.players.find((player) => player.id === room.selfPlayerId);
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [effectSelection, setEffectSelection] = useState<string[]>([]);
  const [timedRuleEffectLabel, setTimedRuleEffectLabel] = useState<string | null>(null);
  const [clearEffectLabel, setClearEffectLabel] = useState<string | null>(null);
  const [bomberBurstEvent, setBomberBurstEvent] = useState<RecentBomberEvent | null>(null);
  const [revolutionBurstEvent, setRevolutionBurstEvent] = useState<RecentRevolutionEvent | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuBusyAction, setMenuBusyAction] = useState<'reset' | 'title' | null>(null);

  const hand = self?.hand ?? [];
  const legalMoveCardIds = game?.legalMoveCardIds ?? [];
  const legalMoveKeys = useMemo(() => new Set(legalMoveCardIds.map((cardIds) => createCardIdsKey(cardIds))), [legalMoveCardIds]);
  const isMyTurn = game?.currentPlayerId === room.selfPlayerId && game?.phase === 'playing';
  const pendingEffect = game?.pendingEffect && game.pendingEffect.playerId === room.selfPlayerId ? game.pendingEffect : null;
  const inlinePendingEffect = isInlineHandEffect(pendingEffect) ? pendingEffect : null;
  const isInlinePendingEffect = Boolean(inlinePendingEffect);
  const canPlay =
    Boolean(isMyTurn) && selectedCardIds.length > 0 && !pendingEffect && legalMoveKeys.has(createCardIdsKey(selectedCardIds));
  const latestLogEntry = game?.latestLogEntry ?? null;
  const handInteractionStateRef = useRef<{
    inlinePendingEffect: typeof inlinePendingEffect;
  }>({
    inlinePendingEffect: null
  });

  handInteractionStateRef.current = {
    inlinePendingEffect
  };

  useEffect(() => {
    setSelectedCardIds((current) => current.filter((cardId) => hand.some((card) => card.id === cardId)));
    setEffectSelection((current) => current.filter((cardId) => hand.some((card) => card.id === cardId)));
  }, [hand]);

  useEffect(() => {
    if (isMyTurn && !pendingEffect && !game?.pendingClearReason) {
      return;
    }

    setSelectedCardIds([]);
  }, [isMyTurn, pendingEffect, game?.pendingClearReason]);

  useEffect(() => {
    if (game?.pendingClearReason) {
      setTimedRuleEffectLabel(null);
      return undefined;
    }

    const nextRuleEffect = getActiveLogEffectLabel(game);
    setTimedRuleEffectLabel(nextRuleEffect);

    if (!nextRuleEffect) {
      return undefined;
    }

    const timerId = window.setTimeout(() => {
      setTimedRuleEffectLabel((current) => (current === nextRuleEffect ? null : current));
    }, 2200);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [game, latestLogEntry?.id, latestLogEntry?.message]);

  useEffect(() => {
    setClearEffectLabel(null);

    const nextLabel = getPendingClearLabel(game?.pendingClearReason ?? null);
    if (!nextLabel) {
      return undefined;
    }

    const timerId = window.setTimeout(() => {
      setClearEffectLabel(nextLabel);
    }, 260);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [game?.pendingClearReason]);

  useEffect(() => {
    const nextBomberEvent = game?.recentBomberEvent;
    if (!nextBomberEvent) {
      return undefined;
    }

    setBomberBurstEvent((current) => (current?.id === nextBomberEvent.id ? current : nextBomberEvent));

    const timerId = window.setTimeout(() => {
      setBomberBurstEvent((current) => (current?.id === nextBomberEvent.id ? null : current));
    }, 1700);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [game?.recentBomberEvent?.id]);

  useEffect(() => {
    const nextRevolutionEvent = game?.recentRevolutionEvent;
    if (!nextRevolutionEvent) {
      return undefined;
    }

    setRevolutionBurstEvent((current) => (current?.id === nextRevolutionEvent.id ? current : nextRevolutionEvent));

    const timerId = window.setTimeout(() => {
      setRevolutionBurstEvent((current) => (current?.id === nextRevolutionEvent.id ? null : current));
    }, nextRevolutionEvent.isCounter ? 1800 : 2200);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [game?.recentRevolutionEvent?.id]);

  const seatOrder = useMemo(() => {
    if (!game) {
      return [];
    }

    const playersInTurnOrder = room.players;
    const selfIndex = playersInTurnOrder.findIndex((player) => player.id === room.selfPlayerId);
    if (selfIndex < 0) {
      return playersInTurnOrder.filter((player) => player.id !== room.selfPlayerId);
    }

    return Array.from({ length: playersInTurnOrder.length - 1 }, (_, offset) => playersInTurnOrder[(selfIndex + offset + 1) % playersInTurnOrder.length]).filter(
      (player) => player.id !== room.selfPlayerId
    );
  }, [room.players, room.selfPlayerId]);

  const leftOpponent = seatOrder[0] ?? null;
  const topOpponent = seatOrder[1] ?? null;
  const rightOpponent = seatOrder[2] ?? null;
  const currentTurnPlayer = room.players.find((player) => player.id === game?.currentPlayerId) ?? null;

  if (!game || !self) {
    return null;
  }

  const activeHandSelection = inlinePendingEffect ? effectSelection : selectedCardIds;
  const pendingEffectLabel = getPendingEffectLabel(pendingEffect);
  const ruleEffectLabel = clearEffectLabel ?? timedRuleEffectLabel;
  const showRevolutionBurst = Boolean(revolutionBurstEvent);
  const showTurnIndicator = (!game.table.isElevenBack || Boolean(pendingEffect) || !connected) && !game.pendingClearReason;
  const turnLabel = !connected
    ? '再接続中です'
    : pendingEffect
      ? 'カードを選択してください'
      : isMyTurn
        ? 'あなたの番です'
        : `${currentTurnPlayer?.name ?? '相手'}の番です`;
  const inlineConfirmLabel =
    inlinePendingEffect?.type === 'seven-pass'
      ? '渡す'
      : inlinePendingEffect?.type === 'ten-discard'
        ? '捨てる'
        : inlinePendingEffect?.type === 'exchange'
          ? '交換する'
          : null;
  const revolutionBurstLabel = revolutionBurstEvent?.isCounter ? '革命返し' : '革命';
  const revolutionBurstClassName = `revolution-burst ${revolutionBurstEvent?.isCounter ? 'is-counter' : ''}`.trim();
  const inlineConfirmCount = inlinePendingEffect?.count ?? 0;
  const handleHandToggle = useCallback((cardId: string) => {
    const { inlinePendingEffect: activeInlineEffect } = handInteractionStateRef.current;

    if (activeInlineEffect) {
      setEffectSelection((current) => {
        if (current.includes(cardId)) {
          return current.filter((id) => id !== cardId);
        }

        const next = [...current, cardId];
        return next.slice(0, activeInlineEffect.count);
      });
      return;
    }

    setSelectedCardIds((current) => {
      if (current.includes(cardId)) {
        return current.filter((id) => id !== cardId);
      }

      return [...current, cardId];
    });
  }, []);

  return (
    <section className={`game-stage ${game.table.isRevolution ? 'is-revolution' : ''}`.trim()}>
      <main className={`panel mobile-board-shell ${game.table.isRevolution ? 'is-revolution' : ''}`.trim()}>
        <div className="board-toolbar">
          <span className="board-toolbar-pill">ROUND {game.round}</span>
          <button
            aria-expanded={menuOpen}
            className="chip-button board-menu-button"
            onClick={() => setMenuOpen(true)}
            type="button"
          >
            メニュー
          </button>
        </div>
        {showRevolutionBurst ? (
          <div aria-hidden="true" className={revolutionBurstClassName}>
            {revolutionBurstEvent?.isCounter ? <div className="revolution-burst-slice" /> : null}
            <div className="revolution-burst-core">{revolutionBurstLabel}</div>
          </div>
        ) : null}
        {bomberBurstEvent ? (
          <div aria-hidden="true" className="bomber-burst">
            <div className="bomber-burst-core">
              <span className="bomber-burst-title">Qボンバー</span>
              <strong className="bomber-burst-rank">{getRankBurstLabel(bomberBurstEvent.targetRank)}</strong>
            </div>
          </div>
        ) : null}
        {ruleEffectLabel ? (
          <div className="board-effect-banner">
            <span>{ruleEffectLabel}</span>
          </div>
        ) : null}
        {game.table.isRevolution || game.table.isElevenBack ? (
          <div className="board-state-badges">
            {game.table.isElevenBack ? <div className="state-badge is-eleven-back">11バック</div> : null}
            {game.table.isRevolution ? <div className="state-badge is-vertical">革命</div> : null}
          </div>
        ) : null}
        {showTurnIndicator ? <div className="board-turn-indicator">{turnLabel}</div> : null}
        <div className="table-opponent-grid">
          <div className="seat-anchor seat-top">
            {topOpponent ? <PlayerStatus className="seat-card" compact countOnly fanSeat="top" isCurrentTurn={topOpponent.id === game.currentPlayerId} minimal player={topOpponent} showBackFan /> : null}
          </div>
          <div className="seat-anchor seat-left">
            {leftOpponent ? <PlayerStatus className="seat-card" compact countOnly fanSeat="left" isCurrentTurn={leftOpponent.id === game.currentPlayerId} minimal player={leftOpponent} showBackFan /> : null}
          </div>
          <div className="seat-anchor seat-right">
            {rightOpponent ? <PlayerStatus className="seat-card" compact countOnly fanSeat="right" isCurrentTurn={rightOpponent.id === game.currentPlayerId} minimal player={rightOpponent} showBackFan /> : null}
          </div>
          <div className="seat-anchor seat-center">
            <TableArea table={game.table} />
          </div>
        </div>
        {isInlinePendingEffect && pendingEffectLabel ? (
          <div aria-hidden="true" className="board-action-callout">
            <span>{pendingEffectLabel}</span>
          </div>
        ) : null}
        <InGameMenu
          busyAction={menuBusyAction}
          canResetRoom={canResetRoom}
          onClose={() => {
            if (!menuBusyAction) {
              setMenuOpen(false);
            }
          }}
          onResetRoom={() => {
            setMenuBusyAction('reset');
            void onResetRoom().finally(() => {
              setMenuBusyAction(null);
              setMenuOpen(false);
            });
          }}
          onReturnTitle={() => {
            setMenuBusyAction('title');
            void onReturnTitle().finally(() => {
              setMenuBusyAction(null);
              setMenuOpen(false);
            });
          }}
          open={menuOpen}
          resetLabel={resetLabel}
          roomId={room.roomId}
        />
      </main>

      <section className="panel self-dock">
        <div className="self-dock-main">
          <div className="self-dock-head">
            <PlayerStatus
              className="self-summary"
              compact
              countOnly
              isCurrentTurn={self.id === game.currentPlayerId}
              minimal
              player={self}
              showNameOnBadge
            />
          </div>
          <HandArea
            cards={hand}
            disabled={isInlinePendingEffect ? false : !isMyTurn || Boolean(pendingEffect) || Boolean(game.pendingClearReason)}
            onToggle={handleHandToggle}
            selectedCardIds={activeHandSelection}
          />
        </div>
        {inlinePendingEffect && inlineConfirmLabel ? (
          <div className="inline-effect-bar">
            <button
              className="primary-button"
              disabled={effectSelection.length !== inlineConfirmCount}
              onClick={() => void onResolveCardEffect(inlinePendingEffect.type, effectSelection)}
              type="button"
            >
              {inlineConfirmLabel}
            </button>
          </div>
        ) : (
          <SelectedActionBar
            canPass={Boolean(game.canPass) && !pendingEffect}
            canPlay={canPlay}
            onPass={() => void onPass()}
            onPlay={() => void onPlay(selectedCardIds)}
            selectedCount={selectedCardIds.length}
          />
        )}
      </section>

      {pendingEffect && pendingEffect.type === 'twelve-bomber' ? (
        <PendingEffectModal
          effect={pendingEffect}
          onConfirmCards={() => undefined}
          onSelectRank={(rank) => void onResolveBomber(rank)}
          onToggleCard={() => undefined}
          players={room.players}
          selectedCardIds={effectSelection}
          self={self}
        />
      ) : null}
    </section>
  );
}
