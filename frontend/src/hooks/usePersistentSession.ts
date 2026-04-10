import { useEffect, useState } from 'react';

import type { Session } from '../types/game';

const STORAGE_KEY = 'president-online-session';

export function usePersistentSession(): [Session | null, (session: Session | null) => void] {
  const [session, setSession] = useState<Session | null>(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  });

  useEffect(() => {
    if (session) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, [session]);

  return [session, setSession];
}
