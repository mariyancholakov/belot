import { useCallback, useEffect, useRef, useState } from "react";
import type { GameEvent, GameView } from "@belot/engine";
import type { ClientMessage, RoomState, ServerMessage } from "@belot/protocol";

export interface Session {
  status: "connecting" | "open" | "closed";
  /** True after the server has answered our hello at least once. */
  ready: boolean;
  room: RoomState | null;
  view: GameView | null;
  /** Events of the latest update, for animations. */
  events: GameEvent[];
  /** Bumps on every update so effects can react to it. */
  updateId: number;
  error: { code: string } | null;
}

const TOKEN_KEY = "belot.token";
const NAME_KEY = "belot.nickname";

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: the session just won't survive a reload */
  }
}

function makeToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function getToken(): string {
  let token = safeGet(TOKEN_KEY);
  if (!token || !/^[A-Za-z0-9_-]{16,64}$/.test(token)) {
    token = makeToken();
    safeSet(TOKEN_KEY, token);
  }
  return token;
}

export const getNickname = () => safeGet(NAME_KEY) ?? "";
export const saveNickname = (name: string) => safeSet(NAME_KEY, name);

function socketUrl(): string {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${location.host}/ws`;
}

const initial: Session = {
  status: "connecting",
  ready: false,
  room: null,
  view: null,
  events: [],
  updateId: 0,
  error: null,
};

/**
 * Keeps one websocket alive (reconnecting with backoff) and mirrors what the
 * server says. `nickname` is re-sent whenever it changes.
 */
export function useSession(nickname: string) {
  const [session, setSession] = useState<Session>(initial);
  const wsRef = useRef<WebSocket | null>(null);
  const nicknameRef = useRef(nickname);
  nicknameRef.current = nickname;

  const send = useCallback((msg: ClientMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }, []);

  useEffect(() => {
    let closedByUs = false;
    let retry = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      const ws = new WebSocket(socketUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        retry = 0;
        setSession((s) => ({ ...s, status: "open" }));
        ws.send(JSON.stringify({ type: "hello", token: getToken(), nickname: nicknameRef.current || "Играч" }));
      };

      ws.onmessage = (event) => {
        let msg: ServerMessage;
        try {
          msg = JSON.parse(event.data as string) as ServerMessage;
        } catch {
          return;
        }
        setSession((s) => {
          switch (msg.type) {
            case "roomState":
              return { ...s, ready: true, room: msg.room, view: msg.room ? s.view : null, error: null };
            case "update":
              return { ...s, view: msg.view, events: msg.events, updateId: s.updateId + 1, error: null };
            case "error":
              return { ...s, error: { code: msg.code } };
          }
        });
      };

      ws.onclose = () => {
        if (closedByUs) return;
        setSession((s) => ({ ...s, status: "closed" }));
        const delay = Math.min(8000, 500 * 2 ** retry++);
        timer = setTimeout(connect, delay);
      };
    };

    connect();
    return () => {
      closedByUs = true;
      clearTimeout(timer);
      wsRef.current?.close();
    };
  }, []);

  const clearError = useCallback(() => setSession((s) => ({ ...s, error: null })), []);
  return { session, send, clearError };
}
