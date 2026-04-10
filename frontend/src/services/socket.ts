import { io, type Socket } from 'socket.io-client';

import type { RoomSettings, RoomView, Session } from '../types/game';

type AckSuccess = { ok: true; roomId?: string; playerId?: string };
type AckFailure = { ok: false; message: string };
type AckResponse = AckSuccess | AckFailure;

function resolveServerUrl(): string {
  const envUrl = import.meta.env.VITE_SERVER_URL?.trim();
  if (envUrl) {
    return envUrl;
  }

  if (typeof window === 'undefined') {
    return 'http://localhost:3001';
  }

  const { origin, hostname, port, protocol } = window.location;
  if (port === '5173' || port === '4173') {
    return `${protocol}//${hostname}:3001`;
  }

  return origin;
}

const serverUrl = resolveServerUrl();

class SocketClient {
  private socket: Socket;

  public constructor() {
    this.socket = io(serverUrl, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 1500,
      timeout: 8000,
      transports: ['websocket']
    });
  }

  public onRoomState(listener: (room: RoomView) => void): () => void {
    this.socket.on('room:state', listener);
    return () => {
      this.socket.off('room:state', listener);
    };
  }

  public onSessionSync(listener: (session: Session) => void): () => void {
    this.socket.on('session:sync', listener);
    return () => {
      this.socket.off('session:sync', listener);
    };
  }

  public onConnect(listener: (connected: boolean) => void): () => void {
    const handleConnect = () => listener(true);
    const handleDisconnect = () => listener(false);
    this.socket.on('connect', handleConnect);
    this.socket.on('disconnect', handleDisconnect);
    return () => {
      this.socket.off('connect', handleConnect);
      this.socket.off('disconnect', handleDisconnect);
    };
  }

  public isConnected(): boolean {
    return this.socket.connected;
  }

  public resetConnection(): void {
    this.socket.disconnect();
    this.socket.connect();
  }

  public async createRoom(playerName: string): Promise<void> {
    await this.emitWithAck('room:create', { playerName });
  }

  public async joinRoom(roomId: string, playerName: string): Promise<void> {
    await this.emitWithAck('room:join', { roomId, playerName });
  }

  public async resumeSession(session: Session): Promise<void> {
    await this.emitWithAck('room:resume', session);
  }

  public async updateSettings(roomId: string, playerId: string, settings: Partial<RoomSettings>): Promise<void> {
    await this.emitWithAck('room:update-settings', { roomId, playerId, settings });
  }

  public async startGame(roomId: string, playerId: string): Promise<void> {
    await this.emitWithAck('room:start', { roomId, playerId });
  }

  public async playCards(roomId: string, playerId: string, cardIds: string[]): Promise<void> {
    await this.emitWithAck('game:play', { roomId, playerId, cardIds });
  }

  public async passTurn(roomId: string, playerId: string): Promise<void> {
    await this.emitWithAck('game:pass', { roomId, playerId });
  }

  public async resolveCardEffect(
    roomId: string,
    playerId: string,
    effectType: 'seven-pass' | 'ten-discard' | 'exchange',
    cardIds: string[]
  ): Promise<void> {
    await this.emitWithAck('game:resolve-effect', { roomId, playerId, effectType, cardIds });
  }

  public async resolveBomber(roomId: string, playerId: string, targetRank: string): Promise<void> {
    await this.emitWithAck('game:resolve-effect', { roomId, playerId, effectType: 'twelve-bomber', targetRank });
  }

  public async requestRematch(roomId: string, playerId: string): Promise<void> {
    await this.emitWithAck('room:rematch', { roomId, playerId });
  }

  public async resetRoom(roomId: string, playerId: string): Promise<void> {
    await this.emitWithAck('room:reset', { roomId, playerId });
  }

  public async leaveRoom(roomId: string, playerId: string): Promise<void> {
    await this.emitWithAck('room:leave', { roomId, playerId });
  }

  private emitWithAck(event: string, payload: Record<string, unknown>): Promise<AckSuccess> {
    return new Promise((resolve, reject) => {
      this.socket.emit(event, payload, (response: AckResponse) => {
        if (!response.ok) {
          reject(new Error(response.message));
          return;
        }

        resolve(response);
      });
    });
  }
}

export const socketClient = new SocketClient();
