import { useEffect, useRef, useState } from "react";
import type { GameAction } from "@belot/engine";
import { History } from "./components/History";
import { Home } from "./components/Home";
import { Lobby } from "./components/Lobby";
import { Table } from "./components/Table";
import { bg } from "./i18n/bg";
import { getNickname, getToken, saveNickname, useSession } from "./net";

const codeFromPath = () => {
  const m = location.pathname.match(/^\/([A-Za-z]{4})\/?$/);
  return m ? m[1]!.toUpperCase() : "";
};

export function App() {
  const [nickname, setNickname] = useState(getNickname);
  const { session, send, clearError } = useSession(nickname);
  const { room, view } = session;
  const [pathCode] = useState(codeFromPath);
  const [showHistory, setShowHistory] = useState(false);

  const hello = (name: string) => {
    setNickname(name);
    saveNickname(name);
    send({ type: "hello", token: getToken(), nickname: name });
  };

  // Keep the address bar at the room link so refreshing returns to the table.
  useEffect(() => {
    const target = room ? `/${room.code}` : "/";
    if (location.pathname !== target) history.replaceState(null, "", target);
  }, [room?.code]);

  // A visit to /ABCD with a saved name joins straight away.
  const autoJoined = useRef(false);
  useEffect(() => {
    // Once there is a table (made or joined by hand), leaving it must not pull the player back in.
    if (room) autoJoined.current = true;
    if (autoJoined.current || !session.ready || room || !pathCode || !nickname.trim()) return;
    autoJoined.current = true;
    send({ type: "joinRoom", code: pathCode });
  }, [session.ready, room, pathCode, nickname, send]);

  // The card back chosen for this table applies to every deck on screen.
  useEffect(() => {
    document.documentElement.dataset.back = room?.cardBack ?? "classic";
  }, [room?.cardBack]);

  // Show server errors for a few seconds.
  useEffect(() => {
    if (!session.error) return;
    const t = setTimeout(clearError, 4000);
    return () => clearTimeout(t);
  }, [session.error, clearError]);

  let screen;
  if (!room && showHistory) {
    screen = <History games={session.history} onBack={() => setShowHistory(false)} />;
  } else if (!room) {
    screen = (
      <Home
        nickname={nickname}
        initialCode={pathCode}
        ready={session.ready}
        codeError={session.error?.code === "room_not_found"}
        onCreate={(name) => {
          hello(name);
          send({ type: "createRoom" });
        }}
        onJoin={(name, code) => {
          hello(name);
          send({ type: "joinRoom", code });
        }}
        onHistory={() => {
          setShowHistory(true);
          send({ type: "getHistory" });
        }}
      />
    );
  } else if (!room.started || !view) {
    screen = (
      <Lobby
        room={room}
        onSit={(seat) => send({ type: "takeSeat", seat })}
        onAddBots={() => send({ type: "addBots" })}
        onRemoveBots={() => send({ type: "removeBots" })}
        onCardBack={(back) => send({ type: "setCardBack", back })}
        onBotLevel={(level) => send({ type: "setBotLevel", level })}
        onStart={() => send({ type: "startGame" })}
        onLeave={() => send({ type: "leaveRoom" })}
      />
    );
  } else {
    screen = (
      <Table
        view={view}
        room={room}
        events={session.events}
        updateId={session.updateId}
        turnLeftMs={session.turnLeftMs}
        send={(action: GameAction) => send({ type: "action", action })}
        onNewGame={() => send({ type: "startGame" })}
        onLeave={() => send({ type: "leaveRoom" })}
      />
    );
  }

  return (
    <>
      {screen}
      {session.status !== "open" && <div className="banner">{session.status === "connecting" ? bg.connecting : bg.reconnecting}</div>}
      {session.error && !(session.error.code === "room_not_found" && !room) && (
        <div className="toast" role="alert">
          {bg.error[session.error.code] ?? session.error.code}
        </div>
      )}
    </>
  );
}
