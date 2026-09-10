/** Menü oyunları — dil koduna göre UI metinleri */

export type MenuGameId = 'memory' | 'xox';

export type GamesUiCopy = {
  eyebrow: string;
  title: string;
  close: string;
  games: string;
  gamesPromo: string;
  gamesCta: string;
  memory: { title: string; blurb: string; badge: string };
  xox: { title: string; blurb: string; badge: string };
  moves: string;
  matchPairs: string;
  doneIn: (s: number) => string;
  restart: string;
  card: string;
  table: string;
  you: string;
  connecting: string;
  waiting: string;
  draw: string;
  youWin: string;
  youLose: string;
  yourTurn: string;
  oppTurn: string;
  playAgain: string;
  rejoin: string;
  noTable: string;
  joinFail: string;
  moveFail: string;
  rematchFail: string;
};

const EN: GamesUiCopy = {
  eyebrow: 'While you wait',
  title: 'Games',
  close: 'Close',
  games: 'Games',
  gamesPromo: 'Waiter is on the way — play while you wait.',
  gamesCta: 'Start playing',
  memory: {
    title: 'Memory',
    blurb: 'Match the cards — quick solo play',
    badge: 'Solo',
  },
  xox: {
    title: 'Tic-Tac-Toe',
    blurb: 'Play with someone at your table',
    badge: 'Table',
  },
  moves: 'Moves',
  matchPairs: 'Match the pairs',
  doneIn: (s) => `Done in ${s}s`,
  restart: 'Restart',
  card: 'Card',
  table: 'Table',
  you: 'You',
  connecting: 'Connecting…',
  waiting: 'Waiting for someone at your table…',
  draw: 'Draw!',
  youWin: 'You win!',
  youLose: 'You lost',
  yourTurn: 'Your turn',
  oppTurn: 'Opponent’s turn',
  playAgain: 'Play again',
  rejoin: 'Rejoin',
  noTable: 'Scan the table QR first so we can match you with the same table.',
  joinFail: 'Could not join',
  moveFail: 'Move failed',
  rematchFail: 'Rematch failed',
};

const TR: GamesUiCopy = {
  eyebrow: 'Beklerken',
  title: 'Oyunlar',
  close: 'Kapat',
  games: 'Oyunlar',
  gamesPromo: 'Garson yolda — beklerken oyun oynayabilirsiniz.',
  gamesCta: 'Oyuna başla',
  memory: {
    title: 'Hafıza',
    blurb: 'Kartları eşleştir — hızlı solo oyun',
    badge: 'Solo',
  },
  xox: {
    title: 'XOX',
    blurb: 'Aynı masadaki arkadaşınla oyna',
    badge: 'Masa',
  },
  moves: 'Hamle',
  matchPairs: 'Eşleri bul',
  doneIn: (s) => `${s} sn’de bitti`,
  restart: 'Yeniden',
  card: 'Kart',
  table: 'Masa',
  you: 'Sen',
  connecting: 'Bağlanıyor…',
  waiting: 'Masadaki diğer kişi bekleniyor…',
  draw: 'Berabere!',
  youWin: 'Kazandın!',
  youLose: 'Kaybettin',
  yourTurn: 'Sıra sende',
  oppTurn: 'Rakip oynuyor',
  playAgain: 'Tekrar oyna',
  rejoin: 'Yeniden katıl',
  noTable: 'Aynı masadaki kişiyle eşleşmek için önce masa QR’sini okutun.',
  joinFail: 'Katılınamadı',
  moveFail: 'Hamle olmadı',
  rematchFail: 'Tekrar başlamadı',
};

const RU: GamesUiCopy = {
  ...EN,
  eyebrow: 'Пока ждёте',
  title: 'Игры',
  close: 'Закрыть',
  games: 'Игры',
  gamesPromo: 'Официант уже идёт — поиграйте, пока ждёте.',
  gamesCta: 'Начать игру',
  memory: { title: 'Память', blurb: 'Найди пары — быстрая соло-игра', badge: 'Соло' },
  xox: { title: 'Крестики-нолики', blurb: 'Играйте с кем-то за вашим столом', badge: 'Стол' },
  moves: 'Ходы',
  matchPairs: 'Найди пары',
  doneIn: (s) => `Готово за ${s} с`,
  restart: 'Заново',
  card: 'Карта',
  table: 'Стол',
  you: 'Вы',
  connecting: 'Подключение…',
  waiting: 'Ждём кого-то за вашим столом…',
  draw: 'Ничья!',
  youWin: 'Вы победили!',
  youLose: 'Вы проиграли',
  yourTurn: 'Ваш ход',
  oppTurn: 'Ход соперника',
  playAgain: 'Ещё раз',
  rejoin: 'Войти снова',
  noTable: 'Сначала отсканируйте QR стола, чтобы играть вместе.',
  joinFail: 'Не удалось войти',
  moveFail: 'Ход не выполнен',
  rematchFail: 'Реванш не начался',
};

