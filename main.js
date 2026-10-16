console.time('execution');


////////////////////////////  UTILITIES  /////////////////////////////

function pickRandom(array) {
  const index = Math.floor(Math.random() * array.length);
  return array[index];
}

function removeById(population, id) {
  return population.filter(p => p.id !== id);
}

function createPopulation(strategyCounts) {
  const population = [];
  let id = 1;

  for (const [strategy, count] of Object.entries(strategyCounts)) {
    for (let i = 0; i < count; i++) {
      population.push({ id: id++, strategy });
    }
  }

  return population;
}


////////////////////////////  STRATEGIES  ////////////////////////////

// A strategy is just a function: context => 'cooperate' | 'cheat'
const strategies = {

  // Always cooperate
  alwaysCooperate: (ctx) => 'cooperate',

  // Always cheat
  alwaysCheat: (ctx) => 'cheat',

  // Mirror opponent's last move (cooperate on round 1)
  titForTat: (ctx) => {
    if (ctx.round === 1) return 'cooperate';
    return ctx.opponentHistory[ctx.round - 2]; // last opponent move
  },

  // Cooperate unless opponent cheated twice in a row
  titForTwoTats: (ctx) => {
    if (ctx.round <= 2) return 'cooperate';
    const lastTwo = ctx.opponentHistory.slice(-2);
    return lastTwo.every(m => m === 'cheat') ? 'cheat' : 'cooperate';
  },

  // Random
  random: (ctx) => Math.random() < 0.5 ? 'cooperate' : 'cheat',
};

///////////////////////////  PRIVILEGIES  ////////////////////////////

const alternativePayoffs = {
  cooperate: {
    cooperate: { player1: 3, player2: 2 },
    cheat:     { player1: 0, player2: 3 },
  },
  cheat: {
    cooperate: { player1: 4, player2: -1 },
    cheat:     { player1: 1, player2: 0 },
  },
};

console.log(alternativePayoffs['cooperate']['cooperate'])


//////////////////////////////  PAYOFFS  /////////////////////////////

const payoffs = {
  cooperate: {
    cooperate: { player1: 2, player2: 2 },
    cheat:     { player1: -1, player2: 3 },
  },
  cheat: {
    cooperate: { player1: 3, player2: -1 },
    cheat:     { player1: 0, player2: 0 },
  },
};


//////////////////////////  ONE-ON-ONE GAME  /////////////////////////

function oneOnOneGame(player1Choice, player2Choice, payoffs) {
  const result = payoffs[player1Choice][player2Choice];
  return {
    player1Score: result.player1,
    player2Score: result.player2,
  };
}


///////////////////////////////  MATCH  //////////////////////////////

function match(stra1, stra2, rounds = 10) {
  const history = { p1: [], p2: [] };
  let scores = { p1: 0, p2: 0 };

  for (let r = 1; r <= rounds; r++) {
    const ctx1 = { round: r, myHistory: history.p1, opponentHistory: history.p2 };
    const ctx2 = { round: r, myHistory: history.p2, opponentHistory: history.p1 };

    const strategy1 = strategies[stra1];
    const strategy2 = strategies[stra2];

    const move1 = strategy1(ctx1);
    const move2 = strategy2(ctx2);

    const result = oneOnOneGame(move1, move2, payoffs);
    scores.p1 += result.player1Score;
    scores.p2 += result.player2Score;

    history.p1.push(move1);
    history.p2.push(move2);
  }

  return { history, scores };
}


///////////////////////////  TOURNAMENT  ///////////////////////////

// Group by strategy — since two players with the same strategy always produce the same match result,
// you only need to compute one match per strategy pair, then multiply the score by the number of individuals

function tournamentGrouped(population, rounds = 10) {
  // Count how many individuals per strategy
  const counts = population.reduce((acc, p) => {
    acc[p.strategy] = (acc[p.strategy] || 0) + 1;
    return acc;
  }, {});

  const strategyNames = Object.keys(counts);
  const scorePerStrategy = Object.fromEntries(strategyNames.map(s => [s, 0]));

  // Only compute one match per strategy pair
  for (let i = 0; i < strategyNames.length; i++) {
    for (let j = i + 1; j < strategyNames.length; j++) {
      const s1 = strategyNames[i];
      const s2 = strategyNames[j];

      const result = match(s1, s2, rounds);

      // Multiply score by how many opponents of that type exist
      scorePerStrategy[s1] += result.scores.p1 * counts[s2];
      scorePerStrategy[s2] += result.scores.p2 * counts[s1];
    }

    // Same-strategy matches (play against all others of the same kind)
    const s = strategyNames[i];
    if (counts[s] > 1) {
      const result = match(s, s, rounds);
      const pairsCount = counts[s] * (counts[s] - 1) / 2;
      scorePerStrategy[s] += (result.scores.p1 + result.scores.p2) * pairsCount;
    }
  }

  // Rebuild scoreboard per individual, all sharing the strategy score equally
  return population
    .map(p => ({ ...p, totalScore: scorePerStrategy[p.strategy] }))
    .sort((a, b) => b.totalScore - a.totalScore);
}

//////////////////////////  MULTI-TOURNAMENT  ////////////////////////


