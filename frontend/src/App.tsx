import { useEffect, useRef, useState } from 'react';

import { usePersistentSession } from './hooks/usePersistentSession';
import { preloadCardAssets } from './lib/card-assets';
import { GameScreen } from './screens/GameScreen';
import { LobbyScreen } from './screens/LobbyScreen';
import { ResultScreen } from './screens/ResultScreen';
import { RoomEntryScreen } from './screens/RoomEntryScreen';
import { TitleScreen } from './screens/TitleScreen';
import { localGameManager } from './services/local-game';
import { socketClient } from './services/socket';
import type { Rank, RoomSettings, RoomView } from './types/game';

function readRoomCodeFromUrl(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const roomId = new URL(window.location.href).searchParams.get('room');
  return roomId ? roomId.toUpperCase() : null;
}

function replaceRoomCodeInUrl(roomId: string | null): void {
  if (typeof window === 'undefined') {
    return;
  }

  const url = new URL(window.location.href);
  if (roomId) {
    url.searchParams.set('room', roomId);
  } else {
    url.searchParams.delete('room');
  }

  window.history.replaceState({}, '', url.toString());
}

function buildInviteUrl(roomId: string): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const url = new URL(window.location.href);
  url.searchParams.set('room', roomId);
  return url.toString();
}

