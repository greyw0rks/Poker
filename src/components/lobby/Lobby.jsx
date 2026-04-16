'use client';

import { useState, useEffect } from 'react';

const SERVER_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

function formatTimeLeft(seconds) {
  if (!seconds) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function TableCard({ table, onJoin, isBusy }) {
  const pct = (table.playerCount / 6) * 100;

  return (
    <div className="table-card">
      <div className="table-card-header">
        <span className="table-name">{table.name}</span>
        <span className={`table-badge ${table.playerCount >= 3 ? 'badge-starting' : 'badge-open'}`}>
          {table.playerCount >= 3 ? '⏱ Starting' : '● Open'}
        </span>
      </div>

      <div className="table-meta">
        <span>Min buy-in: <strong>${table.minBuyInUSD}</strong></span>
        {table.startAt && (
          <span className="table-timer">
            Starts in {formatTimeLeft(Math.max(0, Math.round((table.startAt - Date.now()) / 1000)))}
          </span>
        )}
      </div>

      <div className="seat-bar">
        <div className="seat-fill" style={{ width: `${pct}%` }} />
        <span className="seat-label">{table.playerCount}/6 players</span>
      </div>

      <button
        className="btn btn-join"
        onClick={() => onJoin(table)}
        disabled={isBusy || table.playerCount >= 6}
      >
        {isBusy ? 'Joining…' : 'Join Table →'}
      </button>
    </div>
  );
}

function BuyInModal({ table, onConfirm, onCancel, cusdBalance }) {
  const [amount, setAmount] = useState(table?.minBuyInUSD ?? 1);
  const [txStep, setTxStep] = useState('idle'); // idle | approving | joining | done

  if (!table) return null;

  const max = Math.min(cusdBalance, table.maxBuyInUSD || cusdBalance);
  const valid = amount >= table.minBuyInUSD && amount <= max;

  const handleConfirm = async () => {
    setTxStep('approving');
    try {
      await onConfirm(table, amount);
      setTxStep('done');
    } catch (e) {
      setTxStep('idle');
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-title">Buy In to {table.name}</div>

        <div className="modal-field">
          <label>cUSD Amount</label>
          <div className="input-row">
            <span className="input-prefix">$</span>
            <input
              type="number"
              className="modal-input"
              value={amount}
              min={table.minBuyInUSD}
              max={max}
              step="0.5"
              onChange={e => setAmount(Number(e.target.value))}
              disabled={txStep !== 'idle'}
            />
          </div>
          <div className="input-meta">
            Balance: <strong>${cusdBalance}</strong> · Min: <strong>${table.minBuyInUSD}</strong>
          </div>
        </div>

        <div className="modal-presets">
          {[1, 5, 10, 20].filter(v => v >= table.minBuyInUSD && v <= max).map(v => (
            <button key={v} className={`btn-preset ${amount === v ? 'preset-active' : ''}`}
                    onClick={() => setAmount(v)} disabled={txStep !== 'idle'}>
              ${v}
            </button>
          ))}
        </div>

        {txStep === 'approving' && (
          <div className="tx-status">Approving cUSD spend in wallet…</div>
        )}
        {txStep === 'joining' && (
          <div className="tx-status">Locking funds on-chain…</div>
        )}

        <div className="modal-actions">
          <button className="btn btn-cancel" onClick={onCancel} disabled={txStep !== 'idle'}>
            Cancel
          </button>
          <button className="btn btn-confirm" onClick={handleConfirm}
                  disabled={!valid || txStep !== 'idle'}>
            {txStep === 'idle' ? `Buy In $${amount}` : '…'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Lobby({ address, cusdBalance, username, onJoined, buyIntoTable, gameHook }) {
  const [tables,      setTables]      = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [isBusy,      setIsBusy]      = useState(false);
  const [devLoading,  setDevLoading]  = useState(false);

  // Fetch tables on mount and via socket
  useEffect(() => {
    fetch(`${SERVER_URL}/tables`)
      .then(r => r.json())
      .then(setTables)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (gameHook?.tableList?.length) {
      setTables(gameHook.tableList);
    }
  }, [gameHook?.tableList]);

  const handleJoin = async (table, amount) => {
    if (!address || !username) return;
    setIsBusy(true);

    try {
      // 1. Lock cUSD on-chain (approve + joinTable on contract)
      if (buyIntoTable && table.onChainTableId) {
        await buyIntoTable(table.onChainTableId, amount, process.env.NEXT_PUBLIC_CONTRACT_ADDRESS);
      }

      // 2. Register with backend
      gameHook.joinTable({
        tableId:  table.tableId,
        name:     username,
        buyInUSD: amount,
      });

      setSelectedTable(null);
      onJoined?.(table.tableId);
    } catch (e) {
      console.error('Join failed:', e);
    } finally {
      setIsBusy(false);
    }
  };

  // Dev: spin up a bot table for testing
  const createBotTable = async () => {
    setDevLoading(true);
    try {
      const res = await fetch(`${SERVER_URL}/dev/bot-table`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerCount: 5, minBuyInUSD: 1 }),
      });
      const { tableId } = await res.json();

      // Also join as human player
      gameHook.joinTable({ tableId, name: username || 'Player', buyInUSD: 1 });
      onJoined?.(tableId);
    } finally {
      setDevLoading(false);
    }
  };

  return (
    <div className="lobby">
      <div className="lobby-header">
        <div className="lobby-title">
          <span className="spade">♠</span> CeloPoker
        </div>
        <div className="lobby-wallet">
          <span className="wallet-badge">{address?.slice(0, 6)}…{address?.slice(-4)}</span>
          <span className="balance-badge">cUSD ${cusdBalance}</span>
        </div>
      </div>

      <div className="lobby-body">
        {tables.length === 0 ? (
          <div className="no-tables">
            <div className="no-tables-icon">🃏</div>
            <div>No open tables right now.</div>
          </div>
        ) : (
          <div className="table-list">
            {tables.map(t => (
              <TableCard
                key={t.tableId}
                table={t}
                onJoin={t => setSelectedTable(t)}
                isBusy={isBusy}
              />
            ))}
          </div>
        )}

        {/* Dev mode: quick bot table */}
        {process.env.NEXT_PUBLIC_DEV_MODE === 'true' && (
          <div className="dev-panel">
            <div className="dev-label">🛠 Dev Mode</div>
            <button className="btn btn-dev" onClick={createBotTable} disabled={devLoading}>
              {devLoading ? 'Creating…' : '🤖 Start Bot Table (test)'}
            </button>
          </div>
        )}
      </div>

      {selectedTable && (
        <BuyInModal
          table={selectedTable}
          cusdBalance={cusdBalance}
          onConfirm={handleJoin}
          onCancel={() => setSelectedTable(null)}
        />
      )}
    </div>
  );
}
