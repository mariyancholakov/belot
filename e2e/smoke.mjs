// Plays one full round with four real browsers against a running server.
// Usage: URL=http://localhost:3100 node e2e/smoke.mjs   (SHOTS=<dir> to save screenshots)
import { chromium } from "playwright";

const URL = process.env.URL ?? "http://localhost:3000";
const SHOTS = process.env.SHOTS;
const names = ["Ани", "Борис", "Вили", "Гого"];
const fail = (msg) => {
  console.error("FAIL:", msg);
  process.exit(1);
};

const browser = await chromium.launch();
const errors = [];
const pages = [];
for (const name of names) {
  const ctx = await browser.newContext({ viewport: { width: Number(process.env.W ?? 390), height: Number(process.env.H ?? 780) }, deviceScaleFactor: 2, colorScheme: process.env.THEME ?? "light" });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${name}: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`${name}: ${m.text()}`));
  await page.goto(URL);
  await page.fill("input[autocomplete=nickname]", name);
  pages.push(page);
}

const tag = `${process.env.THEME ?? "light"}-${process.env.W ?? 390}`;
if (SHOTS) await pages[0].screenshot({ path: `${SHOTS}/${tag}-1-home.png` });
await pages[0].getByRole("button", { name: "Нова маса" }).click();
await pages[0].waitForSelector(".room-code");
const code = (await pages[0].textContent(".room-code")).trim();
for (const p of pages.slice(1)) {
  await p.fill("input.code", code);
  await p.getByRole("button", { name: "Влез", exact: true }).click();
  await p.waitForSelector(".room-code");
}
// Lobby grid order is seats 2, 3, 1, 0.
for (const [i, p] of pages.entries()) await p.locator(".lobby-seat").nth([3, 1, 0, 2][i]).click();
if (SHOTS) await pages[0].screenshot({ path: `${SHOTS}/${tag}-2-lobby.png` });
await pages[0].getByRole("button", { name: "Започни играта" }).click();
await pages[0].waitForSelector(".bidding");
// Whoever's turn it is sees the bid buttons; screenshot that player's screen.
const bidder = await Promise.race(pages.map((p) => p.waitForSelector(".bid-grid").then(() => p)));
await bidder.waitForTimeout(700);
if (SHOTS) await bidder.screenshot({ path: `${SHOTS}/${tag}-3-bidding.png` });

let tookContract = false;
let reloaded = false;
let moves = 0;
const deadline = Date.now() + 120_000;
while (Date.now() < deadline) {
  let acted = false;
  for (const p of pages) {
    const hearts = p.locator(".bid:not(:disabled)[aria-label*=\"купа\"]");
    if (!tookContract && (await hearts.count()) > 0) {
      await hearts.first().click();
      tookContract = true;
      acted = true;
      continue;
    }
    const pass = p.locator(".bid:not(:disabled)", { hasText: "Пас" });
    if ((await pass.count()) > 0) {
      await pass.first().click();
      acted = true;
      continue;
    }
    const playable = p.locator(".hand.active button.card:not(:disabled)");
    if ((await playable.count()) > 0) {
      await playable.first().click();
      acted = true;
      moves++;
      if (SHOTS && moves === 5) await pages[1].screenshot({ path: `${SHOTS}/${tag}-4-playing.png` });
      // Reconnect check: a player reloads mid-round and must get the same seat and hand back.
      if (!reloaded && moves === 6) {
        reloaded = true;
        const other = pages[(pages.indexOf(p) + 1) % 4];
        const before = await other.locator(".hand .card").count();
        await other.reload();
        await other.waitForSelector(".hand .card", { timeout: 8000 }).catch(() => fail("reload did not restore the table"));
        const after = await other.locator(".hand .card").count();
        if (after < before - 1) fail(`hand shrank after reload (${before} -> ${after})`);
      }
      continue;
    }
    if ((await p.locator(".modal").count()) > 0) {
      await p.waitForTimeout(700);
      if (SHOTS) await p.screenshot({ path: `${SHOTS}/${tag}-5-round-end.png` });
      const total = await p.locator(".modal .score-row.total b").allTextContents();
      if (total.length !== 2 || total.some((t) => Number.isNaN(Number(t)))) fail(`bad score sheet: ${total}`);
      if (errors.length) fail(errors.join("\n"));
      console.log(`OK: round played in ${moves} card plays, score ${total.join(" : ")}`);
      await browser.close();
      process.exit(0);
    }
  }
  if (!acted) await pages[0].waitForTimeout(150);
}
fail("round did not finish in time");
