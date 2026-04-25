/**
 * CeloPoker — Backend API Client
 * Production: poker-backend-production-fde9.up.railway.app
 */

export const BACKEND_BASE =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'https://poker-backend-production-fde9.up.railway.app';

// ---------- helpers ----------

async function request(path, options = {}) {
  const url = `${BACKEND_BASE}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`[API ${res.status}] ${path} — ${text}`);
  }
  return res.json();
}

// ---------- game lifecycle ----------

/** Create or join a table */
export const joinTable = (tableId, playerAddress, buyInAmount) =>
  request(`/game/join`, {
    method: 'POST',
    body: JSON.stringify({ tableId, playerAddress, buyInAmount }),
  });

/**
 * After a human player buys in, call this so the backend spawns
 * bot players and funds the escrow, enabling payouts.
 */
export const addBots = (tableId, count = 2) =>
  request(`/game/add-bots`, {
    method: 'POST',
    body: JSON.stringify({ tableId, botCount: count }),
  });

/** Fold / call / raise */
export const playerAction = (tableId, playerAddress, action, amount = 0) =>
  request(`/game/action`, {
    method: 'POST',
    body: JSON.stringify({ tableId, playerAddress, action, amount }),
  });

/** Explicitly end a game and declare a winner (guards against premature shutdown) */
export const declareWinner = (tableId) =>
  request(`/game/declare-winner`, {
    method: 'POST',
    body: JSON.stringify({ tableId }),
  });

/** Fetch current table state */
export const getTableState = (tableId) => request(`/game/state/${tableId}`);

/** List open tables */
export const listTables = () => request(`/game/tables`);

// ---------- escrow / payout ----------

/** Trigger payout to winner — called after declare-winner */
export const triggerPayout = (tableId, winnerAddress) =>
  request(`/escrow/payout`, {
    method: 'POST',
    body: JSON.stringify({ tableId, winnerAddress }),
  });

/** Check escrow balance for a table */
export const getEscrowBalance = (tableId) =>
  request(`/escrow/balance/${tableId}`);
