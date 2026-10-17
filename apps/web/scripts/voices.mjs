// Records the spoken calls (bids, announcements, round results) with Azure's Bulgarian neural voices.
// The clips are committed, so this runs only when a phrase or a voice changes.
//
// Needs AZURE_SPEECH_KEY and AZURE_SPEECH_REGION, from the environment or the repo's .env (never committed).
// Usage: pnpm --filter @belot/web voices [--force] [--only pass,contra]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const voiceDir = join(here, "../src/voice");
const phrases = JSON.parse(readFileSync(join(voiceDir, "phrases.json"), "utf8"));

/** One voice per team, so a call tells you which side made it. */
const VOICES = { borislav: "bg-BG-BorislavNeural", kalina: "bg-BG-KalinaNeural" };

function readEnv() {
  const env = { ...process.env };
  const file = join(here, "../../../.env");
  if (existsSync(file)) {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
      if (m && !env[m[1]]) env[m[1]] = m[2];
    }
  }
  return env;
}

const escape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** No silence before or after the word: the clip starts the moment the bid lands. */
const ssml = (voice, text) =>
  `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="bg-BG">` +
  `<voice name="${voice}"><mstts:silence type="Leading-exact" value="0ms"/><mstts:silence type="Tailing-exact" value="0ms"/>` +
  `<prosody rate="+6%">${escape(text)}</prosody></voice></speak>`;

const env = readEnv();
const key = env.AZURE_SPEECH_KEY;
const region = env.AZURE_SPEECH_REGION;
if (!key || !region) {
  console.error("Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION (in the environment or in .env at the repo root).");
  process.exit(1);
}

const args = process.argv.slice(2);
const force = args.includes("--force");
const onlyAt = args.indexOf("--only");
const only = onlyAt >= 0 ? new Set(args[onlyAt + 1].split(",")) : null;

let made = 0;
for (const [name, voice] of Object.entries(VOICES)) {
  mkdirSync(join(voiceDir, name), { recursive: true });
  for (const [id, text] of Object.entries(phrases)) {
    if (only && !only.has(id)) continue;
    const out = join(voiceDir, name, `${id}.mp3`);
    if (existsSync(out) && !force && !only) continue;
    const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
        "User-Agent": "belotche-voices",
      },
      body: ssml(voice, text),
    });
    if (!res.ok) {
      console.error(`${name}/${id}: ${res.status} ${res.statusText} ${await res.text()}`);
      process.exit(1);
    }
    writeFileSync(out, Buffer.from(await res.arrayBuffer()));
    made++;
    console.log(`${name}/${id}.mp3  ${text}`);
  }
}
console.log(made ? `${made} clips recorded.` : "Nothing to record (use --force to redo every clip).");
