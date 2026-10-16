// 1. Always cooperate
alwaysCooperate: (ctx) => 'cooperate',

// 2. Always cheat
alwaysCheat: (ctx) => 'cheat',

// 3. Mirror opponent's last move (cooperate on round 1)
titForTat: (ctx) => {
  if (ctx.round === 1) return 'cooperate';
  return ctx.opponentHistory[ctx.round - 2];
},

// 4. Cooperate unless opponent cheated twice in a row
titForTwoTats: (ctx) => {
  if (ctx.round <= 2) return 'cooperate';
  const lastTwo = ctx.opponentHistory.slice(-2);
  return lastTwo.every(m => m === 'cheat') ? 'cheat' : 'cooperate';
},

// 5. Random
random: (ctx) => Math.random() < 0.5 ? 'cooperate' : 'cheat',
n
// 6. Grudger: cooperate until opponent cheats once, then cheat forever
grudger: (ctx) => {
  return ctx.opponentHistory.includes('cheat') ? 'cheat' : 'cooperate';
},

// 7. Pavlov (win-stay, lose-shift): repeat last move if it paid off, switch if it didn't
pavlov: (ctx) => {
  if (ctx.round === 1) return 'cooperate';
  const myLast = ctx.myHistory[ctx.round - 2];
  const opponentLast = ctx.opponentHistory[ctx.round - 2];
  // "won" means I cheated while they cooperated, or we both cooperated
  const iWon = (myLast === 'cheat' && opponentLast === 'cooperate') || 
               (myLast === 'cooperate' && opponentLast === 'cooperate');
  return iWon ? myLast : (myLast === 'cooperate' ? 'cheat' : 'cooperate');
},

// 8. Detective: probes with a fixed sequence then exploits or mimics based on response
detective: (ctx) => {
  const probe = ['cooperate', 'cheat', 'cooperate', 'cooperate'];
  if (ctx.round <= 4) return probe[ctx.round - 1];
  // If opponent never retaliated during probe, exploit them
  const wasRetaliatedAgainst = ctx.opponentHistory.slice(0, 4).includes('cheat');
  return wasRetaliatedAgainst ? ctx.opponentHistory[ctx.round - 2] : 'cheat';
},

// 9. Generous tit-for-tat: like tit-for-tat but occasionally forgives a cheat (20% chance)
generousTitForTat: (ctx) => {
  if (ctx.round === 1) return 'cooperate';
  const opponentLastMove = ctx.opponentHistory[ctx.round - 2];
  if (opponentLastMove === 'cheat' && Math.random() < 0.2) return 'cooperate'; // forgive
  return opponentLastMove;
},

// 10. Majority: cooperate if opponent has cooperated more than half the time, else cheat
majority: (ctx) => {
  if (ctx.round === 1) return 'cooperate';
  const cooperations = ctx.opponentHistory.filter(m => m === 'cooperate').length;
  return cooperations / ctx.opponentHistory.length >= 0.5 ? 'cooperate' : 'cheat';
}