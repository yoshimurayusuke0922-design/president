import { chooseCpuTurnAction, resolveCpuPendingEffect } from '../game/ai/strategy.js';
import { createDefaultRoomSettings } from '../game/core/config.js';
import { advancePendingResolution, createGameState, getLegalMoveCardIds, passTurn, playCards, resolvePendingEffect } from '../game/core/engine.js';
import type {
  GameState,
  LobbyPlayer,
  PendingEffectView,
  PlayerView,
  ResolveEffectPayload,
  RoomSettings,
  RoomState,
  RoomView
} from '../game/types/index.js';
import { createRoomCode } from '../game/utils/ids.js';
import { normalizeCpuDisplayName, pickCpuNames } from '../game/utils/names.js';
import { createUuid } from '../game/utils/uuid.js';

type RoomUpdateHandler = (room: RoomState) => void;

function clampCpuCount(humanCount: number, requestedCpuCount: number): number {
  return Math.max(0, Math.min(requestedCpuCount, 4 - humanCount));
}

function isServerControlled(player: { type: 'human' | 'cpu'; isAutoControlled: boolean }): boolean {
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

function sanitizePendingEffect(effect: GameState['pendingEffect']): PendingEffectView | null {
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

function toPlayerView(room: RoomState, selfPlayerId: string): PlayerView[] {
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

function getReplacementHost(room: RoomState): LobbyPlayer | null {
  return (
    room.players.find((player) => player.type === 'human' && player.socketId) ??
    room.players.find((player) => player.type === 'human') ??
    null
  );
}

export class RoomManager {
  private readonly rooms = new Map<string, RoomState>();

  private readonly socketIndex = new Map<string, { roomId: string; playerId: string }>();

  private readonly timers = new Map<string, NodeJS.Timeout>();

  public constructor(private readonly onRoomUpdated: RoomUpdateHandler) {}

  public createRoom(socketId: string, playerName: string): { roomId: string; playerId: string } {
    let roomId = createRoomCode();
    while (this.rooms.has(roomId)) {
      roomId = createRoomCode();
    }

    const playerId = createUuid();
    const settings = createDefaultRoomSettings();
    const hostPlayer: LobbyPlayer = {
      id: playerId,
      name: playerName.trim() || 'Player 1',
      type: 'human',
      socketId,
      cpuLevel: settings.cpuLevel,
      isDisconnected: false,
      isAutoControlled: false
    };

    const room: RoomState = {
      roomId,
      hostPlayerId: playerId,
      players: [hostPlayer],
      status: 'waiting',
      settings,
      gameState: null,
      lastFinishedOrder: null
    };

    this.rooms.set(roomId, room);
    this.socketIndex.set(socketId, { roomId, playerId });
    this.emit(room);
    return { roomId, playerId };
  }

  public joinRoom(roomId: string, socketId: string, playerName: string): { roomId: string; playerId: string } {
    const room = this.getRoomOrThrow(roomId);
    if (room.status !== 'waiting') {
      throw new Error('進行中のルームには参加できません');
    }

    const humanCount = room.players.filter((player) => player.type === 'human').length;
    if (humanCount >= 4) {
      throw new Error('このルームは満員です');
    }

    const playerId = createUuid();
    room.players.push({
      id: playerId,
      name: playerName.trim() || `Player ${humanCount + 1}`,
      type: 'human',
      socketId,
      cpuLevel: room.settings.cpuLevel,
      isDisconnected: false,
      isAutoControlled: false
    });

    room.settings.cpuCount = clampCpuCount(
      room.players.filter((player) => player.type === 'human').length,
      room.settings.cpuCount
    );

    this.socketIndex.set(socketId, { roomId, playerId });
    this.emit(room);
    return { roomId, playerId };
  }

  public resumeSession(roomId: string, playerId: string, socketId: string): void {
    const room = this.getRoomOrThrow(roomId);
    const lobbyPlayer = room.players.find((player) => player.id === playerId && player.type === 'human');
    if (!lobbyPlayer) {
      throw new Error('再接続できるプレイヤーが見つかりません');
    }

    lobbyPlayer.socketId = socketId;
    lobbyPlayer.isDisconnected = false;
    lobbyPlayer.isAutoControlled = false;

    if (room.gameState) {
      const gamePlayer = room.gameState.players.find((player) => player.id === playerId);
      if (gamePlayer) {
        gamePlayer.socketId = socketId;
        gamePlayer.isDisconnected = false;
        gamePlayer.isAutoControlled = false;
      }
    }

    this.socketIndex.set(socketId, { roomId, playerId });
    this.emit(room);
    this.scheduleAutomation(roomId);
  }

  public updateSettings(roomId: string, playerId: string, nextSettings: Partial<RoomSettings>): void {
    const room = this.getRoomOrThrow(roomId);
    if (room.status !== 'waiting') {
      throw new Error('対戦開始後は設定できません');
    }

    if (room.hostPlayerId !== playerId) {
      throw new Error('設定を変更できるのはホストだけです');
    }

    const humanCount = room.players.filter((player) => player.type === 'human').length;
    room.settings = {
      cpuCount: clampCpuCount(humanCount, nextSettings.cpuCount ?? room.settings.cpuCount),
      cpuLevel: nextSettings.cpuLevel ?? room.settings.cpuLevel,
      ruleConfig: {
        ...room.settings.ruleConfig,
        ...nextSettings.ruleConfig
      }
    };

    for (const player of room.players) {
      player.cpuLevel = room.settings.cpuLevel;
    }

    this.emit(room);
  }

  public startGame(roomId: string, playerId: string): void {
    const room = this.getRoomOrThrow(roomId);
    if (room.hostPlayerId !== playerId) {
      throw new Error('ゲーム開始できるのはホストだけです');
    }

    if (room.status !== 'waiting') {
      throw new Error('このルームはすでに進行中です');
    }

    const humanPlayers = room.players.filter((player) => player.type === 'human');
    const totalPlayers = humanPlayers.length + room.settings.cpuCount;
    if (totalPlayers !== 4) {
      throw new Error('人間参加者と CPU の合計を 4 人にしてください');
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

    this.emit(room);
    this.scheduleAutomation(roomId);
  }

  public playCards(roomId: string, playerId: string, cardIds: string[]): void {
    const room = this.getPlayingRoomOrThrow(roomId);
    const result = playCards(room.gameState, playerId, cardIds);
    if (!result.ok) {
      throw new Error(result.message);
    }

    this.syncRoomState(room);
    this.emit(room);
    this.scheduleAutomation(roomId);
  }

  public passTurn(roomId: string, playerId: string): void {
    const room = this.getPlayingRoomOrThrow(roomId);
    const result = passTurn(room.gameState, playerId);
    if (!result.ok) {
      throw new Error(result.message);
    }

    this.syncRoomState(room);
    this.emit(room);
    this.scheduleAutomation(roomId);
  }

  public resolvePendingEffect(roomId: string, payload: ResolveEffectPayload): void {
    const room = this.getPlayingRoomOrThrow(roomId);
    const result = resolvePendingEffect(room.gameState, payload);
    if (!result.ok) {
      throw new Error(result.message);
    }

    this.syncRoomState(room);
    this.emit(room);
    this.scheduleAutomation(roomId);
  }

  public requestRematch(roomId: string, playerId: string): void {
    const room = this.getRoomOrThrow(roomId);
    if (room.hostPlayerId !== playerId) {
      throw new Error('連戦を開始できるのはホストだけです');
    }

    if (room.status !== 'finished') {
      throw new Error('結果画面になってから連戦できます');
    }

    room.gameState = createGameState(room.players, room.settings, (room.gameState?.round ?? 1) + 1, room.lastFinishedOrder);
    room.status = room.gameState.phase === 'result' ? 'finished' : 'playing';

    this.emit(room);
    this.scheduleAutomation(roomId);
  }

  public resetRoom(roomId: string, playerId: string): void {
    const room = this.getRoomOrThrow(roomId);
    if (room.hostPlayerId !== playerId) {
      throw new Error('ルームをリセットできるのはホストだけです');
    }

    this.clearAutomation(room.roomId);

    const connectedHumans = room.players
      .filter((player) => player.type === 'human' && player.socketId)
      .map((player) => ({
        ...player,
        cpuLevel: room.settings.cpuLevel,
        isDisconnected: false,
        isAutoControlled: false
      }));

    if (connectedHumans.length === 0) {
      throw new Error('リセットを続けられる参加者がいません');
    }

    room.players = connectedHumans;
    room.hostPlayerId = room.players.some((player) => player.id === room.hostPlayerId) ? room.hostPlayerId : room.players[0].id;
    room.settings.cpuCount = clampCpuCount(room.players.length, room.settings.cpuCount);
    room.status = 'waiting';
    room.gameState = null;
    room.lastFinishedOrder = null;

    this.emit(room);
  }

  public leaveRoom(roomId: string, playerId: string, socketId: string): void {
    const room = this.getRoomOrThrow(roomId);
    const lobbyPlayer = room.players.find((player) => player.id === playerId && player.type === 'human');
    if (!lobbyPlayer) {
      throw new Error('プレイヤーが見つかりません');
    }

    this.socketIndex.delete(socketId);
    if (lobbyPlayer.socketId && lobbyPlayer.socketId !== socketId) {
      this.socketIndex.delete(lobbyPlayer.socketId);
    }

    if (room.status === 'waiting') {
      room.players = room.players.filter((player) => player.id !== playerId);
      if (room.players.length === 0) {
        this.clearAutomation(room.roomId);
        this.rooms.delete(room.roomId);
        return;
      }

      if (room.hostPlayerId === playerId) {
        const replacementHost = getReplacementHost(room);
        if (replacementHost) {
          room.hostPlayerId = replacementHost.id;
        }
      }

      room.settings.cpuCount = clampCpuCount(
        room.players.filter((player) => player.type === 'human').length,
        room.settings.cpuCount
      );
      this.emit(room);
      return;
    }

    lobbyPlayer.socketId = null;
    lobbyPlayer.isDisconnected = true;
    lobbyPlayer.isAutoControlled = room.status === 'playing';

    if (room.gameState) {
      const gamePlayer = room.gameState.players.find((player) => player.id === playerId);
      if (gamePlayer) {
        gamePlayer.socketId = null;
        gamePlayer.isDisconnected = true;
        gamePlayer.isAutoControlled = room.status === 'playing';
      }
    }

    if (room.hostPlayerId === playerId) {
      const replacementHost = getReplacementHost(room);
      if (replacementHost) {
        room.hostPlayerId = replacementHost.id;
      }
    }

    this.emit(room);
    this.scheduleAutomation(room.roomId);
  }

  public handleDisconnect(socketId: string): void {
    const index = this.socketIndex.get(socketId);
    if (!index) {
      return;
    }

    this.socketIndex.delete(socketId);
    const room = this.rooms.get(index.roomId);
    if (!room) {
      return;
    }

    const lobbyPlayer = room.players.find((player) => player.id === index.playerId);
    if (lobbyPlayer) {
      lobbyPlayer.socketId = null;
      lobbyPlayer.isDisconnected = true;
      if (room.status === 'playing') {
        lobbyPlayer.isAutoControlled = true;
      }
    }

    if (room.gameState) {
      const gamePlayer = room.gameState.players.find((player) => player.id === index.playerId);
      if (gamePlayer) {
        gamePlayer.socketId = null;
        gamePlayer.isDisconnected = true;
        if (room.status === 'playing') {
          gamePlayer.isAutoControlled = true;
        }
      }
    }

    this.emit(room);
    this.scheduleAutomation(room.roomId);
  }

  public getRoomView(roomId: string, selfPlayerId: string): RoomView {
    const room = this.getRoomOrThrow(roomId);
    return this.toRoomView(room, selfPlayerId);
  }

  private emit(room: RoomState): void {
    this.onRoomUpdated(room);
  }

  private toRoomView(room: RoomState, selfPlayerId: string): RoomView {
    return {
      roomId: room.roomId,
      hostPlayerId: room.hostPlayerId,
      players: toPlayerView(room, selfPlayerId),
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
            pendingEffect: sanitizePendingEffect(room.gameState.pendingEffect),
            recentBomberEvent: room.gameState.recentBomberEvent,
            recentRevolutionEvent: room.gameState.recentRevolutionEvent,
            latestLogEntry: room.gameState.log[0] ?? null,
            legalMoveCardIds: getLegalMoveCardIds(room.gameState, selfPlayerId),
            canPass:
              room.gameState.phase === 'playing' &&
              room.gameState.currentPlayerId === selfPlayerId &&
              Boolean(room.gameState.table.currentMeld) &&
              !room.gameState.pendingEffect &&
              !room.gameState.pendingResolution?.clearToActor,
            round: room.gameState.round
          }
        : null,
      lastFinishedOrder: room.lastFinishedOrder,
      selfPlayerId
    };
  }

  private syncRoomState(room: RoomState): void {
    if (!room.gameState) {
      return;
    }

    for (const lobbyPlayer of room.players) {
      const gamePlayer = room.gameState.players.find((player) => player.id === lobbyPlayer.id);
      if (!gamePlayer) {
        continue;
      }

      lobbyPlayer.isDisconnected = gamePlayer.isDisconnected;
      lobbyPlayer.isAutoControlled = gamePlayer.isAutoControlled;
      lobbyPlayer.socketId = gamePlayer.socketId;
    }

    if (room.gameState.phase === 'result') {
      room.status = 'finished';
      room.lastFinishedOrder = [...room.gameState.finishedOrder];
      this.clearAutomation(room.roomId);
    } else {
      room.status = 'playing';
    }
  }

  private scheduleAutomation(roomId: string): void {
    this.clearAutomation(roomId);
    const room = this.rooms.get(roomId);
    if (!room || room.status !== 'playing' || !room.gameState) {
      return;
    }

    const gameState = room.gameState;
    if (gameState.pendingResolution?.clearToActor) {
      const delay = getAutomationDelayMs(gameState);
      const timer = setTimeout(() => {
        this.timers.delete(roomId);
        const activeRoom = this.rooms.get(roomId);
        if (!activeRoom || activeRoom.status !== 'playing' || !activeRoom.gameState) {
          return;
        }

        advancePendingResolution(activeRoom.gameState);
        this.syncRoomState(activeRoom);
        this.emit(activeRoom);
        this.scheduleAutomation(roomId);
      }, delay);

      this.timers.set(roomId, timer);
      return;
    }

    let controlledPlayerId: string | null = null;

    if (gameState.pendingEffect) {
      const player = gameState.players.find((candidate) => candidate.id === gameState.pendingEffect?.playerId);
      if (player && isServerControlled(player)) {
        controlledPlayerId = player.id;
      }
    } else if (gameState.phase === 'playing') {
      const player = gameState.players.find((candidate) => candidate.id === gameState.currentPlayerId);
      if (player && isServerControlled(player)) {
        controlledPlayerId = player.id;
      }
    }

    if (!controlledPlayerId) {
      return;
    }

    const delay = getAutomationDelayMs(room.gameState);
    const timer = setTimeout(() => {
      this.timers.delete(roomId);
      const activeRoom = this.rooms.get(roomId);
      if (!activeRoom || activeRoom.status !== 'playing' || !activeRoom.gameState) {
        return;
      }

      const activeGame = activeRoom.gameState;
      if (activeGame.pendingEffect) {
        const effectPlayer = activeGame.players.find((player) => player.id === activeGame.pendingEffect?.playerId);
        if (effectPlayer && isServerControlled(effectPlayer)) {
          const selection = resolveCpuPendingEffect(activeGame, activeGame.pendingEffect, effectPlayer);
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
      } else if (activeGame.phase === 'playing') {
        const currentPlayer = activeGame.players.find((player) => player.id === activeGame.currentPlayerId);
        if (currentPlayer && isServerControlled(currentPlayer)) {
          const action = chooseCpuTurnAction(activeGame, currentPlayer);
          if (action.type === 'pass') {
            passTurn(activeGame, currentPlayer.id);
          } else {
            playCards(activeGame, currentPlayer.id, action.cardIds);
          }
        }
      }

      this.syncRoomState(activeRoom);
      this.emit(activeRoom);
      this.scheduleAutomation(roomId);
    }, delay);

    this.timers.set(roomId, timer);
  }

  private clearAutomation(roomId: string): void {
    const timer = this.timers.get(roomId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(roomId);
    }
  }

  private getRoomOrThrow(roomId: string): RoomState {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('ルームが見つかりません');
    }

    return room;
  }

  private getPlayingRoomOrThrow(roomId: string): RoomState & { gameState: GameState } {
    const room = this.getRoomOrThrow(roomId);
    if (!room.gameState) {
      throw new Error('ゲームが開始されていません');
    }

    return room as RoomState & { gameState: GameState };
  }
}
