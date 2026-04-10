import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import cors from 'cors';
import express from 'express';
import { Server } from 'socket.io';

import { RoomManager } from './rooms/room-manager.js';

type AckResponse =
  | { ok: true }
  | { ok: true; roomId: string; playerId: string }
  | { ok: false; message: string };

const app = express();
app.use(cors());

const currentDir = dirname(fileURLToPath(import.meta.url));
const frontendDistDir = join(
  currentDir,
  '../../frontend/dist'
);

app.get('/health', (_request, response) => {
  response.json({ ok: true });
});

if (existsSync(frontendDistDir)) {
  app.use(express.static(frontendDistDir));

  app.get('*', (request, response, next) => {
    if (request.path.startsWith('/socket.io')) {
      next();
      return;
    }

    response.sendFile(join(frontendDistDir, 'index.html'));
  });
}

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*'
  }
});

const roomManager = new RoomManager((room) => {
  for (const player of room.players) {
    if (!player.socketId) {
      continue;
    }

    io.to(player.socketId).emit('room:state', roomManager.getRoomView(room.roomId, player.id));
  }
});

function resolveAck(ack: ((response: AckResponse) => void) | undefined, response: AckResponse): void {
  if (ack) {
    ack(response);
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '不明なエラーが発生しました';
}

io.on('connection', (socket) => {
  socket.on('room:create', (payload: { playerName: string }, ack?: (response: AckResponse) => void) => {
    try {
      const session = roomManager.createRoom(socket.id, payload.playerName);
      socket.emit('session:sync', session);
      resolveAck(ack, { ok: true, ...session });
    } catch (error) {
      resolveAck(ack, { ok: false, message: getErrorMessage(error) });
    }
  });

  socket.on('room:join', (payload: { roomId: string; playerName: string }, ack?: (response: AckResponse) => void) => {
    try {
      const session = roomManager.joinRoom(payload.roomId.toUpperCase(), socket.id, payload.playerName);
      socket.emit('session:sync', session);
      resolveAck(ack, { ok: true, ...session });
    } catch (error) {
      resolveAck(ack, { ok: false, message: getErrorMessage(error) });
    }
  });

  socket.on('room:resume', (payload: { roomId: string; playerId: string }, ack?: (response: AckResponse) => void) => {
    try {
      roomManager.resumeSession(payload.roomId.toUpperCase(), payload.playerId, socket.id);
      socket.emit('session:sync', {
        roomId: payload.roomId.toUpperCase(),
        playerId: payload.playerId
      });
      resolveAck(ack, { ok: true });
    } catch (error) {
      resolveAck(ack, { ok: false, message: getErrorMessage(error) });
    }
  });

  socket.on('room:update-settings', (payload: { roomId: string; playerId: string; settings: Record<string, unknown> }, ack?: (response: AckResponse) => void) => {
    try {
      roomManager.updateSettings(payload.roomId.toUpperCase(), payload.playerId, payload.settings as never);
      resolveAck(ack, { ok: true });
    } catch (error) {
      resolveAck(ack, { ok: false, message: getErrorMessage(error) });
    }
  });

  socket.on('room:start', (payload: { roomId: string; playerId: string }, ack?: (response: AckResponse) => void) => {
    try {
      roomManager.startGame(payload.roomId.toUpperCase(), payload.playerId);
      resolveAck(ack, { ok: true });
    } catch (error) {
      resolveAck(ack, { ok: false, message: getErrorMessage(error) });
    }
  });

  socket.on('game:play', (payload: { roomId: string; playerId: string; cardIds: string[] }, ack?: (response: AckResponse) => void) => {
    try {
      roomManager.playCards(payload.roomId.toUpperCase(), payload.playerId, payload.cardIds);
      resolveAck(ack, { ok: true });
    } catch (error) {
      resolveAck(ack, { ok: false, message: getErrorMessage(error) });
    }
  });

  socket.on('game:pass', (payload: { roomId: string; playerId: string }, ack?: (response: AckResponse) => void) => {
    try {
      roomManager.passTurn(payload.roomId.toUpperCase(), payload.playerId);
      resolveAck(ack, { ok: true });
    } catch (error) {
      resolveAck(ack, { ok: false, message: getErrorMessage(error) });
    }
  });

  socket.on(
    'game:resolve-effect',
    (
      payload:
        | { roomId: string; playerId: string; effectType: 'seven-pass' | 'ten-discard' | 'exchange'; cardIds: string[] }
        | { roomId: string; playerId: string; effectType: 'twelve-bomber'; targetRank: string },
      ack?: (response: AckResponse) => void
    ) => {
      try {
        roomManager.resolvePendingEffect(payload.roomId.toUpperCase(), payload as never);
        resolveAck(ack, { ok: true });
      } catch (error) {
        resolveAck(ack, { ok: false, message: getErrorMessage(error) });
      }
    }
  );

  socket.on('room:rematch', (payload: { roomId: string; playerId: string }, ack?: (response: AckResponse) => void) => {
    try {
      roomManager.requestRematch(payload.roomId.toUpperCase(), payload.playerId);
      resolveAck(ack, { ok: true });
    } catch (error) {
      resolveAck(ack, { ok: false, message: getErrorMessage(error) });
    }
  });

  socket.on('room:reset', (payload: { roomId: string; playerId: string }, ack?: (response: AckResponse) => void) => {
    try {
      roomManager.resetRoom(payload.roomId.toUpperCase(), payload.playerId);
      resolveAck(ack, { ok: true });
    } catch (error) {
      resolveAck(ack, { ok: false, message: getErrorMessage(error) });
    }
  });

  socket.on('room:leave', (payload: { roomId: string; playerId: string }, ack?: (response: AckResponse) => void) => {
    try {
      roomManager.leaveRoom(payload.roomId.toUpperCase(), payload.playerId, socket.id);
      resolveAck(ack, { ok: true });
    } catch (error) {
      resolveAck(ack, { ok: false, message: getErrorMessage(error) });
    }
  });

  socket.on('disconnect', () => {
    roomManager.handleDisconnect(socket.id);
  });
});

const port = Number(process.env.PORT ?? 3001);
httpServer.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`backend listening on http://localhost:${port}`);
});
