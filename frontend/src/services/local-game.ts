import { chooseCpuTurnAction, resolveCpuPendingEffect } from '../../../backend/src/game/ai/strategy.js';
import { createDefaultRoomSettings } from '../../../backend/src/game/core/config.js';
import { advancePendingResolution, createGameState, getLegalMoveCardIds, passTurn, playCards, resolvePendingEffect } from '../../../backend/src/game/core/engine.js';
import type { GameState, LobbyPlayer, PendingEffectView, ResolveEffectPayload, RoomSettings as EngineRoomSettings } from '../../../backend/src/game/types/index.js';
import { createRoomCode } from '../../../backend/src/game/utils/ids.js';
import { normalizeCpuDisplayName, pickCpuNames } from '../../../backend/src/game/utils/names.js';
import { createUuid } from '../../../backend/src/game/utils/uuid.js';
import { snapshotRoomView } from '../../../backend/src/game/view/room-view.js';
import type { PlayerView, Rank, RoomSettings, RoomView } from '../types/game';

type LocalRoomState = {
  roomId: string;
  hostPlayerId: string;
  players: LobbyPlayer[];
  status: 'waiting' | 'playing' | 'finished';
  settings: EngineRoomSettings;
  gameState: GameState | null;
  lastFinishedOrder: string[] | null;
};

type RoomListener = (room: RoomView | null) => void;

function isControlled(player: LobbyPlayer): boolean {
  return player.type === 'cpu' || player.isAutoControlled;
}

function getAutomationDelayMs(gameState: GameState): number {
  if (gameState.pendingResolution?.clearToActor) {
    return gameState.pendingResolution.clearReason === 'eight-cut' ? 950 : 700;
  }

  if (gameState.pendingEffect) {
    return 1150 + Math.floor(Math.random() * 180);
  }

  if (gameState.table.currentMeld?.containsJack && gameState.table.isElevenBack) {
    return 1450 + Math.floor(Math.random() * 220);
  }

  return 820 + Math.floor(Math.random() * 180);
}

function toPendingEffectView(effect: GameState['pendingEffect']): PendingEffectView | null {
  if (!effect) {
    return null;
  }

  if (effect.type === 'seven-pass') {
    return {
      type: 'seven-pass',
      playerId: effect.playerId,
      targetPlayerId: effect.targetPlayerId,
      count: effect.count
    };
  }

  if (effect.type === 'ten-discard') {
    return {
      type: 'ten-discard',
      playerId: effect.playerId,
      count: effect.count
    };
  }

  if (effect.type === 'twelve-bomber') {
    return {
      type: effect.type,
      playerId: effect.playerId,
      choices: effect.choices
    };
  }

  if (effect.type === 'exchange') {
    return {
      type: effect.type,
      playerId: effect.playerId,
      targetPlayerId: effect.targetPlayerId,
      count: effect.count
    };
  }

  throw new Error(`Unsupported pending effect: ${(effect as { type: string }).type}`);
}

function toPlayerView(room: LocalRoomState, selfPlayerId: string): PlayerView[] {
  const gamePlayers = room.gameState?.players ?? [];

  return room.players.map((player) => {
    const gamePlayer = gamePlayers.find((candidate) => candidate.id === player.id);

    return {
      id: player.id,
      name: player.type === 'cpu' ? normalizeCpuDisplayName(player.name) : player.name,
      type: player.type,
      cpuLevel: player.cpuLevel,
      cardCount: gamePlayer?.hand.length ?? 0,
      rank: gamePlayer?.finishOrder ?? null,
      isDisconnected: gamePlayer?.isDisconnected ?? player.isDisconnected,
      isAutoControlled: gamePlayer?.isAutoControlled ?? player.isAutoControlled,
      isPassed: gamePlayer?.isPassed ?? false,
      isHost: room.hostPlayerId === player.id,
      ...(gamePlayer && player.id === selfPlayerId ? { hand: gamePlayer.hand } : {})
    };
  });
}