export default function App() {
  const [draftPlayerName, setDraftPlayerName] = useState('');
  const [playMode, setPlayMode] = useState<'online' | 'local'>('online');
  const [onlineRoom, setOnlineRoom] = useState<RoomView | null>(null);
  const [localRoom, setLocalRoom] = useState<RoomView | null>(null);
  const [connected, setConnected] = useState(socketClient.isConnected());
  const [entryMode, setEntryMode] = useState<'title' | 'create' | 'join'>('title');
  const [session, setSession] = usePersistentSession();
  const [error, setError] = useState<string | null>(null);
  const [invitedRoomId, setInvitedRoomId] = useState<string | null>(() => readRoomCodeFromUrl());
  const resumeKeyRef = useRef<string | null>(null);

  const room = playMode === 'local' ? localRoom : onlineRoom;
  const effectiveConnected = playMode === 'local' ? true : connected;
  const inviteUrl = playMode === 'online' && room && !room.roomId.startsWith('LOCAL-') ? buildInviteUrl(room.roomId) : null;
  const canResetRoom = playMode === 'local' || (room ? room.hostPlayerId === room.selfPlayerId : false);

  useEffect(() => {
    preloadCardAssets();
  }, []);

  useEffect(() => {
    const disposeRoom = socketClient.onRoomState((nextRoom) => {
      setOnlineRoom(nextRoom);
      setInvitedRoomId(nextRoom.roomId);
      setError(null);
    });
    const disposeSession = socketClient.onSessionSync((nextSession) => {
      setSession(nextSession);
    });
    const disposeConnect = socketClient.onConnect((value) => {
      setConnected(value);
      if (value) {
        resumeKeyRef.current = null;
      }
    });

    return () => {
      disposeRoom();
      disposeSession();
      disposeConnect();
    };
  }, [setSession]);

  useEffect(() => {
    const disposeLocal = localGameManager.subscribe((nextRoom) => {
      setLocalRoom(nextRoom);
    });

    return () => {
      disposeLocal();
    };
  }, []);

  useEffect(() => {
    if (invitedRoomId && session && session.roomId !== invitedRoomId) {
      setSession(null);
    }
  }, [invitedRoomId, session, setSession]);

  useEffect(() => {
    if (!invitedRoomId || room || session || entryMode !== 'title') {
      return;
    }

    setPlayMode('online');
    setEntryMode('join');
  }, [entryMode, invitedRoomId, room, session]);

  useEffect(() => {
    if (playMode !== 'online' || !connected || !session || onlineRoom) {
      return;
    }

    const resumeKey = `${session.roomId}:${session.playerId}`;
    if (resumeKeyRef.current === resumeKey) {
      return;
    }

    resumeKeyRef.current = resumeKey;
    socketClient.resumeSession(session).catch((caughtError) => {
      setSession(null);
      setError((caughtError as Error).message);
    });
  }, [connected, onlineRoom, playMode, session, setSession]);

  useEffect(() => {
    if (playMode === 'local') {
      replaceRoomCodeInUrl(null);
      return;
    }

    if (room && !room.roomId.startsWith('LOCAL-')) {
      replaceRoomCodeInUrl(room.roomId);
      return;
    }

    if (entryMode === 'join' && invitedRoomId) {
      replaceRoomCodeInUrl(invitedRoomId);
      return;
    }

    replaceRoomCodeInUrl(null);
  }, [entryMode, invitedRoomId, playMode, room]);

  const showReconnectPanel = playMode === 'online' && !room && connected && Boolean(session);

  const handleReturnTitle = async () => {
    const activeMode = playMode;
    const activeRoom = room;

    if (activeMode === 'online' && activeRoom) {
      await socketClient.leaveRoom(activeRoom.roomId, activeRoom.selfPlayerId).catch(() => undefined);
    }

    setOnlineRoom(null);
    localGameManager.reset();
    setSession(null);
    setPlayMode('online');
    setEntryMode('title');
    setInvitedRoomId(null);
    setError(null);
    resumeKeyRef.current = null;
    replaceRoomCodeInUrl(null);
    if (activeMode === 'online') {
      socketClient.resetConnection();
    }
  };

  const handleResetRoom = async () => {
    if (!room) {
      return;
    }

    if (playMode === 'local') {
      localGameManager.resetToLobby();
      return;
    }

    await socketClient.resetRoom(room.roomId, room.selfPlayerId);
  };

  return (
    <div className="app-shell">
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />
      <div className="app-frame">
        {error ? <div className="banner error-banner">{error}</div> : null}

        {!room && !session && entryMode === 'title' ? (
          <TitleScreen
            playerName={draftPlayerName}
            onPlayerNameChange={setDraftPlayerName}
            onCreate={() => {
              setInvitedRoomId(null);
              setPlayMode('online');
              setEntryMode('create');
            }}
            onJoin={() => {
              setPlayMode('online');
              setEntryMode('join');
            }}
            onLocal={() => {
              setPlayMode('local');
              setInvitedRoomId(null);
              setOnlineRoom(null);
              setSession(null);
              setError(null);
              localGameManager.createLocalRoom(draftPlayerName);
            }}
          />
        ) : null}

        {!room && !session && playMode === 'online' && entryMode !== 'title' ? (
          <RoomEntryScreen
            initialPlayerName={draftPlayerName}
            initialRoomId={entryMode === 'join' ? invitedRoomId ?? '' : ''}
            mode={entryMode}
            onBack={() => {
              setEntryMode('title');
              if (!session) {
                setInvitedRoomId(null);
              }
            }}
            onSubmit={async (playerName, nextRoomId) => {
              setError(null);
              setDraftPlayerName(playerName);
              if (entryMode === 'create') {
                await socketClient.createRoom(playerName);
              } else {
                await socketClient.joinRoom(nextRoomId ?? '', playerName);
              }
            }}
          />
        ) : null}

        {room && room.status === 'waiting' ? (
          <LobbyScreen
            connected={effectiveConnected}
            inviteUrl={inviteUrl}
            onBack={() => {
              void handleReturnTitle();
            }}
            onStart={async () => {
              if (playMode === 'local') {
                localGameManager.startGame();
                return;
              }

              await socketClient.startGame(room.roomId, room.selfPlayerId);
            }}
            onUpdateSettings={async (nextSettings: Partial<RoomSettings>) => {
              if (playMode === 'local') {
                localGameManager.updateSettings(nextSettings);
                return;
              }

              await socketClient.updateSettings(room.roomId, room.selfPlayerId, nextSettings);
            }}
            room={room}
          />
        ) : null}

        {room && room.status !== 'waiting' && room.gameState?.phase !== 'result' ? (
          <GameScreen
            canResetRoom={canResetRoom}
            connected={effectiveConnected}
            onPass={async () => {
              if (playMode === 'local') {
                localGameManager.passTurn();
                return;
              }

              await socketClient.passTurn(room.roomId, room.selfPlayerId);
            }}
            onPlay={async (cardIds) => {
              if (playMode === 'local') {
                localGameManager.playCards(cardIds);
                return;
              }

              await socketClient.playCards(room.roomId, room.selfPlayerId, cardIds);
            }}
            onResolveBomber={async (rank: Rank) => {
              if (playMode === 'local') {
                localGameManager.resolveBomber(rank);
                return;
              }

              await socketClient.resolveBomber(room.roomId, room.selfPlayerId, rank);
            }}
            onResolveCardEffect={async (effectType, cardIds) => {
              if (playMode === 'local') {
                localGameManager.resolveCardEffect(effectType, cardIds);
                return;
              }

              await socketClient.resolveCardEffect(room.roomId, room.selfPlayerId, effectType, cardIds);
            }}
            onResetRoom={handleResetRoom}
            onReturnTitle={handleReturnTitle}
            room={room}
            resetLabel={playMode === 'local' ? '設定へ戻る' : 'ゲームを中断してロビーへ戻す'}
          />
        ) : null}

        {room && (room.status === 'finished' || room.gameState?.phase === 'result') ? (
          <ResultScreen
            canResetRoom={canResetRoom}
            onRematch={async () => {
              if (playMode === 'local') {
                localGameManager.requestRematch();
                return;
              }

              await socketClient.requestRematch(room.roomId, room.selfPlayerId);
            }}
            onResetRoom={handleResetRoom}
            onReturnTitle={handleReturnTitle}
            room={room}
            resetLabel={playMode === 'local' ? '設定へ戻る' : 'ルームをリセット'}
          />
        ) : null}

        {showReconnectPanel ? (
          <section className="panel screen-panel">
            <h2>再接続を試行しています</h2>
            <p>Room {session?.roomId}</p>
          </section>
        ) : null}
      </div>
    </div>
  );
}
