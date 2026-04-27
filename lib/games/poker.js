'use strict';

// ─── Texas Hold'em Poker Engine ──────────────────────────
// Server-authoritative. All deck operations happen here.
// State is serialized to boardState JSON in db.games.

const SUITS = ['s', 'h', 'd', 'c']; // spades hearts diamonds clubs
const RANKS = ['2','3','4','5','6','7','8','9','T','J','Q','K','A'];
const RANK_VAL = {};
RANKS.forEach((r, i) => { RANK_VAL[r] = i + 2; });

const HAND_RANK = {
  HIGH_CARD: 1, ONE_PAIR: 2, TWO_PAIR: 3, THREE_OF_A_KIND: 4,
  STRAIGHT: 5, FLUSH: 6, FULL_HOUSE: 7, FOUR_OF_A_KIND: 8, STRAIGHT_FLUSH: 9, ROYAL_FLUSH: 10,
};

function makeDeck() {
  const deck = [];
  for (const suit of SUITS) for (const rank of RANKS) deck.push(rank + suit);
  return deck;
}

function shuffle(deck) {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

function cardRank(card) { return card[0]; }
function cardSuit(card) { return card[1]; }
function cardVal(card) { return RANK_VAL[cardRank(card)]; }

function evaluateHand(cards) {
  // cards: array of 5-7 card strings, returns best 5-card evaluation
  if (cards.length < 5) return { rank: HAND_RANK.HIGH_CARD, label: 'High Card', best: cards };
  const combos = cards.length === 5 ? [cards] : choose5(cards);
  let best = null;
  for (const combo of combos) {
    const ev = evaluate5(combo);
    if (!best || ev.rank > best.rank || (ev.rank === best.rank && compareKickers(ev.kickers, best.kickers) > 0)) {
      best = ev;
    }
  }
  return best;
}

function choose5(arr) {
  const result = [];
  const n = arr.length;
  for (let a = 0; a < n - 4; a++)
    for (let b = a+1; b < n - 3; b++)
      for (let c = b+1; c < n - 2; c++)
        for (let d = c+1; d < n - 1; d++)
          for (let e = d+1; e < n; e++)
            result.push([arr[a], arr[b], arr[c], arr[d], arr[e]]);
  return result;
}

function evaluate5(cards) {
  const vals = cards.map(cardVal).sort((a, b) => b - a);
  const suits = cards.map(cardSuit);
  const isFlush = suits.every(s => s === suits[0]);
  const isStraight = checkStraight(vals);
  const counts = {};
  for (const v of vals) counts[v] = (counts[v] || 0) + 1;
  const groups = Object.entries(counts).sort((a, b) => b[1] - a[1] || b[0] - a[0]);

  let rank, label, kickers = vals;

  if (isFlush && isStraight) {
    rank = vals[0] === 14 && vals[1] === 13 ? HAND_RANK.ROYAL_FLUSH : HAND_RANK.STRAIGHT_FLUSH;
    label = rank === HAND_RANK.ROYAL_FLUSH ? 'Royal Flush' : 'Straight Flush';
    kickers = [isStraight];
  } else if (groups[0][1] === 4) {
    rank = HAND_RANK.FOUR_OF_A_KIND; label = 'Four of a Kind';
    kickers = [parseInt(groups[0][0]), parseInt(groups[1][0])];
  } else if (groups[0][1] === 3 && groups[1][1] === 2) {
    rank = HAND_RANK.FULL_HOUSE; label = 'Full House';
    kickers = [parseInt(groups[0][0]), parseInt(groups[1][0])];
  } else if (isFlush) {
    rank = HAND_RANK.FLUSH; label = 'Flush'; kickers = vals;
  } else if (isStraight) {
    rank = HAND_RANK.STRAIGHT; label = 'Straight'; kickers = [isStraight];
  } else if (groups[0][1] === 3) {
    rank = HAND_RANK.THREE_OF_A_KIND; label = 'Three of a Kind';
    kickers = [parseInt(groups[0][0]), ...vals.filter(v => v !== parseInt(groups[0][0]))];
  } else if (groups[0][1] === 2 && groups[1][1] === 2) {
    rank = HAND_RANK.TWO_PAIR; label = 'Two Pair';
    kickers = [Math.max(parseInt(groups[0][0]), parseInt(groups[1][0])),
                Math.min(parseInt(groups[0][0]), parseInt(groups[1][0])),
                ...vals.filter(v => v !== parseInt(groups[0][0]) && v !== parseInt(groups[1][0]))];
  } else if (groups[0][1] === 2) {
    rank = HAND_RANK.ONE_PAIR; label = 'One Pair';
    kickers = [parseInt(groups[0][0]), ...vals.filter(v => v !== parseInt(groups[0][0]))];
  } else {
    rank = HAND_RANK.HIGH_CARD; label = 'High Card'; kickers = vals;
  }

  return { rank, label, kickers, cards };
}

function checkStraight(sortedVals) {
  // Also handle A-2-3-4-5 (wheel)
  const uniq = [...new Set(sortedVals)];
  if (uniq.length < 5) return false;
  // Normal
  if (uniq[0] - uniq[4] === 4) return uniq[0];
  // Wheel: A-2-3-4-5
  if (uniq[0] === 14 && uniq[1] === 5 && uniq[2] === 4 && uniq[3] === 3 && uniq[4] === 2) return 5;
  return false;
}

function compareKickers(a, b) {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

// ─── Game State Machine ───────────────────────────────────

const STAGE = { PREFLOP: 0, FLOP: 1, TURN: 2, RIVER: 3, SHOWDOWN: 4 };
const STAGE_NAME = ['preflop', 'flop', 'turn', 'river', 'showdown'];

function createPokerState(players, stakeKas, options = {}) {
  // players: [{ addr, name }]
  const ante = options.ante || 0;
  const smallBlind = options.smallBlind || Math.max(1, Math.floor(stakeKas * 0.05));
  const bigBlind = smallBlind * 2;
  const startingChips = options.startingChips || Math.floor(stakeKas * 10); // 10x buy-in in chips
  const deck = shuffle(makeDeck());

  const playerStates = players.map((p, i) => ({
    addr: p.addr,
    name: p.name || 'Player ' + (i + 1),
    chips: startingChips,
    holeCards: [deck.pop(), deck.pop()],
    bet: 0,
    totalBet: 0,
    folded: false,
    allIn: false,
    isDealer: i === 0,
    isSB: i === (players.length === 2 ? 0 : 1),
    isBB: i === (players.length === 2 ? 1 : 2 % players.length),
    handRank: null,
  }));

  // Post blinds
  const sbIdx = players.length === 2 ? 0 : 1;
  const bbIdx = players.length === 2 ? 1 : 2 % players.length;
  playerStates[sbIdx].chips -= smallBlind;
  playerStates[sbIdx].bet = smallBlind;
  playerStates[sbIdx].totalBet = smallBlind;
  playerStates[bbIdx].chips -= bigBlind;
  playerStates[bbIdx].bet = bigBlind;
  playerStates[bbIdx].totalBet = bigBlind;

  // UTG acts first preflop
  const firstToAct = (bbIdx + 1) % players.length;

  return {
    stage: STAGE.PREFLOP,
    stageName: 'preflop',
    deck,  // remaining deck (server-only; strip before sending to clients)
    community: [],
    pot: smallBlind + bigBlind,
    currentBet: bigBlind,
    minRaise: bigBlind,
    players: playerStates,
    activePlayerIdx: firstToAct,
    dealerIdx: 0,
    sbIdx,
    bbIdx,
    smallBlind,
    bigBlind,
    lastRaiserIdx: bbIdx,
    actedThisRound: new Array(players.length).fill(false),
    handNumber: 1,
    winner: null,
    winReason: null,
    finished: false,
  };
}

function getPublicState(state, viewerAddr) {
  // Strip hole cards from opponents
  return {
    ...state,
    deck: undefined,
    players: state.players.map(p => ({
      ...p,
      holeCards: (p.addr === viewerAddr || state.stage === STAGE.SHOWDOWN) ? p.holeCards : p.holeCards.map(() => 'back'),
    })),
  };
}

function applyAction(state, playerAddr, action, amount) {
  const idx = state.players.findIndex(p => p.addr === playerAddr);
  if (idx === -1) return { error: 'Player not found' };
  if (idx !== state.activePlayerIdx) return { error: 'Not your turn' };
  const player = state.players[idx];
  if (player.folded) return { error: 'Already folded' };

  const s = JSON.parse(JSON.stringify(state)); // deep clone
  const p = s.players[idx];

  switch (action) {
    case 'fold':
      p.folded = true;
      s.actedThisRound[idx] = true;
      break;

    case 'check':
      if (s.currentBet > p.bet) return { error: 'Cannot check, must call or raise' };
      s.actedThisRound[idx] = true;
      p.bet = 0;
      break;

    case 'call': {
      const callAmount = Math.min(s.currentBet - p.bet, p.chips);
      p.chips -= callAmount;
      p.totalBet += callAmount;
      s.pot += callAmount;
      if (p.chips === 0) p.allIn = true;
      s.actedThisRound[idx] = true;
      p.bet = s.currentBet;
      break;
    }

    case 'raise': {
      if (!amount || amount < s.minRaise) return { error: 'Raise must be at least ' + s.minRaise };
      const toCall = s.currentBet - p.bet;
      const total = toCall + amount;
      if (total > p.chips) return { error: 'Not enough chips' };
      p.chips -= total;
      p.totalBet += total;
      s.pot += total;
      s.currentBet += amount;
      s.minRaise = amount;
      s.lastRaiserIdx = idx;
      s.actedThisRound = new Array(s.players.length).fill(false);
      s.actedThisRound[idx] = true;
      p.bet = s.currentBet;
      if (p.chips === 0) p.allIn = true;
      break;
    }

    case 'allin': {
      const allInAmount = p.chips;
      p.totalBet += allInAmount;
      s.pot += allInAmount;
      if (allInAmount + p.bet > s.currentBet) {
        s.currentBet = allInAmount + p.bet;
        s.lastRaiserIdx = idx;
        s.actedThisRound = new Array(s.players.length).fill(false);
      }
      p.bet = s.currentBet;
      p.chips = 0;
      p.allIn = true;
      s.actedThisRound[idx] = true;
      break;
    }

    default:
      return { error: 'Unknown action: ' + action };
  }

  // Check if round is over
  const activePlayers = s.players.filter(p => !p.folded && !p.allIn);
  const foldedCount = s.players.filter(p => p.folded).length;

  // Everyone folded except one
  if (foldedCount === s.players.length - 1) {
    const winner = s.players.find(p => !p.folded);
    winner.chips += s.pot;
    s.winner = winner.addr;
    s.winReason = 'fold';
    s.finished = true;
    s.deck = undefined;
    return { state: s, finished: true, winner: winner.addr, reason: 'fold' };
  }

  // Advance to next active player
  let next = (idx + 1) % s.players.length;
  while (s.players[next].folded || s.players[next].allIn) {
    next = (next + 1) % s.players.length;
    if (next === idx) break;
  }

  // Check if betting round is complete
  const roundDone = isBettingRoundDone(s);
  if (roundDone) {
    return advanceStage(s);
  }

  s.activePlayerIdx = next;
  s.deck = undefined; // never serialize deck to client
  return { state: s };
}

function isBettingRoundDone(state) {
  const active = state.players.filter(p => !p.folded && !p.allIn);
  if (active.length === 0) return true;
  // All active players have acted and bets are equal
  return active.every((p, i) => {
    const idx = state.players.indexOf(p);
    return state.actedThisRound[idx] && p.bet === state.currentBet;
  });
}

function advanceStage(state) {
  const s = state;
  // Reset bets
  s.players.forEach(p => { p.bet = 0; });
  s.currentBet = 0;
  s.minRaise = s.bigBlind;
  s.actedThisRound = new Array(s.players.length).fill(false);
  s.lastRaiserIdx = -1;

  if (s.stage === STAGE.PREFLOP) {
    // Deal flop: need deck — but deck was stripped. Re-attach from stored state if needed.
    // In practice the server reconstructs from the stored deck.
    s.stage = STAGE.FLOP;
    s.stageName = 'flop';
    s.community.push(s._deck?.pop() || 'Xs', s._deck?.pop() || 'Xs', s._deck?.pop() || 'Xs');
  } else if (s.stage === STAGE.FLOP) {
    s.stage = STAGE.TURN;
    s.stageName = 'turn';
    s.community.push(s._deck?.pop() || 'Xs');
  } else if (s.stage === STAGE.TURN) {
    s.stage = STAGE.RIVER;
    s.stageName = 'river';
    s.community.push(s._deck?.pop() || 'Xs');
  } else if (s.stage === STAGE.RIVER) {
    return goToShowdown(s);
  }

  // First to act after dealer (skip folded/allIn)
  let next = (s.dealerIdx + 1) % s.players.length;
  while (s.players[next].folded || s.players[next].allIn) {
    next = (next + 1) % s.players.length;
  }
  s.activePlayerIdx = next;
  s.deck = undefined;
  return { state: s };
}

function goToShowdown(state) {
  const s = state;
  s.stage = STAGE.SHOWDOWN;
  s.stageName = 'showdown';

  const activePlayers = s.players.filter(p => !p.folded);
  for (const p of activePlayers) {
    const allCards = [...p.holeCards, ...s.community];
    p.handRank = evaluateHand(allCards);
  }

  activePlayers.sort((a, b) => {
    if (a.handRank.rank !== b.handRank.rank) return b.handRank.rank - a.handRank.rank;
    return compareKickers(b.handRank.kickers, a.handRank.kickers);
  });

  const winner = activePlayers[0];
  const isTie = activePlayers.length > 1 &&
    activePlayers[1].handRank.rank === winner.handRank.rank &&
    compareKickers(activePlayers[1].handRank.kickers, winner.handRank.kickers) === 0;

  if (isTie) {
    const splitPot = Math.floor(s.pot / activePlayers.length);
    activePlayers.forEach(p => { const orig = s.players.find(x => x.addr === p.addr); orig.chips += splitPot; });
    s.winner = 'draw';
    s.winReason = 'split pot';
  } else {
    const winnerOrig = s.players.find(p => p.addr === winner.addr);
    winnerOrig.chips += s.pot;
    s.winner = winner.addr;
    s.winReason = winner.handRank.label;
  }

  s.finished = true;
  s.deck = undefined;
  return { state: s, finished: true, winner: s.winner, reason: s.winReason };
}

// ─── Server-side state manager (keeps deck private) ───────
class PokerEngine {
  constructor() {
    this.games = new Map(); // gameId -> { state, deck }
  }

  startGame(gameId, players, stakeKas, options) {
    const state = createPokerState(players, stakeKas, options);
    const deck = state.deck;
    state._deck = deck; // keep deck reference
    this.games.set(gameId, { state, deck });
    return this.getPublicState(gameId);
  }

  applyAction(gameId, playerAddr, action, amount) {
    const entry = this.games.get(gameId);
    if (!entry) return { error: 'Game not found' };
    const result = applyAction(entry.state, playerAddr, action, amount);
    if (result.error) return result;
    // Restore deck on state for continued play
    result.state._deck = entry.deck;
    entry.state = result.state;
    return result;
  }

  getPublicState(gameId, viewerAddr) {
    const entry = this.games.get(gameId);
    if (!entry) return null;
    return getPublicState(entry.state, viewerAddr);
  }

  dealNextStreet(gameId) {
    const entry = this.games.get(gameId);
    if (!entry) return { error: 'Game not found' };
    const s = entry.state;
    // Pop from the stored deck
    if (s.stage === STAGE.PREFLOP) {
      entry.deck.pop(); // burn
      s.community.push(entry.deck.pop(), entry.deck.pop(), entry.deck.pop());
      s.stage = STAGE.FLOP; s.stageName = 'flop';
    } else if (s.stage === STAGE.FLOP) {
      entry.deck.pop(); // burn
      s.community.push(entry.deck.pop());
      s.stage = STAGE.TURN; s.stageName = 'turn';
    } else if (s.stage === STAGE.RIVER) {
      entry.deck.pop(); // burn
      s.community.push(entry.deck.pop());
      s.stage = STAGE.RIVER; s.stageName = 'river';
    }
    return this.getPublicState(gameId);
  }

  endGame(gameId) {
    this.games.delete(gameId);
  }
}

module.exports = {
  PokerEngine,
  createPokerState,
  applyAction,
  evaluateHand,
  getPublicState,
  STAGE,
  HAND_RANK,
  RANKS,
  SUITS,
};