class LocalGameManager {
  private room: LocalRoomState | null = null;

  private listeners = new Set<RoomListener>();

  private timer: number | null = null;

  private selfPlayerId: string | null = null;

  public subscribe(listener: RoomListener): () => void {
    this.listeners.add(listener);
    listener(this.toRoomView());

    return () => {
      this.listeners.delete(listener);
    };
  }

  public createLocalRoom(playerName = ''): void {
    const selfPlayerId = createUuid();
    this.selfPlayerId = selfPlayerId;
    this.room = {
      roomId: `LOCAL-${createRoomCode()}`,
      hostPlayerId: selfPlayerId,
      players: [
        {
          id: selfPlayerId,
          name: playerName.trim() || 'Player 1',
          type: 'human',
          socketId: null,
          cpuLevel: 'normal',
          isDisconnected: false,
          isAutoControlled: false
        }
      ],
      status: 'waiting',
      settings: {
        ...createDefaultRoomSettings(),
        cpuCount: 3
      },
      gameState: null,
      lastFinishedOrder: null
    };

    this.clearTimer();
    this.emit();
  }

  public updateSettings(nextSettings: Partial<RoomSettings>): void {
    const room = this.getRoomOrThrow();
    if (room.status !== 'waiting') {
      throw new Error('対戦開始後は設定変更できません');
    }

    room.settings = {
      cpuCount: nextSettings.cpuCount ?? room.settings.cpuCount,
      cpuLevel: nextSettings.cpuLevel ?? room.settings.cpuLevel,
      ruleConfig: {
        ...room.settings.ruleConfig,
        ...nextSettings.ruleConfig
      }
    };

    for (const player of room.players) {
      player.cpuLevel = room.settings.cpuLevel;
    }

    this.emit();
  }

  public startGame(): void {
    const room = this.getRoomOrThrow();
    if (room.status !== 'waiting') {
      throw new Error('このローカルゲームはすでに開始されています');
    }

    const humanPlayers = room.players.filter((player) => player.type === 'human');
    if (humanPlayers.length !== 1) {
      throw new Error('ローカルモードは 1 人プレイ専用です');
    }

    if (room.settings.cpuCount !== 3) {
      throw new Error('ローカルモードでは CPU 3 人で開始してください');
    }

    const cpuNames = pickCpuNames(room.settings.cpuCount);
    const cpuPlayers: LobbyPlayer[] = Array.from({ length: room.settings.cpuCount }, (_, index) => ({
      id: createUuid(),
      name: cpuNames[index] ?? `CPU ${index + 1}`,
      type: 'cpu',
      socketId: null,
      cpuLevel: room.settings.cpuLevel,
      isDisconnected: false,
      isAutoControlled: true
    }));

    room.players = [...humanPlayers, ...cpuPlayers];
    room.gameState = createGameState(room.players, room.settings, 1, null);
    room.status = room.gameState.phase === 'result' ? 'finished' : 'playing';

    this.syncRoomState();
    this.emit();
    this.scheduleAutomation();
  }

  public playCards(cardIds: string[]): void {
    const room = this.getPlayingRoomOrThrow();
    const result = playCards(room.gameState, this.getSelfPlayerId(), cardIds);
    if (!result.ok) {
      throw new Error(result.message);
    }

    this.afterMutation();
  }

  public passTurn(): void {
    const room = this.getPlayingRoomOrThrow();
    const result = passTurn(room.gameState, this.getSelfPlayerId());
    if (!result.ok) {
      throw new Error(result.message);
    }

    this.afterMutation();
  }

  public resolveCardEffect(effectType: 'seven-pass' | 'ten-discard' | 'exchange', cardIds: string[]): void {
    const room = this.getPlayingRoomOrThrow();
    const payload: ResolveEffectPayload = {
      playerId: this.getSelfPlayerId(),
      effectType,
      cardIds
    };
    const result = resolvePendingEffect(room.gameState, payload);
    if (!result.ok) {
      throw new Error(result.message);
    }

    this.afterMutation();
  }

