import { describe, expect, it } from 'vitest';

import { RoomManager } from './room-manager.js';

function createManager() {
  return new RoomManager(() => undefined);
}

describe('room manager', () => {
  it('resets a room back to waiting so the same room code can be reused', () => {
    const manager = createManager();
    const host = manager.createRoom('socket-host', 'Host');
    const guest = manager.joinRoom(host.roomId, 'socket-guest', 'Guest');

    manager.updateSettings(host.roomId, host.playerId, { cpuCount: 2 });
    manager.startGame(host.roomId, host.playerId);
    manager.handleDisconnect('socket-guest');
    manager.resetRoom(host.roomId, host.playerId);

    const resetView = manager.getRoomView(host.roomId, host.playerId);

    expect(resetView.roomId).toBe(host.roomId);
    expect(resetView.status).toBe('waiting');
    expect(resetView.gameState).toBeNull();
    expect(resetView.players).toHaveLength(1);
    expect(resetView.players[0]?.name).toBe('Host');

    const newcomer = manager.joinRoom(host.roomId, 'socket-new', 'New Guest');
    const newcomerView = manager.getRoomView(host.roomId, newcomer.playerId);

    expect(newcomerView.players.map((player) => player.name)).toEqual(['Host', 'New Guest']);
    expect(newcomerView.status).toBe('waiting');
    expect(newcomerView.hostPlayerId).toBe(host.playerId);
    expect(newcomerView.selfPlayerId).toBe(newcomer.playerId);
    expect(guest.playerId).not.toBe(newcomer.playerId);
  });

  it('reassigns the host when the current host leaves during a game', () => {
    const manager = createManager();
    const host = manager.createRoom('socket-host', 'Host');
    const guest = manager.joinRoom(host.roomId, 'socket-guest', 'Guest');

    manager.updateSettings(host.roomId, host.playerId, { cpuCount: 2 });
    manager.startGame(host.roomId, host.playerId);
    manager.leaveRoom(host.roomId, host.playerId, 'socket-host');

    const guestView = manager.getRoomView(host.roomId, guest.playerId);
    const formerHost = guestView.players.find((player) => player.id === host.playerId);

    expect(guestView.hostPlayerId).toBe(guest.playerId);
    expect(formerHost?.isDisconnected).toBe(true);
    expect(formerHost?.isAutoControlled).toBe(true);
  });

  it('returns immutable room snapshots during a game so previous views do not mutate after plays', () => {
    const manager = createManager();
    const host = manager.createRoom('socket-host', 'Host');

    manager.updateSettings(host.roomId, host.playerId, { cpuCount: 3 });
    manager.startGame(host.roomId, host.playerId);

    const initialView = manager.getRoomView(host.roomId, host.playerId);
    const activePlayerId = initialView.gameState?.currentPlayerId;

    expect(activePlayerId).toBeTruthy();

    const beforePlayView = manager.getRoomView(host.roomId, activePlayerId ?? host.playerId);
    const selectedCardIds = beforePlayView.gameState?.legalMoveCardIds[0] ?? [];
    const beforeHandIds = beforePlayView.players
      .find((player) => player.id === activePlayerId)
      ?.hand?.map((card) => card.id) ?? [];

    expect(beforePlayView.gameState?.table.currentMeld).toBeNull();
    expect(selectedCardIds.length).toBeGreaterThan(0);

    manager.playCards(host.roomId, activePlayerId ?? host.playerId, selectedCardIds);

    const afterPlayView = manager.getRoomView(host.roomId, activePlayerId ?? host.playerId);
    const afterHand = afterPlayView.players.find((player) => player.id === activePlayerId)?.hand ?? [];
    const tableCardIds = afterPlayView.gameState?.table.currentMeld?.cards.map((card) => card.id).sort() ?? [];

    expect(beforePlayView.gameState?.table.currentMeld).toBeNull();
    expect(beforePlayView.players.find((player) => player.id === activePlayerId)?.hand?.map((card) => card.id) ?? []).toEqual(beforeHandIds);
    expect(tableCardIds).toEqual([...selectedCardIds].sort());
    expect(afterHand).toHaveLength(beforeHandIds.length - selectedCardIds.length);
  });
});
