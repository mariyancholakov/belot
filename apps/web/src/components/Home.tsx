import { useState } from "react";
import { bg } from "../i18n/bg";

interface Props {
  nickname: string;
  initialCode: string;
  ready: boolean;
  onCreate: (nickname: string) => void;
  onJoin: (nickname: string, code: string) => void;
}

export function Home({ nickname: saved, initialCode, ready, onCreate, onJoin }: Props) {
  const [nickname, setNickname] = useState(saved);
  const [code, setCode] = useState(initialCode);
  const name = nickname.trim();

  return (
    <main className="home">
      <div className="mark" aria-hidden="true">
        <span className="c a">♠</span>
        <span className="c b">♥</span>
      </div>
      <h1>{bg.appName}</h1>

      <label className="field">
        <span>{bg.nickname}</span>
        <input value={nickname} maxLength={20} placeholder={bg.nicknamePlaceholder} onChange={(e) => setNickname(e.target.value)} autoComplete="nickname" />
      </label>

      <button className="primary" disabled={!name || !ready} onClick={() => onCreate(name)}>
        {ready ? bg.newRoom : bg.connecting}
      </button>

      <div className="or">
        <span />
      </div>

      <form
        className="join"
        onSubmit={(e) => {
          e.preventDefault();
          if (name && code.length === 4) onJoin(name, code);
        }}
      >
        <label className="field">
          <span>{bg.roomCode}</span>
          <input
            className="code"
            value={code}
            maxLength={4}
            placeholder="ABCD"
            autoCapitalize="characters"
            autoComplete="off"
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))}
          />
        </label>
        <button className="secondary" type="submit" disabled={!name || code.length !== 4 || !ready}>
          {bg.join}
        </button>
      </form>
    </main>
  );
}
