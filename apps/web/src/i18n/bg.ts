import type { Contract, Rank, Suit } from "@belot/engine";

/** All user-facing text lives here. */
export const bg = {
  appName: "Белот",
  tagline: "Белот с приятели. Без реклами и регистрация.",
  theme: "Тема",
  themeAuto: "Като системата",
  themeLight: "Светла",
  themeDark: "Тъмна",
  soundOn: "Звукът е включен",
  soundOff: "Звукът е изключен",
  scoreTitle: "Резултат",
  total: "Общо",
  cardPoints: "Точки от карти",
  noRoundsYet: "Още няма изиграни ръце",
  close: "Затвори",
  roundShort: "Ръка",
  nickname: "Твоето име",
  nicknamePlaceholder: "напр. Иван",
  newRoom: "Нова маса",
  joinRoom: "Влез с код",
  roomCode: "Код на масата",
  join: "Влез",
  connecting: "Свързване…",
  reconnecting: "Връзката се прекъсна. Свързваме отново…",
  leave: "Напусни",
  copyLink: "Копирай линка",
  copied: "Копирано",
  shareHint: "Изпрати линка на приятелите си или им кажи кода.",
  takeSeat: "Седни тук",
  freeSeat: "Свободно място",
  you: "ти",
  host: "домакин",
  offline: "няма връзка",
  watching: "Наблюдават",
  start: "Започни играта",
  addBots: "Добави ботове",
  needFour: "Трябват четирима играчи",
  waitHost: "Чакаме домакина да започне",
  teamUs: "Ние",
  teamThem: "Вие",
  partner: "партньор",
  pass: "Пас",
  contra: "Контра",
  recontra: "Реконтра",
  yourTurn: "Твой ред",
  waitingFor: (name: string) => `Чакаме ${name}`,
  bidTitle: "Наддаване",
  noBidsYet: "Още никой не е наддал",
  dealer: "раздава",
  contract: "Игра",
  tricks: "ръце",
  score: "Резултат",
  scoreSheet: "Бележник",
  round: "Ръка",
  nextRound: "Следваща ръка",
  newGame: "Нова игра",
  weWin: "Печелим!",
  theyWin: "Губим",
  gameOver: "Край на играта",
  inside: "Вътре",
  success: "Взето",
  tie: "Равенство — висят точки",
  capo: "Капо",
  hanging: "Висящи",
  lastTrickBonus: "последна ръка +10",
  announcements: "Обявявания",
  belot: "Белот",
  redeal: "Всички пасуваха — раздава се наново",
  error: {
    bad_message: "Невалидно съобщение.",
    no_hello: "Първо въведи име.",
    room_not_found: "Няма такава маса. Провери кода.",
    not_in_room: "Не си на маса.",
    seat_taken: "Мястото е заето.",
    not_seated: "Първо седни на място.",
    not_host: "Само домакинът може да започне играта.",
    need_four_players: "Трябват четирима седнали играчи.",
    game_running: "Играта вече е започнала.",
    illegal_action: "Този ход не е позволен.",
    rate_limited: "Твърде бързо. Опитай пак.",
  } as Record<string, string>,
};

export const suitSymbol: Record<Suit, string> = { clubs: "♣", diamonds: "♦", hearts: "♥", spades: "♠" };
export const suitName: Record<Suit, string> = { clubs: "спатия", diamonds: "каро", hearts: "купа", spades: "пика" };
export const isRed = (suit: Suit) => suit === "hearts" || suit === "diamonds";

export function contractLabel(contract: Contract): string {
  if (contract === "no-trumps") return "Без коз";
  if (contract === "all-trumps") return "Всичко коз";
  return `${suitSymbol[contract]} ${suitName[contract]}`;
}

export const rankLabel: Record<Rank, string> = { "7": "7", "8": "8", "9": "9", "10": "10", J: "В", Q: "Д", K: "К", A: "А" };

export const announcementName: Record<string, string> = {
  terca: "Терца",
  fifty: "Петдесет",
  hundred: "Сто",
  carre: "Каре",
};
