import { chromium } from "playwright";

const SHOTS = process.env.SHOTS ?? "/private/tmp/claude-501/-Users-mariyancholakov-Developer-projects/fefee52f-3821-4f50-a920-cab1d8eae8ae/scratchpad";
const URL = process.env.URL ?? "http://localhost:5173";
const browser = await chromium.launch();
const names = ["Ани", "Борис", "Вили", "Гого"];
const pages = [];
for (const name of names) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", name, e.message));
  page.on("console", (m) => m.type() === "error" && console.log("CONSOLE", name, m.text()));
  await page.goto(URL);
  await page.fill("input[autocomplete=nickname]", name);
  pages.push(page);
}
await pages[0].screenshot({ path: `${SHOTS}/01-home.png` });
await pages[0].getByRole("button", { name: "Нова маса" }).click();
await pages[0].waitForSelector(".room-code");
const code = (await pages[0].textContent(".room-code")).trim();
console.log("code", code);
for (const p of pages.slice(1)) {
  await p.fill("input.code", code);
  await p.getByRole("button", { name: "Влез", exact: true }).click();
  await p.waitForSelector(".room-code");
}
for (const [i, p] of pages.entries()) {
  await p.locator(".lobby-seat").nth([3, 1, 0, 2][i]).click(); // seat i -> grid order top,left,right,bottom = seats 2,3,1,0
}
await pages[0].waitForTimeout(500);
await pages[0].screenshot({ path: `${SHOTS}/02-lobby.png` });
await pages[0].getByRole("button", { name: "Започни играта" }).click();
await pages[0].waitForSelector(".bidding");
await pages[0].waitForTimeout(400);
await pages[1].screenshot({ path: `${SHOTS}/03-bidding-turn.png` });
await pages[0].screenshot({ path: `${SHOTS}/03b-bidding-wait.png` });
await browser.close();