  public resolveBomber(targetRank: Rank): void {
    const room = this.getPlayingRoomOrThrow();
    const result = resolvePendingEffect(room.gameState, {
      playerId: this.getSelfPlayerId(),
      effectType: 'twelve-bomber',
      targetRank
    });
    if (!result.ok) {
      throw new Error(result.message);
    }

    this.afterMutation();
  }

  public requestRematch(): void {
    const room = this.getRoomOrThrow();
    if (room.status !== 'finished') {
      throw new Error('結果画面になってから連戦できます');
    }

    room.gameState = createGameState(room.players, room.settings, (room.gameState?.round ?? 1) + 1, room.lastFinishedOrder);
    room.status = room.gameState.phase === 'result' ? 'finished' : 'playing';

    this.syncRoomState();
    this.emit();
    this.scheduleAutomation();
  }

  public resetToLobby(): void {
    const room = this.getRoomOrThrow();
    const selfPlayerId = this.getSelfPlayerId();
    const selfPlayer = room.players.find((player) => player.id === selfPlayerId && player.type === 'human');
    if (!selfPlayer) {
      throw new Error('ローカルプレイヤーが見つかりません');
    }

    this.clearTimer();
    room.players = [
      {
        ...selfPlayer,
        socketId: null,
        cpuLevel: room.settings.cpuLevel,
        isDisconnected: false,
        isAutoControlled: false
      }
    ];
    room.hostPlayerId = selfPlayer.id;
    room.status = 'waiting';
    room.gameState = null;
    room.lastFinishedOrder = null;
    this.emit();
  }

  public reset(): void {
    this.clearTimer();
    this.room = null;
    this.selfPlayerId = null;
    this.emit();
  }

  private afterMutation(): void {
    this.syncRoomState();
    this.emit();
    this.scheduleAutomation();
  }

  private emit(): void {
    const view = this.toRoomView();
    for (const listener of this.listeners) {
      listener(view);
    }
  }

  private toRoomView(): RoomView | null {
    if (!this.room || !this.selfPlayerId) {
      return null;
    }

    const room = this.room;

    return snapshotRoomView({
      roomId: room.roomId,
      hostPlayerId: room.hostPlayerId,
      players: toPlayerView(room, this.selfPlayerId),
      status: room.status,
      settings: room.settings,
      gameState: room.gameState
        ? {
            phase: room.gameState.phase,
            currentPlayerId: room.gameState.currentPlayerId,
            table: room.gameState.table,
            pendingClearReason: room.gameState.pendingResolution?.clearToActor ? room.gameState.pendingResolution.clearReason : null,
            finishedOrder: room.gameState.finishedOrder,
            ruleConfig: room.gameState.ruleConfig,
            pendingEffect: toPendingEffectView(room.gameState.pendingEffect),
            recentBomberEvent: room.gameState.recentBomberEvent,
            recentRevolutionEvent: room.gameState.recentRevolutionEvent,
            latestLogEntry: room.gameState.log[0] ?? null,
            legalMoveCardIds: getLegalMoveCardIds(room.gameState, this.selfPlayerId),
            canPass:
              room.gameState.phase === 'playing' &&
              room.gameState.currentPlayerId === this.selfPlayerId &&
              Boolean(room.gameState.table.currentMeld) &&
              !room.gameState.pendingEffect &&
              !room.gameState.pendingResolution?.clearToActor,
            round: room.gameState.round
          }
        : null,
      lastFinishedOrder: room.lastFinishedOrder,
      selfPlayerId: this.selfPlayerId
    });
  }

