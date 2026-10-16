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

console.log(alternativePayoffs['cooperate']['cooperate']['player1'] + 1)