const DE: GamesUiCopy = {
  ...EN,
  eyebrow: 'Während Sie warten',
  title: 'Spiele',
  close: 'Schließen',
  games: 'Spiele',
  gamesPromo: 'Kellner unterwegs — spielen Sie, während Sie warten.',
  gamesCta: 'Spielen',
  memory: { title: 'Memory', blurb: 'Karten finden — schnelles Solo-Spiel', badge: 'Solo' },
  xox: { title: 'Tic-Tac-Toe', blurb: 'Mit jemandem an Ihrem Tisch spielen', badge: 'Tisch' },
  moves: 'Züge',
  matchPairs: 'Paare finden',
  doneIn: (s) => `Fertig in ${s}s`,
  restart: 'Neu',
  card: 'Karte',
  table: 'Tisch',
  you: 'Du',
  connecting: 'Verbinden…',
  waiting: 'Warte auf jemanden an Ihrem Tisch…',
  draw: 'Unentschieden!',
  youWin: 'Du gewinnst!',
  youLose: 'Du verlierst',
  yourTurn: 'Du bist dran',
  oppTurn: 'Gegner ist dran',
  playAgain: 'Nochmal',
  rejoin: 'Erneut beitreten',
  noTable: 'Scannen Sie zuerst den Tisch-QR, um am gleichen Tisch zu spielen.',
  joinFail: 'Beitritt fehlgeschlagen',
  moveFail: 'Zug fehlgeschlagen',
  rematchFail: 'Neustart fehlgeschlagen',
};

const FR: GamesUiCopy = {
  ...EN,
  eyebrow: 'En attendant',
  title: 'Jeux',
  close: 'Fermer',
  games: 'Jeux',
  gamesPromo: 'Le serveur arrive — jouez en attendant.',
  gamesCta: 'Jouer',
  memory: { title: 'Mémoire', blurb: 'Associez les cartes — solo rapide', badge: 'Solo' },
  xox: { title: 'Morpion', blurb: 'Jouez avec quelqu’un à votre table', badge: 'Table' },
  moves: 'Coups',
  matchPairs: 'Trouvez les paires',
  doneIn: (s) => `Terminé en ${s}s`,
  restart: 'Rejouer',
  card: 'Carte',
  table: 'Table',
  you: 'Vous',
  connecting: 'Connexion…',
  waiting: 'En attente de quelqu’un à votre table…',
  draw: 'Match nul !',
  youWin: 'Vous gagnez !',
  youLose: 'Vous perdez',
  yourTurn: 'À vous',
  oppTurn: 'Au adversaire',
  playAgain: 'Encore',
  rejoin: 'Rejoindre',
  noTable: 'Scannez d’abord le QR de la table pour jouer ensemble.',
  joinFail: 'Impossible de rejoindre',
  moveFail: 'Coup impossible',
  rematchFail: 'Revanche impossible',
};

const ES: GamesUiCopy = {
  ...EN,
  eyebrow: 'Mientras esperas',
  title: 'Juegos',
  close: 'Cerrar',
  games: 'Juegos',
  gamesPromo: 'El camarero viene — juega mientras esperas.',
  gamesCta: 'Jugar',
  memory: { title: 'Memoria', blurb: 'Empareja cartas — juego rápido en solitario', badge: 'Solo' },
  xox: { title: 'Tres en raya', blurb: 'Juega con alguien en tu mesa', badge: 'Mesa' },
  moves: 'Movimientos',
  matchPairs: 'Encuentra las parejas',
  doneIn: (s) => `Listo en ${s}s`,
  restart: 'Reiniciar',
  card: 'Carta',
  table: 'Mesa',
  you: 'Tú',
  connecting: 'Conectando…',
  waiting: 'Esperando a alguien en tu mesa…',
  draw: '¡Empate!',
  youWin: '¡Ganaste!',
  youLose: 'Perdiste',
  yourTurn: 'Tu turno',
  oppTurn: 'Turno rival',
  playAgain: 'Otra vez',
  rejoin: 'Volver a entrar',
  noTable: 'Escanea primero el QR de la mesa para jugar juntos.',
  joinFail: 'No se pudo unir',
  moveFail: 'Jugada fallida',
  rematchFail: 'No se reinició',
};

const AR: GamesUiCopy = {
  ...EN,
  eyebrow: 'أثناء الانتظار',
  title: 'ألعاب',
  close: 'إغلاق',
  games: 'ألعاب',
  gamesPromo: 'النادل في الطريق — العب أثناء الانتظار.',
  gamesCta: 'ابدأ اللعب',
  memory: { title: 'الذاكرة', blurb: 'طابق البطاقات — لعبة فردية سريعة', badge: 'فردي' },
  xox: { title: 'إكس أو', blurb: 'العب مع شخص على طاولتك', badge: 'طاولة' },
  moves: 'حركات',
  matchPairs: 'طابق الأزواج',
  doneIn: (s) => `انتهى خلال ${s} ث`,
  restart: 'إعادة',
  card: 'بطاقة',
  table: 'طاولة',
  you: 'أنت',
  connecting: 'جارٍ الاتصال…',
  waiting: 'بانتظار شخص على طاولتك…',
  draw: 'تعادل!',
  youWin: 'فزت!',
  youLose: 'خسرت',
  yourTurn: 'دورك',
  oppTurn: 'دور الخصم',
  playAgain: 'العب مجدداً',
  rejoin: 'انضم مجدداً',
  noTable: 'امسح رمز الطاولة أولاً للعب معاً.',
  joinFail: 'تعذر الانضمام',
  moveFail: 'فشلت الحركة',
  rematchFail: 'تعذر الإعادة',
};

