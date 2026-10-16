////////////////////////////////////////////////////////////////////
///////////////////////////      V1.0      /////////////////////////
////////////////////////////////////////////////////////////////////

function multiTournament(initialPopulation, { eliminate, duplicate, iterations, rounds = 10, timeLimitMs = null }) {
  const startTime = Date.now();
  let population = initialPopulation.map(p => ({ ...p }));
  let nextId = Math.max(...population.map(p => p.id)) + 1;
  let converged = false;
  const log = [];

  for (let iter = 1; iter <= iterations; iter++) {

    // --- Check time limit ---
    if (timeLimitMs && (Date.now() - startTime) > timeLimitMs) {
      console.log(`Time limit reached after ${iter - 1} iterations.`);
      break;
    }

    // --- Run tournament ---
    const scoreboard = tournamentGrouped(population, rounds);

    // --- Eliminate X lowest scorers ---
    const sorted = [...scoreboard]; // already sorted descending by tournament()
    let remaining = [...sorted];

    for (let i = 0; i < eliminate; i++) {
      // Group all individuals tied at the lowest score
      const lowestScore = remaining[remaining.length - 1].totalScore;
      const lowestGroup = remaining.filter(p => p.totalScore === lowestScore);
      const victim = pickRandom(lowestGroup);
      remaining = removeById(remaining, victim.id);
    }

    // --- Duplicate Y highest scorers ---
    for (let i = 0; i < duplicate; i++) {
      // Group all individuals tied at the highest score
      const highestScore = remaining[0].totalScore;
      const highestGroup = remaining.filter(p => p.totalScore === highestScore);
      const parent = pickRandom(highestGroup);
      remaining.push({ id: nextId++, strategy: parent.strategy });
    }

    // --- Strip scores, keep as plain population for next round ---
    population = remaining.map(({ id, strategy }) => ({ id, strategy }));

    // --- Log state ---
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


////////////////////////////////////////////////////////////////////
///////////////////////////      V2.0      /////////////////////////
////////////////////////////////////////////////////////////////////

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