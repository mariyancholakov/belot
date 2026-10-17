import { bg } from "../i18n/bg";
import { useSound } from "../sound";
import { useTheme } from "../theme";
import { hasVoice, useVoice } from "../voice";
import { Icon } from "./Icon";

/** Theme and sound switches, shared by every screen. */
export function Controls() {
  const { choice, cycle } = useTheme();
  const { on, toggle } = useSound();
  const voice = useVoice();
  const themeLabel = { light: bg.themeLight, dark: bg.themeDark }[choice];
  const themeIcon = { light: "sun", dark: "moon" }[choice];
  return (
    <div className="controls">
      <button className="icon-btn" onClick={cycle} aria-label={`${bg.theme}: ${themeLabel}`} title={`${bg.theme}: ${themeLabel}`}>
        <Icon name={themeIcon} />
      </button>
      <button className="icon-btn" onClick={toggle} aria-pressed={on} aria-label={on ? bg.soundOn : bg.soundOff} title={on ? bg.soundOn : bg.soundOff}>
        <Icon name={on ? "volume" : "mute"} />
      </button>
      {/* the spoken calls go silent with the rest of the sound */}
      {hasVoice && (
        <button className="icon-btn" onClick={voice.toggle} disabled={!on} aria-pressed={voice.on && on} aria-label={voice.on && on ? bg.voiceOn : bg.voiceOff} title={voice.on && on ? bg.voiceOn : bg.voiceOff}>
          <Icon name={voice.on && on ? "voice" : "voiceOff"} />
        </button>
      )}
    </div>
  );
}