const IT: GamesUiCopy = {
  ...EN,
  eyebrow: 'Mentre aspetti',
  title: 'Giochi',
  close: 'Chiudi',
  games: 'Giochi',
  gamesPromo: 'Il cameriere sta arrivando — gioca mentre aspetti.',
  gamesCta: 'Gioca',
  memory: { title: 'Memory', blurb: 'Abbina le carte — solo veloce', badge: 'Solo' },
  xox: { title: 'Tris', blurb: 'Gioca con qualcuno al tuo tavolo', badge: 'Tavolo' },
  moves: 'Mosse',
  matchPairs: 'Trova le coppie',
  doneIn: (s) => `Fatto in ${s}s`,
  restart: 'Ricomincia',
  card: 'Carta',
  table: 'Tavolo',
  you: 'Tu',
  connecting: 'Connessione…',
  waiting: 'In attesa di qualcuno al tavolo…',
  draw: 'Pareggio!',
  youWin: 'Hai vinto!',
  youLose: 'Hai perso',
  yourTurn: 'Tocca a te',
  oppTurn: 'Tocca all’avversario',
  playAgain: 'Ancora',
  rejoin: 'Rientra',
  noTable: 'Scansiona prima il QR del tavolo per giocare insieme.',
  joinFail: 'Ingresso non riuscito',
  moveFail: 'Mossa non valida',
  rematchFail: 'Ricomincia fallito',
};