  private syncRoomState(): void {
    const room = this.room;
    if (!room?.gameState) {
      return;
    }

    for (const lobbyPlayer of room.players) {
      const gamePlayer = room.gameState.players.find((player) => player.id === lobbyPlayer.id);
      if (!gamePlayer) {
        continue;
      }

      lobbyPlayer.isAutoControlled = gamePlayer.isAutoControlled;
      lobbyPlayer.isDisconnected = gamePlayer.isDisconnected;
    }

    if (room.gameState.phase === 'result') {
      room.status = 'finished';
      room.lastFinishedOrder = [...room.gameState.finishedOrder];
      this.clearTimer();
    } else {
      room.status = 'playing';
    }
  }

  private scheduleAutomation(): void {
    this.clearTimer();

    const room = this.room;
    if (!room?.gameState || room.status !== 'playing') {
      return;
    }

    const gameState = room.gameState;
    if (gameState.pendingResolution?.clearToActor) {
      this.timer = window.setTimeout(() => {
        this.timer = null;
        const activeRoom = this.room;
        if (!activeRoom?.gameState || activeRoom.status !== 'playing') {
          return;
        }

        advancePendingResolution(activeRoom.gameState);
        this.syncRoomState();
        this.emit();
        this.scheduleAutomation();
      }, getAutomationDelayMs(gameState));

      return;
    }

    let controlledPlayer: LobbyPlayer | undefined;

    if (gameState.pendingEffect) {
      controlledPlayer = room.players.find((player) => player.id === gameState.pendingEffect?.playerId);
    } else {
      controlledPlayer = room.players.find((player) => player.id === gameState.currentPlayerId);
    }

    if (!controlledPlayer || !isControlled(controlledPlayer)) {
      return;
    }

    this.timer = window.setTimeout(() => {
      this.timer = null;
      const activeRoom = this.room;
      if (!activeRoom?.gameState || activeRoom.status !== 'playing') {
        return;
      }

      const activeGame = activeRoom.gameState;

      if (activeGame.pendingEffect) {
        const effectPlayer = activeRoom.players.find((player) => player.id === activeGame.pendingEffect?.playerId);
        if (effectPlayer && isControlled(effectPlayer)) {
          const cpuGamePlayer = activeGame.players.find((player) => player.id === effectPlayer.id);
          if (!cpuGamePlayer) {
            return;
          }

          const selection = resolveCpuPendingEffect(activeGame, activeGame.pendingEffect, cpuGamePlayer);

          if (typeof selection === 'string') {
            resolvePendingEffect(activeGame, {
              playerId: effectPlayer.id,
              effectType: 'twelve-bomber',
              targetRank: selection
            });
          } else {
            resolvePendingEffect(activeGame, {
              playerId: effectPlayer.id,
              effectType: activeGame.pendingEffect.type,
              cardIds: selection
            } as ResolveEffectPayload);
          }
        }
      } else {
        const currentPlayer = activeGame.players.find((player) => player.id === activeGame.currentPlayerId);
        if (currentPlayer && isControlled(activeRoom.players.find((player) => player.id === currentPlayer.id) ?? activeRoom.players[0])) {
          const action = chooseCpuTurnAction(activeGame, currentPlayer);
          if (action.type === 'pass') {
            passTurn(activeGame, currentPlayer.id);
          } else {
            playCards(activeGame, currentPlayer.id, action.cardIds);
          }
        }
      }

      this.syncRoomState();
      this.emit();
      this.scheduleAutomation();
    }, getAutomationDelayMs(gameState));
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private getSelfPlayerId(): string {
    if (!this.selfPlayerId) {
      throw new Error('ローカルプレイヤーが見つかりません');
    }

    return this.selfPlayerId;
  }

  private getRoomOrThrow(): LocalRoomState {
    if (!this.room) {
      throw new Error('ローカルゲームが初期化されていません');
    }

    return this.room;
  }

  private getPlayingRoomOrThrow(): LocalRoomState & { gameState: GameState } {
    const room = this.getRoomOrThrow();
    if (!room.gameState) {
      throw new Error('ゲームが開始されていません');
    }

    return room as LocalRoomState & { gameState: GameState };
  }
}

export const localGameManager = new LocalGameManager();
