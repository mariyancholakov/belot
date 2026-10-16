import { useEffect, useState } from "react";
import { bg } from "../i18n/bg";
import { Controls } from "./Controls";
import { LogoMark } from "./Logo";

interface Props {
  nickname: string;
  initialCode: string;
  ready: boolean;
  /** The server just said there is no table with the code that was tried. */
  codeError: boolean;
  onCreate: (nickname: string) => void;
  onJoin: (nickname: string, code: string) => void;
}

export function Home({ nickname: saved, initialCode, ready, codeError, onCreate, onJoin }: Props) {
  const [nickname, setNickname] = useState(saved);
  const [code, setCode] = useState(initialCode);
  const [badCode, setBadCode] = useState<string | null>(null);
  const name = nickname.trim();
  // Someone who opened a shared link is here to join that table, not to open a new one.
  const fromLink = initialCode.length === 4;
  const invalid = badCode !== null && badCode === code;

  useEffect(() => {
    if (codeError) setBadCode(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeError]);

  const join = (
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
          placeholder={bg.codePlaceholder}
          autoCapitalize="characters"
          autoComplete="off"
          aria-invalid={invalid}
          aria-describedby={invalid ? "code-error" : undefined}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))}
        />
        {invalid && (
          <span className="field-error" id="code-error" role="alert">
            {bg.error.room_not_found}
          </span>
        )}
      </label>
      <button className={fromLink && !invalid ? "primary" : "secondary"} type="submit" disabled={!name || code.length !== 4 || !ready}>
        {bg.join}
      </button>
    </form>
  );

  const create = (
    <button className={fromLink ? "ghost" : "primary"} disabled={!name || !ready} onClick={() => onCreate(name)}>
      {ready ? bg.newRoom : bg.connecting}
    </button>
  );

  return (
    <main className="home">
      <a className="home-logo" href="/">
        <LogoMark />
        {bg.appName}
      </a>
      <div className="page-controls">
        <Controls />
      </div>
      <div className="home-panel">
        {fromLink && <p className="home-invite">{bg.invited}</p>}
        <label className="field">
          <span>{bg.nickname}</span>
          <input value={nickname} maxLength={20} placeholder={bg.nicknamePlaceholder} onChange={(e) => setNickname(e.target.value)} autoComplete="nickname" />
        </label>

        {fromLink ? join : create}
        {fromLink ? create : join}
      </div>
    </main>
  );
}