const MAP: Record<string, GamesUiCopy> = {
  tr: TR,
  en: EN,
  ru: RU,
  de: DE,
  fr: FR,
  es: ES,
  ar: AR,
  it: IT,
  nl: { ...EN, title: 'Spellen', games: 'Spellen', close: 'Sluiten', eyebrow: 'Terwijl je wacht', gamesPromo: 'De ober is onderweg — speel terwijl je wacht.', gamesCta: 'Spelen', memory: { title: 'Memory', blurb: 'Match de kaarten — snelle solo', badge: 'Solo' }, xox: { title: 'Boter-kaas-eieren', blurb: 'Speel met iemand aan je tafel', badge: 'Tafel' }, moves: 'Zetten', matchPairs: 'Vind de paren', doneIn: (s) => `Klaar in ${s}s`, restart: 'Opnieuw', card: 'Kaart', table: 'Tafel', you: 'Jij', connecting: 'Verbinden…', waiting: 'Wachten op iemand aan je tafel…', draw: 'Gelijkspel!', youWin: 'Je wint!', youLose: 'Je verliest', yourTurn: 'Jouw beurt', oppTurn: 'Beurt tegenstander', playAgain: 'Nog eens', rejoin: 'Opnieuw meedoen', noTable: 'Scan eerst de tafel-QR om samen te spelen.', joinFail: 'Deelnemen mislukt', moveFail: 'Zet mislukt', rematchFail: 'Herstart mislukt' },
  pt: { ...EN, title: 'Jogos', games: 'Jogos', close: 'Fechar', eyebrow: 'Enquanto espera', gamesPromo: 'O garçom está a caminho — jogue enquanto espera.', gamesCta: 'Jogar', memory: { title: 'Memória', blurb: 'Combine as cartas — solo rápido', badge: 'Solo' }, xox: { title: 'Jogo da velha', blurb: 'Jogue com alguém na sua mesa', badge: 'Mesa' }, moves: 'Jogadas', matchPairs: 'Encontre os pares', doneIn: (s) => `Concluído em ${s}s`, restart: 'Reiniciar', card: 'Carta', table: 'Mesa', you: 'Você', connecting: 'Conectando…', waiting: 'Aguardando alguém na sua mesa…', draw: 'Empate!', youWin: 'Você ganhou!', youLose: 'Você perdeu', yourTurn: 'Sua vez', oppTurn: 'Vez do oponente', playAgain: 'Jogar de novo', rejoin: 'Entrar de novo', noTable: 'Escaneie o QR da mesa primeiro para jogar juntos.', joinFail: 'Não foi possível entrar', moveFail: 'Jogada falhou', rematchFail: 'Revanche falhou' },
  az: { ...TR, title: 'Oyunlar', games: 'Oyunlar', close: 'Bağla', eyebrow: 'Gözləyərkən', gamesPromo: 'Ofisiant yoldadır — gözləyərkən oynaya bilərsiniz.', gamesCta: 'Oyuna başla', memory: { title: 'Yaddaş', blurb: 'Kartları uyğunlaşdır — sürətli solo', badge: 'Solo' }, xox: { title: 'XOX', blurb: 'Masadakı dostunla oyna', badge: 'Masa' }, moves: 'Gediş', matchPairs: 'Cütləri tap', doneIn: (s) => `${s} san-də bitdi`, restart: 'Yenidən', card: 'Kart', table: 'Masa', you: 'Sən', connecting: 'Qoşulur…', waiting: 'Masadakı digər şəxs gözlənilir…', draw: 'Heç-heçə!', youWin: 'Qazandın!', youLose: 'Uduzdun', yourTurn: 'Sıra səndə', oppTurn: 'Rəqib oynayır', playAgain: 'Yenə oyna', rejoin: 'Yenidən qoşul', noTable: 'Birlikdə oynamaq üçün əvvəl masa QR-ini oxudun.', joinFail: 'Qoşulmaq alınmadı', moveFail: 'Gediş olmadı', rematchFail: 'Yenidən başlamadı' },
  uk: { ...RU, title: 'Ігри', games: 'Ігри', close: 'Закрити', eyebrow: 'Поки чекаєте', gamesPromo: 'Офіціант уже йде — пограйте, поки чекаєте.', gamesCta: 'Почати гру', memory: { title: 'Пам’ять', blurb: 'Знайди пари — швидка соло-гра', badge: 'Соло' }, xox: { title: 'Хрестики-нулики', blurb: 'Грайте з кимось за вашим столом', badge: 'Стіл' }, moves: 'Ходи', matchPairs: 'Знайди пари', doneIn: (s) => `Готово за ${s} с`, restart: 'Заново', card: 'Карта', table: 'Стіл', you: 'Ви', connecting: 'Підключення…', waiting: 'Чекаємо когось за вашим столом…', draw: 'Нічия!', youWin: 'Ви перемогли!', youLose: 'Ви програли', yourTurn: 'Ваш хід', oppTurn: 'Хід суперника', playAgain: 'Ще раз', rejoin: 'Увійти знову', noTable: 'Спочатку відскануйте QR столу, щоб грати разом.', joinFail: 'Не вдалося увійти', moveFail: 'Хід не виконано', rematchFail: 'Реванш не почався' },
  zh: { ...EN, title: '游戏', games: '游戏', close: '关闭', eyebrow: '等候时', gamesPromo: '服务员正在赶来 — 等候时可以玩游戏。', gamesCta: '开始游戏', memory: { title: '记忆翻牌', blurb: '配对卡片 — 快速单人游戏', badge: '单人' }, xox: { title: '井字棋', blurb: '与同桌的人一起玩', badge: '餐桌' }, moves: '步数', matchPairs: '找出配对', doneIn: (s) => `${s} 秒完成`, restart: '重来', card: '卡片', table: '桌号', you: '你', connecting: '连接中…', waiting: '等待同桌的人…', draw: '平局！', youWin: '你赢了！', youLose: '你输了', yourTurn: '轮到你', oppTurn: '对方回合', playAgain: '再来一局', rejoin: '重新加入', noTable: '请先扫描餐桌二维码以便同桌对战。', joinFail: '无法加入', moveFail: '落子失败', rematchFail: '无法重开' },
  ja: { ...EN, title: 'ゲーム', games: 'ゲーム', close: '閉じる', eyebrow: '待ち時間に', gamesPromo: 'スタッフが向かっています — 待ち時間にプレイできます。', gamesCta: 'プレイ開始', memory: { title: '神経衰弱', blurb: 'カードを合わせる — クイックソロ', badge: 'ソロ' }, xox: { title: '三目並べ', blurb: '同じテーブルの人とプレイ', badge: 'テーブル' }, moves: '手数', matchPairs: 'ペアを探す', doneIn: (s) => `${s}秒で完了`, restart: 'やり直し', card: 'カード', table: 'テーブル', you: 'あなた', connecting: '接続中…', waiting: 'テーブルの相手を待っています…', draw: '引き分け！', youWin: '勝ち！', youLose: '負け', yourTurn: 'あなたの番', oppTurn: '相手の番', playAgain: 'もう一度', rejoin: '再参加', noTable: '同じテーブルで遊ぶには先にテーブルQRを読み取ってください。', joinFail: '参加できません', moveFail: '手が打てません', rematchFail: '再開できません' },
  ko: { ...EN, title: '게임', games: '게임', close: '닫기', eyebrow: '기다리는 동안', gamesPromo: '직원이 오는 중 — 기다리며 게임을 즐기세요.', gamesCta: '게임 시작', memory: { title: '기억력', blurb: '카드 맞추기 — 빠른 솔로', badge: '솔로' }, xox: { title: '틱택토', blurb: '같은 테이블 사람과 플레이', badge: '테이블' }, moves: '수', matchPairs: '짝 찾기', doneIn: (s) => `${s}초 만에 완료`, restart: '다시', card: '카드', table: '테이블', you: '나', connecting: '연결 중…', waiting: '테이블의 상대를 기다리는 중…', draw: '무승부!', youWin: '승리!', youLose: '패배', yourTurn: '내 차례', oppTurn: '상대 차례', playAgain: '다시 하기', rejoin: '다시 참가', noTable: '함께 하려면 먼저 테이블 QR을 스캔하세요.', joinFail: '참가 실패', moveFail: '수 실패', rematchFail: '재시작 실패' },
  fa: { ...EN, title: 'بازی‌ها', games: 'بازی‌ها', close: 'بستن', eyebrow: 'در حال انتظار', gamesPromo: 'گارسون در راه است — تا رسیدن بازی کنید.', gamesCta: 'شروع بازی', memory: { title: 'حافظه', blurb: 'کارت‌ها را جور کن — بازی تکی سریع', badge: 'تکی' }, xox: { title: 'دوز', blurb: 'با کسی سر میزتان بازی کنید', badge: 'میز' }, moves: 'حرکت', matchPairs: 'جفت‌ها را پیدا کن', doneIn: (s) => `در ${s} ثانیه تمام شد`, restart: 'از نو', card: 'کارت', table: 'میز', you: 'شما', connecting: 'در حال اتصال…', waiting: 'منتظر نفر دیگر سر میز…', draw: 'مساوی!', youWin: 'بردی!', youLose: 'باختی', yourTurn: 'نوبت شما', oppTurn: 'نوبت حریف', playAgain: 'دوباره', rejoin: 'ورود دوباره', noTable: 'برای بازی مشترک ابتدا QR میز را اسکن کنید.', joinFail: 'ورود ممکن نشد', moveFail: 'حرکت انجام نشد', rematchFail: 'شروع مجدد نشد' },
  he: { ...EN, title: 'משחקים', games: 'משחקים', close: 'סגור', eyebrow: 'בזמן ההמתנה', gamesPromo: 'המלצר בדרך — שחקו בזמן ההמתנה.', gamesCta: 'התחל לשחק', memory: { title: 'זיכרון', blurb: 'התאם קלפים — סולו מהיר', badge: 'סולו' }, xox: { title: 'איקס-עיגול', blurb: 'שחקו עם מישהו בשולחן שלכם', badge: 'שולחן' }, moves: 'מהלכים', matchPairs: 'מצאו זוגות', doneIn: (s) => `הסתיים ב-${s} שנ׳`, restart: 'התחל מחדש', card: 'קלף', table: 'שולחן', you: 'אתה', connecting: 'מתחבר…', waiting: 'ממתין למישהו בשולחן…', draw: 'תיקו!', youWin: 'ניצחת!', youLose: 'הפסדת', yourTurn: 'תורך', oppTurn: 'תור היריב', playAgain: 'עוד פעם', rejoin: 'הצטרף שוב', noTable: 'סרקו קודם את ה-QR של השולחן כדי לשחק יחד.', joinFail: 'לא ניתן להצטרף', moveFail: 'מהלך נכשל', rematchFail: 'לא ניתן להתחיל מחדש' },
  el: { ...EN, title: 'Παιχνίδια', games: 'Παιχνίδια', close: 'Κλείσιμο', eyebrow: 'Όσο περιμένετε', gamesPromo: 'Ο σερβιτόρος έρχεται — παίξτε όσο περιμένετε.', gamesCta: 'Παίξε', memory: { title: 'Μνήμη', blurb: 'Ταίριαξε κάρτες — γρήγορο σόλο', badge: 'Σόλο' }, xox: { title: 'Τρίλιζα', blurb: 'Παίξτε με κάποιον στο τραπέζι σας', badge: 'Τραπέζι' }, moves: 'Κινήσεις', matchPairs: 'Βρες τα ζευγάρια', doneIn: (s) => `Έτοιμο σε ${s}δ`, restart: 'Επανεκκίνηση', card: 'Κάρτα', table: 'Τραπέζι', you: 'Εσύ', connecting: 'Σύνδεση…', waiting: 'Αναμονή για κάποιον στο τραπέζι…', draw: 'Ισοπαλία!', youWin: 'Κέρδισες!', youLose: 'Έχασες', yourTurn: 'Η σειρά σου', oppTurn: 'Σειρά αντιπάλου', playAgain: 'Ξανά', rejoin: 'Επανείσοδος', noTable: 'Σαρώστε πρώτα το QR του τραπεζιού για κοινό παιχνίδι.', joinFail: 'Αποτυχία εισόδου', moveFail: 'Αποτυχία κίνησης', rematchFail: 'Αποτυχία επανεκκίνησης' },
  pl: { ...EN, title: 'Gry', games: 'Gry', close: 'Zamknij', eyebrow: 'Podczas oczekiwania', gamesPromo: 'Kelner jest w drodze — graj, czekając.', gamesCta: 'Graj', memory: { title: 'Pamięć', blurb: 'Dopasuj karty — szybka gra solo', badge: 'Solo' }, xox: { title: 'Kółko i krzyżyk', blurb: 'Graj z kimś przy stoliku', badge: 'Stolik' }, moves: 'Ruchy', matchPairs: 'Znajdź pary', doneIn: (s) => `Gotowe w ${s}s`, restart: 'Od nowa', card: 'Karta', table: 'Stolik', you: 'Ty', connecting: 'Łączenie…', waiting: 'Czekamy na kogoś przy stoliku…', draw: 'Remis!', youWin: 'Wygrywasz!', youLose: 'Przegrywasz', yourTurn: 'Twój ruch', oppTurn: 'Ruch przeciwnika', playAgain: 'Jeszcze raz', rejoin: 'Dołącz ponownie', noTable: 'Najpierw zeskanuj QR stolika, by grać razem.', joinFail: 'Nie udało się dołączyć', moveFail: 'Ruch nieudany', rematchFail: 'Restart nieudany' },
  ro: { ...EN, title: 'Jocuri', games: 'Jocuri', close: 'Închide', eyebrow: 'În timp ce aștepți', gamesPromo: 'Chelnerul e pe drum — joacă în timp ce aștepți.', gamesCta: 'Joacă', memory: { title: 'Memorie', blurb: 'Potrivește cărțile — solo rapid', badge: 'Solo' }, xox: { title: 'X și 0', blurb: 'Joacă cu cineva la masa ta', badge: 'Masă' }, moves: 'Mutări', matchPairs: 'Găsește perechile', doneIn: (s) => `Gata în ${s}s`, restart: 'Repornește', card: 'Carte', table: 'Masă', you: 'Tu', connecting: 'Se conectează…', waiting: 'Se așteaptă pe cineva la masă…', draw: 'Egalitate!', youWin: 'Ai câștigat!', youLose: 'Ai pierdut', yourTurn: 'Mutarea ta', oppTurn: 'Mutarea adversarului', playAgain: 'Din nou', rejoin: 'Intră din nou', noTable: 'Scanează mai întâi QR-ul mesei ca să jucați împreună.', joinFail: 'Nu s-a putut intra', moveFail: 'Mutare eșuată', rematchFail: 'Restart eșuat' },
  bg: { ...EN, title: 'Игри', games: 'Игри', close: 'Затвори', eyebrow: 'Докато чакате', gamesPromo: 'Сервитьорът идва — играйте, докато чакате.', gamesCta: 'Играй', memory: { title: 'Памет', blurb: 'Намери двойките — бърза соло игра', badge: 'Соло' }, xox: { title: 'Морски шах', blurb: 'Играйте с някого на вашата маса', badge: 'Маса' }, moves: 'Ходове', matchPairs: 'Намери двойките', doneIn: (s) => `Готово за ${s}с`, restart: 'Отначало', card: 'Карта', table: 'Маса', you: 'Ти', connecting: 'Свързване…', waiting: 'Чакаме някого на масата…', draw: 'Равенство!', youWin: 'Спечели!', youLose: 'Загуби', yourTurn: 'Твой ход', oppTurn: 'Ход на противника', playAgain: 'Отново', rejoin: 'Влез отново', noTable: 'Първо сканирайте QR на масата, за да играете заедно.', joinFail: 'Неуспешно влизане', moveFail: 'Неуспешен ход', rematchFail: 'Рестартът не стартира' },
  hu: { ...EN, title: 'Játékok', games: 'Játékok', close: 'Bezárás', eyebrow: 'Várakozás közben', gamesPromo: 'A pincér úton van — játssz, amíg vársz.', gamesCta: 'Játék indítása', memory: { title: 'Memória', blurb: 'Párosítsd a kártyákat — gyors szóló', badge: 'Szóló' }, xox: { title: 'Amőba', blurb: 'Játssz valakivel az asztalodnál', badge: 'Asztal' }, moves: 'Lépések', matchPairs: 'Találd meg a párokat', doneIn: (s) => `${s} mp alatt kész`, restart: 'Újra', card: 'Kártya', table: 'Asztal', you: 'Te', connecting: 'Csatlakozás…', waiting: 'Várunk valakire az asztalnál…', draw: 'Döntetlen!', youWin: 'Nyertél!', youLose: 'Vesztettél', yourTurn: 'Te jössz', oppTurn: 'Ellenfél jön', playAgain: 'Még egyszer', rejoin: 'Újracsatlakozás', noTable: 'Először olvasd be az asztal QR-kódját a közös játékhoz.', joinFail: 'Csatlakozás sikertelen', moveFail: 'Lépés sikertelen', rematchFail: 'Újraindítás sikertelen' },
  cs: { ...EN, title: 'Hry', games: 'Hry', close: 'Zavřít', eyebrow: 'Mezitím', gamesPromo: 'Číšník je na cestě — hrajte, zatímco čekáte.', gamesCta: 'Hrát', memory: { title: 'Pexeso', blurb: 'Spoj karty — rychlá sólo hra', badge: 'Solo' }, xox: { title: 'Piškvorky', blurb: 'Hrajte s někým u svého stolu', badge: 'Stůl' }, moves: 'Tahy', matchPairs: 'Najdi dvojice', doneIn: (s) => `Hotovo za ${s}s`, restart: 'Znovu', card: 'Karta', table: 'Stůl', you: 'Ty', connecting: 'Připojování…', waiting: 'Čekáme na někoho u stolu…', draw: 'Remíza!', youWin: 'Vyhráváš!', youLose: 'Prohráváš', yourTurn: 'Tvůj tah', oppTurn: 'Tah soupeře', playAgain: 'Ještě jednou', rejoin: 'Připojit znovu', noTable: 'Nejdřív naskenujte QR stolu, abyste hráli spolu.', joinFail: 'Nepodařilo se připojit', moveFail: 'Tah se nepovedl', rematchFail: 'Restart selhal' },
  sv: { ...EN, title: 'Spel', games: 'Spel', close: 'Stäng', eyebrow: 'Medan du väntar', gamesPromo: 'Servitören är på väg — spela medan du väntar.', gamesCta: 'Spela', memory: { title: 'Memory', blurb: 'Matcha korten — snabb solo', badge: 'Solo' }, xox: { title: 'Luffarschack', blurb: 'Spela med någon vid ditt bord', badge: 'Bord' }, moves: 'Drag', matchPairs: 'Hitta paren', doneIn: (s) => `Klar på ${s}s`, restart: 'Omstart', card: 'Kort', table: 'Bord', you: 'Du', connecting: 'Ansluter…', waiting: 'Väntar på någon vid bordet…', draw: 'Oavgjort!', youWin: 'Du vinner!', youLose: 'Du förlorar', yourTurn: 'Din tur', oppTurn: 'Motståndarens tur', playAgain: 'Igen', rejoin: 'Gå med igen', noTable: 'Skanna bordets QR först för att spela tillsammans.', joinFail: 'Kunde inte gå med', moveFail: 'Drag misslyckades', rematchFail: 'Omstart misslyckades' },
  no: { ...EN, title: 'Spill', games: 'Spill', close: 'Lukk', eyebrow: 'Mens du venter', gamesPromo: 'Kelneren er på vei — spill mens du venter.', gamesCta: 'Spill', memory: { title: 'Memory', blurb: 'Match kortene — rask solo', badge: 'Solo' }, xox: { title: 'Tripp trapp tresko', blurb: 'Spill med noen ved bordet ditt', badge: 'Bord' }, moves: 'Trekk', matchPairs: 'Finn parene', doneIn: (s) => `Ferdig på ${s}s`, restart: 'På nytt', card: 'Kort', table: 'Bord', you: 'Deg', connecting: 'Kobler til…', waiting: 'Venter på noen ved bordet…', draw: 'Uavgjort!', youWin: 'Du vant!', youLose: 'Du tapte', yourTurn: 'Din tur', oppTurn: 'Motstanderens tur', playAgain: 'Igjen', rejoin: 'Bli med igjen', noTable: 'Skann bordets QR først for å spille sammen.', joinFail: 'Kunne ikke bli med', moveFail: 'Trekk mislyktes', rematchFail: 'Omstart mislyktes' },
  da: { ...EN, title: 'Spil', games: 'Spil', close: 'Luk', eyebrow: 'Mens du venter', gamesPromo: 'Tjeneren er på vej — spil mens du venter.', gamesCta: 'Spil', memory: { title: 'Memory', blurb: 'Match kortene — hurtig solo', badge: 'Solo' }, xox: { title: 'Kryds og bolle', blurb: 'Spil med nogen ved dit bord', badge: 'Bord' }, moves: 'Træk', matchPairs: 'Find parrene', doneIn: (s) => `Færdig på ${s}s`, restart: 'Forfra', card: 'Kort', table: 'Bord', you: 'Dig', connecting: 'Forbinder…', waiting: 'Venter på nogen ved bordet…', draw: 'Uafgjort!', youWin: 'Du vandt!', youLose: 'Du tabte', yourTurn: 'Din tur', oppTurn: 'Modstanderens tur', playAgain: 'Igen', rejoin: 'Deltag igen', noTable: 'Scan bordets QR først for at spille sammen.', joinFail: 'Kunne ikke deltage', moveFail: 'Træk mislykkedes', rematchFail: 'Genstart mislykkedes' },
  fi: { ...EN, title: 'Pelit', games: 'Pelit', close: 'Sulje', eyebrow: 'Odottessa', gamesPromo: 'Tarjoilija on tulossa — pelaa odottaessasi.', gamesCta: 'Pelaa', memory: { title: 'Muisti', blurb: 'Yhdistä kortit — nopea solo', badge: 'Solo' }, xox: { title: 'Ristinolla', blurb: 'Pelaa pöytäkaverisi kanssa', badge: 'Pöytä' }, moves: 'Siirrot', matchPairs: 'Löydä parit', doneIn: (s) => `Valmis ${s}s`, restart: 'Uudelleen', card: 'Kortti', table: 'Pöytä', you: 'Sinä', connecting: 'Yhdistetään…', waiting: 'Odotetaan jotakuta pöydässä…', draw: 'Tasapeli!', youWin: 'Voitit!', youLose: 'Hävisit', yourTurn: 'Sinun vuorosi', oppTurn: 'Vastustajan vuoro', playAgain: 'Uudestaan', rejoin: 'Liity uudelleen', noTable: 'Skannaa ensin pöydän QR pelataksesi yhdessä.', joinFail: 'Liittyminen epäonnistui', moveFail: 'Siirto epäonnistui', rematchFail: 'Uudelleenkäynnistys epäonnistui' },
  hi: { ...EN, title: 'खेल', games: 'खेल', close: 'बंद', eyebrow: 'इंतज़ार में', gamesPromo: 'वेटर आ रहा है — इंतज़ार करते हुए खेलें।', gamesCta: 'खेल शुरू', memory: { title: 'मेमोरी', blurb: 'कार्ड मिलाएँ — तेज़ सोलो', badge: 'सोलो' }, xox: { title: 'टिक-टैक-टो', blurb: 'अपनी टेबल पर किसी के साथ खेलें', badge: 'टेबल' }, moves: 'चालें', matchPairs: 'जोड़े ढूँढें', doneIn: (s) => `${s} सेकंड में पूरा`, restart: 'फिर से', card: 'कार्ड', table: 'टेबल', you: 'आप', connecting: 'कनेक्ट हो रहा है…', waiting: 'टेबल पर किसी का इंतज़ार…', draw: 'ड्रॉ!', youWin: 'आप जीते!', youLose: 'आप हारे', yourTurn: 'आपकी बारी', oppTurn: 'विरोधी की बारी', playAgain: 'फिर खेलें', rejoin: 'फिर शामिल हों', noTable: 'साथ खेलने के लिए पहले टेबल QR स्कैन करें।', joinFail: 'शामिल नहीं हो सके', moveFail: 'चाल असफल', rematchFail: 'रीस्टार्ट असफल' },
  th: { ...EN, title: 'เกม', games: 'เกม', close: 'ปิด', eyebrow: 'ระหว่างรอ', gamesPromo: 'พนักงานกำลังมา — เล่นเกมระหว่างรอได้', gamesCta: 'เริ่มเล่น', memory: { title: 'จับคู่', blurb: 'จับคู่การ์ด — โซโล่เร็ว', badge: 'โซโล่' }, xox: { title: 'โอเอกซ์', blurb: 'เล่นกับคนที่โต๊ะเดียวกัน', badge: 'โต๊ะ' }, moves: 'ตา', matchPairs: 'หาคู่ให้เจอ', doneIn: (s) => `เสร็จใน ${s} วิ`, restart: 'เริ่มใหม่', card: 'การ์ด', table: 'โต๊ะ', you: 'คุณ', connecting: 'กำลังเชื่อมต่อ…', waiting: 'รอคนที่โต๊ะ…', draw: 'เสมอ!', youWin: 'คุณชนะ!', youLose: 'คุณแพ้', yourTurn: 'ตาคุณ', oppTurn: 'ตาฝ่ายตรงข้าม', playAgain: 'เล่นอีก', rejoin: 'เข้าใหม่', noTable: 'สแกน QR โต๊ะก่อนเพื่อเล่นด้วยกัน', joinFail: 'เข้าร่วมไม่ได้', moveFail: 'เดินไม่ได้', rematchFail: 'เริ่มใหม่ไม่ได้' },
  vi: { ...EN, title: 'Trò chơi', games: 'Trò chơi', close: 'Đóng', eyebrow: 'Trong lúc chờ', gamesPromo: 'Nhân viên đang tới — chơi trong lúc chờ.', gamesCta: 'Bắt đầu chơi', memory: { title: 'Trí nhớ', blurb: 'Ghép thẻ — solo nhanh', badge: 'Solo' }, xox: { title: 'Cờ caro', blurb: 'Chơi với người cùng bàn', badge: 'Bàn' }, moves: 'Nước', matchPairs: 'Tìm các cặp', doneIn: (s) => `Xong trong ${s}s`, restart: 'Chơi lại', card: 'Thẻ', table: 'Bàn', you: 'Bạn', connecting: 'Đang kết nối…', waiting: 'Đang chờ người cùng bàn…', draw: 'Hòa!', youWin: 'Bạn thắng!', youLose: 'Bạn thua', yourTurn: 'Lượt bạn', oppTurn: 'Lượt đối thủ', playAgain: 'Chơi tiếp', rejoin: 'Vào lại', noTable: 'Hãy quét QR bàn trước để chơi cùng nhau.', joinFail: 'Không vào được', moveFail: 'Nước đi thất bại', rematchFail: 'Không khởi động lại được' },
};

export function gamesUi(lang: string): GamesUiCopy {
  const code = (lang || 'tr').split('-')[0].toLowerCase();
  return MAP[code] || EN;
}

export function gameCatalogEntry(id: MenuGameId, lang: string) {
  const ui = gamesUi(lang);
  return id === 'memory' ? ui.memory : ui.xox;
}
