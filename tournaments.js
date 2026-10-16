////////////////////////////////////////////////////////////////////
///////////////////////////      V1      ///////////////////////////
////////////////////////////////////////////////////////////////////

function tournament(population, rounds = 10) {
  // Initialize scoreboard
  const scoreboard = population.map(player => ({
    ...player,
    totalScore: 0,
  }));

  // Every player plays against every other player exactly once
  for (let i = 0; i < population.length; i++) {
    for (let j = i + 1; j < population.length; j++) {
      const player1 = population[i];
      const player2 = population[j];

      const result = match(player1.strategy, player2.strategy, rounds);

      scoreboard[i].totalScore += result.scores.p1;
      scoreboard[j].totalScore += result.scores.p2;
    }
  }

  // Sort by score descending
  scoreboard.sort((a, b) => b.totalScore - a.totalScore);

  return scoreboard;
}
////////////////////////////////////////////////////////////////////
///////////////////////////      V2      ///////////////////////////
////////////////////////////////////////////////////////////////////

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
