'use strict';

const SOMPI_PER_KAS = 100000000;

const FEE_SCHEDULE = {
  SPOT_PROTOCOL_BPS: 200,
  MAXIMIZER_HEDGE_BPS: 3000,
  GAME_PROTOCOL_BPS: 200,
  BOND_AMOUNT_KAS: 1000,
  CHALLENGE_BOND_KAS: 250,
  MIN_POSITION_KAS: 1,
};

function calculateSpotPayouts(positions, winningSide, poolTotal) {
  const winners = positions.filter(p => p.side === winningSide);
  const losers = positions.filter(p => p.side !== winningSide);

  const winnerPool = winners.reduce((s, p) => s + p.amountSompi, 0);
  const loserPool = losers.reduce((s, p) => s + p.amountSompi, 0);

  const protocolFee = Math.floor(loserPool * FEE_SCHEDULE.SPOT_PROTOCOL_BPS / 10000);
  const distributable = loserPool - protocolFee;

  const payouts = [];
  for (const w of winners) {
    const share = winnerPool > 0 ? w.amountSompi / winnerPool : 0;
    const winnings = Math.floor(distributable * share);
    payouts.push({
      userPubkey: w.userPubkey,
      address: w.userAddr,
      amountSompi: w.amountSompi + winnings,
      originalStake: w.amountSompi,
      profit: winnings,
      side: w.side,
      riskMode: 0,
    });
  }

  return { payouts, protocolFeeSompi: protocolFee, winnerPool, loserPool };
}

function calculateMaximizerPayouts(positions, winningSide, poolTotal) {
  const winners = positions.filter(p => p.side === winningSide);
  const losers = positions.filter(p => p.side !== winningSide);

  const winnerPool = winners.reduce((s, p) => s + p.amountSompi, 0);
  const loserPool = losers.reduce((s, p) => s + p.amountSompi, 0);

  const hedgeReturn = Math.floor(loserPool * 0.5);
  const hedgeFee = Math.floor(hedgeReturn * FEE_SCHEDULE.MAXIMIZER_HEDGE_BPS / 10000);
  const netHedgeReturn = hedgeReturn - hedgeFee;
  const winnerDistributable = loserPool - hedgeReturn;
  const protocolFee = hedgeFee;

  const payouts = [];

  for (const w of winners) {
    const share = winnerPool > 0 ? w.amountSompi / winnerPool : 0;
    const winnings = Math.floor(winnerDistributable * share);
    payouts.push({
      userPubkey: w.userPubkey,
      address: w.userAddr,
      amountSompi: w.amountSompi + winnings,
      originalStake: w.amountSompi,
      profit: winnings,
      side: w.side,
      riskMode: 1,
    });
  }

  for (const l of losers) {
    const share = loserPool > 0 ? l.amountSompi / loserPool : 0;
    const hedgePayout = Math.floor(netHedgeReturn * share);
    if (hedgePayout > 0) {
      payouts.push({
        userPubkey: l.userPubkey,
        address: l.userAddr,
        amountSompi: hedgePayout,
        originalStake: l.amountSompi,
        profit: hedgePayout - l.amountSompi,
        side: l.side,
        riskMode: 1,
      });
    }
  }

  return { payouts, protocolFeeSompi: protocolFee, winnerPool, loserPool, hedgeReturn: netHedgeReturn };
}

function calculateOpenPayouts(positions, winningSide, poolTotal) {
  const spotPositions = positions.filter(p => p.riskMode === 0);
  const maxPositions = positions.filter(p => p.riskMode === 1);

  const spotPool = spotPositions.reduce((s, p) => s + p.amountSompi, 0);
  const maxPool = maxPositions.reduce((s, p) => s + p.amountSompi, 0);

  let allPayouts = [];
  let totalProtocolFee = 0;

  if (spotPositions.length > 0) {
    const spotResult = calculateSpotPayouts(spotPositions, winningSide, spotPool);
    allPayouts.push(...spotResult.payouts);
    totalProtocolFee += spotResult.protocolFeeSompi;
  }

  if (maxPositions.length > 0) {
    const maxResult = calculateMaximizerPayouts(maxPositions, winningSide, maxPool);
    allPayouts.push(...maxResult.payouts);
    totalProtocolFee += maxResult.protocolFeeSompi;
  }

  return { payouts: allPayouts, protocolFeeSompi: totalProtocolFee };
}

function calculateGamePayout(potSompi, isDraw = false) {
  const fee = Math.floor(potSompi * FEE_SCHEDULE.GAME_PROTOCOL_BPS / 10000);
  if (isDraw) {
    const perPlayer = Math.floor((potSompi - fee) / 2);
    return { winnerPayout: perPlayer, loserPayout: perPlayer, protocolFeeSompi: fee };
  }
  return { winnerPayout: potSompi - fee, loserPayout: 0, protocolFeeSompi: fee };
}

function getOdds(sideA, sideB) {
  const total = sideA + sideB;
  if (total === 0) return { oddsA: 2.0, oddsB: 2.0, impliedProbA: 0.5, impliedProbB: 0.5 };
  const oddsA = sideA > 0 ? total / sideA : 0;
  const oddsB = sideB > 0 ? total / sideB : 0;
  return {
    oddsA: Math.round(oddsA * 100) / 100,
    oddsB: Math.round(oddsB * 100) / 100,
    impliedProbA: Math.round((sideA / total) * 10000) / 10000,
    impliedProbB: Math.round((sideB / total) * 10000) / 10000,
  };
}

function estimatePayout(amountSompi, side, sideATotalSompi, sideBTotalSompi, riskMode = 0) {
  const mySideTotal = side === 1 ? sideATotalSompi + amountSompi : sideBTotalSompi + amountSompi;
  const otherSideTotal = side === 1 ? sideBTotalSompi : sideATotalSompi;

  if (riskMode === 0) {
    const protocolFee = Math.floor(otherSideTotal * FEE_SCHEDULE.SPOT_PROTOCOL_BPS / 10000);
    const distributable = otherSideTotal - protocolFee;
    const share = mySideTotal > 0 ? amountSompi / mySideTotal : 0;
    return amountSompi + Math.floor(distributable * share);
  }

  const hedgeReturn = Math.floor(otherSideTotal * 0.5);
  const hedgeFee = Math.floor(hedgeReturn * FEE_SCHEDULE.MAXIMIZER_HEDGE_BPS / 10000);
  const winnerDist = otherSideTotal - hedgeReturn;
  const share = mySideTotal > 0 ? amountSompi / mySideTotal : 0;
  return amountSompi + Math.floor(winnerDist * share);
}

module.exports = {
  FEE_SCHEDULE, SOMPI_PER_KAS,
  calculateSpotPayouts, calculateMaximizerPayouts, calculateOpenPayouts,
  calculateGamePayout, getOdds, estimatePayout,
};