function multiTournament(initialPopulation, { eliminate, duplicate, iterations, rounds = 10, timeLimitMs = null }) {
  const startTime = Date.now();
  let population = initialPopulation.map(p => ({ ...p }));
  let nextId = Math.max(...population.map(p => p.id)) + 1;
  let converged = false;
  const log = [];

  // --- Pre-compute all strategy pair results once ---
  const strategyNames = Object.keys(strategies);
  const matchCache = {};

  for (let i = 0; i < strategyNames.length; i++) {
    for (let j = i; j < strategyNames.length; j++) {
      const s1 = strategyNames[i];
      const s2 = strategyNames[j];
      const key = `${s1}|${s2}`;
      matchCache[key] = match(s1, s2, rounds);
    }
  }

  // Helper to retrieve cached result in the right direction
  function getCachedMatch(s1, s2) {
    const key = `${s1}|${s2}`;
    if (matchCache[key]) return { p1: matchCache[key].scores.p1, p2: matchCache[key].scores.p2 };
    // If stored in reverse order
    const reverseKey = `${s2}|${s1}`;
    return { p1: matchCache[reverseKey].scores.p2, p2: matchCache[reverseKey].scores.p1 };
  }

  for (let iter = 1; iter <= iterations; iter++) {

    // --- Check time limit ---
    if (timeLimitMs && (Date.now() - startTime) > timeLimitMs) {
      console.log(`Time limit reached after ${iter - 1} iterations.`);
      break;
    }

    // --- Run tournament using cache ---

    // acc -->  accumulator
    const counts = population.reduce((acc, p) => {
      acc[p.strategy] = (acc[p.strategy] || 0) + 1;
      return acc;
    }, {});

    const activeStrategies = Object.keys(counts);
    const scorePerStrategy = Object.fromEntries(activeStrategies.map(s => [s, 0]));

    // Accumulate scores for each strategy pair, weighted by how many individuals use each strategy
    for (let i = 0; i < activeStrategies.length; i++) {
      for (let j = i + 1; j < activeStrategies.length; j++) {
        const s1 = activeStrategies[i];
        const s2 = activeStrategies[j];
        const result = getCachedMatch(s1, s2);
        scorePerStrategy[s1] += result.p1 * counts[s2];
        scorePerStrategy[s2] += result.p2 * counts[s1];
      }

      // Same-strategy matches
      const s = activeStrategies[i];
      if (counts[s] > 1) {
        const result = getCachedMatch(s, s);
        const pairsCount = counts[s] * (counts[s] - 1) / 2;
        scorePerStrategy[s] += (result.p1 + result.p2) * pairsCount;
      }
    }

    // --- Build scoreboard ---
    const scoreboard = population
      .map(p => ({ ...p, totalScore: scorePerStrategy[p.strategy] }))
      .sort((a, b) => b.totalScore - a.totalScore);

    // --- Eliminate X lowest scorers ---
    let remaining = [...scoreboard];

    for (let i = 0; i < eliminate; i++) {
      // Group all individuals tied at the lowest score
      const lowestScore = remaining[remaining.length - 1].totalScore;
      const lowestGroup = remaining.filter(p => p.totalScore === lowestScore);
      const victim = pickRandom(lowestGroup);
      remaining = removeById(remaining, victim.id);
    }

    // --- Duplicate Y highest scorers ---
    for (let i = 0; i < duplicate; i++) {
      const highestScore = remaining[0].totalScore;
      const highestGroup = remaining.filter(p => p.totalScore === highestScore);
      const parent = pickRandom(highestGroup);
      remaining.push({ id: nextId++, strategy: parent.strategy });
    }

    // --- Strip scores, keep as plain population for next round ---
    population = remaining.map(({ id, strategy }) => ({ id, strategy }));

    const strategyCounts = population.reduce((acc, p) => {
      acc[p.strategy] = (acc[p.strategy] || 0) + 1;
      return acc;
    }, {});

    log.push({ iteration: iter, size: population.length, strategyCounts });
    // console.log(`Iteration ${iter}:`, strategyCounts);

    // --- Early exit if only one strategy remains ---
    if (Object.keys(strategyCounts).length === 1) {
      converged = true;
      console.log(`Converged after ${iter} iterations: only '${Object.keys(strategyCounts)[0]}' remains.`);
      break;
    }
  }

  return { population, log, converged };
}

////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////


///////////////////////////  POPULATION  ///////////////////////////

const initialPopulation = createPopulation({
  alwaysCheat:     200,
  titForTat:       200,
  alwaysCooperate: 200,
  random:          200,
  titForTwoTats:   200,
});


/////////////////////////////  RULES  /////////////////////////////

const { population, log, converged } = multiTournament(initialPopulation, {
  eliminate:  5,        // X: remove this many lowest scorers each iteration
  duplicate:  5,        // Y: clone this many highest scorers each iteration
  iterations: 1000,      // Z: number of tournament cycles
  rounds:     10,       // rounds per match (optional, defaults to 10)
  timeLimitMs: 60 * 1000,    // stop after some time limit
});

////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////





// Extracting final Strategies Count from log
const finalStrategiesCounts = log[log.length - 1].strategyCounts;

// Sorting the final Strategies Count
const sortedFinalStrategiesCounts = Object.entries(finalStrategiesCounts)
.sort((a, b) => b[1] - a[1])
.map(([strategy, count]) => ({ strategy, count }));






// console.log('\nFinal population:', population);              ***
logAux = log.map((ele) => ele.strategyCounts)
console.table(logAux);
console.table(sortedFinalStrategiesCounts);
console.log(`CONVERGED: ${converged}`);
// console.log(match('alwaysCheat', 'alwaysCheat', rounds = 10).scores);





console.timeEnd('execution');