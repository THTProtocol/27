'use strict';

// ─── Blackjack Engine ────────────────────────────────────
// Server-authoritative multi-deck blackjack.
// 1-7 players vs. house (dealer).
// Supports: hit, stand, double-down, split (same-rank pairs), insurance.
// State is serialized to db.games boardState.

const SUITS = ['s', 'h', 'd', 'c'];
const RANKS = ['A','2','3','4','5','6','7','8','9','T','J','Q','K'];

function makeShoe(numDecks = 6) {
  const cards = [];
  for (let d = 0; d < numDecks; d++)
    for (const suit of SUITS)
      for (const rank of RANKS)
        cards.push(rank + suit);
  return cards;
}

function shuffle(deck) {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

function cardValue(card) {
  const rank = card[0];
  if (rank === 'A') return 11;
  if (['T','J','Q','K'].includes(rank)) return 10;
  return parseInt(rank);
}

function handTotal(hand) {
  let total = 0, aces = 0;
  for (const card of hand) {
    if (card === 'back') continue;
    const v = cardValue(card);
    total += v;
    if (card[0] === 'A') aces++;
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

function isBust(hand) { return handTotal(hand) > 21; }
function isBlackjack(hand) { return hand.length === 2 && handTotal(hand) === 21; }
function isSoft(hand) {
  const rank1 = hand.some(c => c[0] === 'A');
  if (!rank1) return false;
  const hard = hand.reduce((sum, c) => sum + (c[0] === 'A' ? 1 : cardValue(c)), 0);
  return hard + 10 <= 21;
}

// ─── Game Creation ──────────────────────────────────

/**
 * createBlackjackState
 * players: [{ addr, betSompi }]
 * options: { numDecks, allowSplit, allowDouble, allowInsurance, dealerHitsSoft17 }
 */
function createBlackjackState(players, stakeKas, options = {}) {
  const numDecks = options.numDecks || 6;
  const shoe = shuffle(makeShoe(numDecks));
  const startingChips = options.startingChips || Math.floor(stakeKas * 10);
  const defaultBet = options.defaultBet || Math.floor(startingChips * 0.1);

  const playerStates = players.map((p, i) => ({
    addr: p.addr,
    name: p.name || 'Player ' + (i + 1),
    chips: startingChips,
    hands: [{ cards: [], bet: defaultBet, doubled: false, split: false, done: false, result: null }],
    activeHandIdx: 0,
    insurance: 0,
    insurancePaid: false,
    done: false,
  }));

  // Deal initial cards: player1 c1, dealer c1, player1 c2, dealer c2 (hole)
  const dealerHand = [];
  for (const p of playerStates) p.hands[0].cards.push(shoe.pop());
  dealerHand.push(shoe.pop());
  for (const p of playerStates) p.hands[0].cards.push(shoe.pop());
  const dealerHole = shoe.pop(); // face-down
  dealerHand.push('back'); // placeholder shown to players

  return {
    phase: 'betting',   // betting | player-turn | dealer-turn | payout
    shoe,
    shoeSize: numDecks * 52,
    reshuffleAt: Math.floor(numDecks * 52 * 0.25), // reshuffle at 25% remaining
    dealerHand,
    dealerHole,
    dealerHandFull: null, // revealed at dealer-turn
    players: playerStates,
    activePlayerIdx: 0,
    options: {
      allowSplit: options.allowSplit !== false,
      allowDouble: options.allowDouble !== false,
      allowInsurance: options.allowInsurance !== false,
      dealerHitsSoft17: options.dealerHitsSoft17 !== false,
      blackjackPays: options.blackjackPays || 1.5, // 3:2
    },
    roundNumber: 1,
    finished: false,
    results: null,
  };
}

// ─── Public State (hides dealer hole card & shoe) ──────────

function getPublicState(state) {
  const { shoe, dealerHole, ...pub } = state;
  pub.shoeRemaining = shoe ? shoe.length : 0;
  return pub;
}

// ─── Action Application ───────────────────────────────

function applyAction(state, playerAddr, action, amount) {
  const idx = state.players.findIndex(p => p.addr === playerAddr);
  if (idx === -1) return { error: 'Player not found' };
  if (idx !== state.activePlayerIdx) return { error: 'Not your turn' };
  if (state.phase !== 'player-turn') return { error: 'Not player turn phase' };

  const s = JSON.parse(JSON.stringify(state));
  const player = s.players[idx];
  const hand = player.hands[player.activeHandIdx];

  switch (action) {
    case 'hit': {
      hand.cards.push(s.shoe.pop());
      if (isBust(hand.cards)) {
        hand.done = true;
        hand.result = 'bust';
        return advancePlayerTurn(s);
      }
      if (handTotal(hand.cards) === 21) {
        hand.done = true;
        return advancePlayerTurn(s);
      }
      break;
    }

    case 'stand': {
      hand.done = true;
      return advancePlayerTurn(s);
    }

    case 'double': {
      if (!s.options.allowDouble) return { error: 'Double not allowed' };
      if (hand.cards.length !== 2) return { error: 'Can only double on first two cards' };
      if (player.chips < hand.bet) return { error: 'Not enough chips to double' };
      player.chips -= hand.bet;
      hand.bet *= 2;
      hand.doubled = true;
      hand.cards.push(s.shoe.pop());
      hand.done = true;
      return advancePlayerTurn(s);
    }

    case 'split': {
      if (!s.options.allowSplit) return { error: 'Split not allowed' };
      if (hand.cards.length !== 2) return { error: 'Can only split two cards' };
      if (cardValue(hand.cards[0]) !== cardValue(hand.cards[1])) return { error: 'Cards must be same value to split' };
      if (player.chips < hand.bet) return { error: 'Not enough chips to split' };
      player.chips -= hand.bet;
      const splitCard = hand.cards.pop();
      hand.split = true;
      hand.cards.push(s.shoe.pop()); // re-fill first hand
      player.hands.push({
        cards: [splitCard, s.shoe.pop()],
        bet: hand.bet, doubled: false, split: true, done: false, result: null,
      });
      break;
    }

    case 'insurance': {
      if (!s.options.allowInsurance) return { error: 'Insurance not allowed' };
      if (s.dealerHand[0]?.[0] !== 'A') return { error: 'Insurance only available when dealer shows Ace' };
      if (player.insurancePaid) return { error: 'Insurance already taken' };
      const insBet = Math.floor(hand.bet / 2);
      if (player.chips < insBet) return { error: 'Not enough chips for insurance' };
      player.chips -= insBet;
      player.insurance = insBet;
      player.insurancePaid = true;
      break;
    }

    default:
      return { error: 'Unknown action: ' + action };
  }

  return { state: s };
}

function advancePlayerTurn(state) {
  const s = state;
  const player = s.players[s.activePlayerIdx];

  // Check if current player has more hands (split)
  if (player.activeHandIdx < player.hands.length - 1) {
    player.activeHandIdx++;
    return { state: s };
  }

  player.done = true;

  // Move to next player
  let next = s.activePlayerIdx + 1;
  while (next < s.players.length && s.players[next].done) next++;

  if (next >= s.players.length) {
    // All players done, dealer's turn
    return dealerPlay(s);
  }

  s.activePlayerIdx = next;
  return { state: s };
}

function dealerPlay(state) {
  const s = state;
  s.phase = 'dealer-turn';

  // Reveal hole card
  s.dealerHandFull = [...s.dealerHand];
  s.dealerHandFull[1] = s.dealerHole;
  s.dealerHand = s.dealerHandFull;

  // Dealer hits until >= 17 (or soft 17 if dealerHitsSoft17)
  while (true) {
    const total = handTotal(s.dealerHand);
    if (total > 21) break; // bust
    if (total > 17) break;
    if (total === 17) {
      if (!s.options.dealerHitsSoft17) break;
      if (!isSoft(s.dealerHand)) break;
    }
    s.dealerHand.push(s.shoe.pop());
  }

  return payout(s);
}

function payout(state) {
  const s = state;
  s.phase = 'payout';
  const dealerTotal = handTotal(s.dealerHand);
  const dealerBust = dealerTotal > 21;
  const dealerBJ = isBlackjack(s.dealerHand);

  const results = [];

  for (const player of s.players) {
    const playerResult = { addr: player.addr, hands: [], netChips: 0 };

    // Insurance payout
    if (player.insurancePaid) {
      if (dealerBJ) {
        player.chips += player.insurance * 3; // 2:1 payout
        playerResult.netChips += player.insurance * 2;
      }
    }

    for (const hand of player.hands) {
      const playerTotal = handTotal(hand.cards);
      const playerBJ = isBlackjack(hand.cards) && !hand.split; // no BJ on split
      let result, chips = 0;

      if (hand.result === 'bust') {
        result = 'bust'; chips = -hand.bet;
      } else if (playerBJ && dealerBJ) {
        result = 'push'; chips = 0;
        player.chips += hand.bet; // return bet
      } else if (playerBJ) {
        result = 'blackjack';
        chips = Math.floor(hand.bet * s.options.blackjackPays);
        player.chips += hand.bet + chips;
      } else if (dealerBJ) {
        result = 'lose'; chips = -hand.bet;
      } else if (dealerBust) {
        result = 'win'; chips = hand.bet;
        player.chips += hand.bet * 2;
      } else if (playerTotal > dealerTotal) {
        result = 'win'; chips = hand.bet;
        player.chips += hand.bet * 2;
      } else if (playerTotal === dealerTotal) {
        result = 'push'; chips = 0;
        player.chips += hand.bet;
      } else {
        result = 'lose'; chips = -hand.bet;
      }

      hand.result = result;
      playerResult.hands.push({ cards: hand.cards, result, bet: hand.bet, chips });
      playerResult.netChips += chips;
    }

    results.push(playerResult);
  }

  s.results = results;
  s.finished = true;

  // Determine overall winner (most chips gained)
  const sorted = [...results].sort((a, b) => b.netChips - a.netChips);
  const winner = sorted[0].netChips > 0 ? sorted[0].addr : 'dealer';
  s.winner = winner;

  return { state: s, finished: true, winner, results };
}

// ─── Server Engine ────────────────────────────────────

class BlackjackEngine {
  constructor() {
    this.games = new Map(); // gameId -> state (with shoe)
  }

  startGame(gameId, players, stakeKas, options) {
    const state = createBlackjackState(players, stakeKas, options);
    state.phase = 'player-turn'; // skip betting phase for now (bets set at creation)
    // Check insurance opportunity
    if (state.dealerHand[0]?.[0] === 'A' && state.options.allowInsurance) {
      state.phase = 'insurance';
    }
    this.games.set(gameId, state);
    return getPublicState(state);
  }

  applyAction(gameId, playerAddr, action, amount) {
    const state = this.games.get(gameId);
    if (!state) return { error: 'Game not found' };
    const result = applyAction(state, playerAddr, action, amount);
    if (result.error) return result;
    this.games.set(gameId, result.state);
    return {
      ...result,
      publicState: getPublicState(result.state),
    };
  }

  getPublicState(gameId) {
    const state = this.games.get(gameId);
    if (!state) return null;
    return getPublicState(state);
  }

  confirmInsurancePhase(gameId) {
    const state = this.games.get(gameId);
    if (!state) return { error: 'Game not found' };
    state.phase = 'player-turn';
    this.games.set(gameId, state);
    return { publicState: getPublicState(state) };
  }

  newRound(gameId, newBets) {
    const state = this.games.get(gameId);
    if (!state || !state.finished) return { error: 'Round not finished' };
    // Reshuffle shoe if below threshold
    if (state.shoe.length < state.reshuffleAt) {
      state.shoe = shuffle(makeShoe(Math.round(state.shoeSize / 52)));
    }
    // Reset for new round
    const numDecks = Math.round(state.shoeSize / 52);
    const players = state.players.map((p, i) => ({
      addr: p.addr, name: p.name,
      betSompi: newBets?.[i] || p.hands[0].bet,
    }));
    // Re-use existing shoe
    const newState = createBlackjackState(players, 0, { ...state.options, startingChips: null });
    // Restore chip counts
    newState.players.forEach((p, i) => { p.chips = state.players[i].chips; });
    newState.roundNumber = state.roundNumber + 1;
    newState.shoe = state.shoe; // continue from existing shoe
    newState.phase = 'player-turn';
    this.games.set(gameId, newState);
    return { publicState: getPublicState(newState) };
  }

  endGame(gameId) {
    this.games.delete(gameId);
  }
}

module.exports = {
  BlackjackEngine,
  createBlackjackState,
  applyAction,
  getPublicState,
  handTotal,
  isBust,
  isBlackjack,
  SUITS,
  RANKS,
};
