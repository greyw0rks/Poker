'use client';

import { useState, useEffect } from 'react';

// ─── Card rendering ───────────────────────────────────────────────────────────
const SUIT_COLORS  = { s: '#1a1a2e', h: '#e63946', d: '#e63946', c: '#1a1a2e' };
const SUIT_SYMBOLS = { s: '♠', h: '♥', d: '♦', c: '♣' };

function PlayingCard({ card, hidden = false, small = false }) {
  if (hidden || !card) {
    return (
      <div className={`card card-back ${small ? 'card-small' : ''}`}>
        <div className="card-back-pattern" />
      </div>
    );
  }

  const rank = card.slice(0, -1);
  const suit = card.slice(-1);
  const color = SUIT_COLORS[suit] || '#1a1a2e';
  const symbol = SUIT_SYMBOLS[suit] || suit;

  const displayRank = { T: '10' }[rank] || rank;

  return (
    <div className={`card ${small ? 'card-small' : ''}`} style={{ color }}>
      <div className="card-corner card-top">
        <span className="card-rank">{displayRank}</span>
        <span className="card-suit">{symbol}</span>
      </div>
      <div className="card-center">{symbol}</div>
      <div className="card-corner card-bottom">
        <span className="card-rank">{displayRank}</span>
        <span className="card-suit">{symbol}</span>
      </div>
    </div>
  );
}

// ─── Player seat ──────────────────────────────────────────────────────────────
function PlayerSeat({ player, isActive, isMe, holeCards, position }) {
  if (!player) return <div className="seat seat-empty" />;

  return (
    <div className={`seat ${isActive ? 'seat-active' : ''} ${isMe ? 'seat-me' : ''} seat-${position}`}>
      {/* Hole cards */}
      <div className="seat-cards">
        {isMe && holeCards?.length === 2 ? (
          holeCards.map((c, i) => <PlayingCard key={i} card={c} small />)
        ) : (
          <>
            <PlayingCard hidden small />
            <PlayingCard hidden small />
          </>
        )}
      </div>

      {/* Player info */}
      <div className={`seat-info ${player.folded ? 'seat-folded' : ''}`}>
        <div className="seat-name">
          {player.isBot ? '🤖 ' : ''}{player.name}
          {isMe && ' (you)'}
        </div>
        <div className="seat-chips">
          <span className="chip-icon">●</span>
          {formatChips(player.chips)}
        </div>
        {Number(player.bet) > 0 && (
          <div className="seat-bet">Bet: {formatChips(player.bet)}</div>
        )}
        {player.allIn && <div className="seat-allin">ALL IN</div>}
        {player.folded && <div className="seat-folded-label">FOLDED</div>}
      </div>

      {/* Action indicator */}
      {isActive && <div className="action-indicator" />}
    </div>
  );
}

// ─── Community cards ──────────────────────────────────────────────────────────
function CommunityCards({ board }) {
  const slots = ['', '', '', '', ''];
  return (
    <div className="community-cards">
      {slots.map((_, i) => (
        <PlayingCard key={i} card={board?.[i] ?? null} />
      ))}
    </div>
  );
}

// ─── Action buttons ───────────────────────────────────────────────────────────
function ActionPanel({ isMyTurn, canCheck, toCall, myChips, minRaise,
                       onFold, onCheck, onCall, onRaise, onAllIn }) {
  const [raiseAmount, setRaiseAmount] = useState('');
  const chips = Number(myChips ?? 0);
  const toCallNum = Number(toCall ?? 0);

  if (!isMyTurn) {
    return (
      <div className="action-panel action-waiting">
        <div className="waiting-pulse">Waiting for your turn…</div>
      </div>
    );
  }

  const handleRaise = () => {
    const amt = parseInt(raiseAmount, 10);
    if (!amt || amt < minRaise) return;
    onRaise(amt);
    setRaiseAmount('');
  };

  const halfPot = Math.floor(chips / 2);
  const potBet  = Math.min(chips, Math.floor(chips * 0.75));

  return (
    <div className="action-panel action-active">
      <div className="action-row">
        <button className="btn btn-fold"  onClick={onFold}>Fold</button>
        {canCheck
          ? <button className="btn btn-check" onClick={onCheck}>Check</button>
          : <button className="btn btn-call"  onClick={onCall}>
              Call {formatChips(toCallNum)}
            </button>
        }
        <button className="btn btn-allin" onClick={onAllIn}>All In</button>
      </div>

      <div className="raise-row">
        <div className="raise-presets">
          <button className="btn-preset" onClick={() => setRaiseAmount(String(halfPot))}>½</button>
          <button className="btn-preset" onClick={() => setRaiseAmount(String(potBet))}>¾</button>
          <button className="btn-preset" onClick={() => setRaiseAmount(String(chips))}>Max</button>
        </div>
        <div className="raise-input-row">
          <input
            type="number"
            className="raise-input"
            value={raiseAmount}
            min={minRaise}
            max={chips}
            placeholder={`Min ${formatChips(minRaise)}`}
            onChange={e => setRaiseAmount(e.target.value)}
          />
          <button className="btn btn-raise" onClick={handleRaise}
                  disabled={!raiseAmount || Number(raiseAmount) < minRaise}>
            Raise
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Hand result popup ────────────────────────────────────────────────────────
function HandResult({ result, players, onDismiss }) {
  if (!result) return null;
  const winners = result.winners ?? [];

  return (
    <div className="hand-result-overlay" onClick={onDismiss}>
      <div className="hand-result-card" onClick={e => e.stopPropagation()}>
        <div className="result-title">Hand Complete</div>
        <div className="result-board">
          {result.board?.map((c, i) => <PlayingCard key={i} card={c} small />)}
        </div>
        {result.ranked?.map(r => (
          <div key={r.playerIdx} className={`result-row ${winners.includes(r.playerIdx) ? 'result-winner' : ''}`}>
            <span>{players?.[r.playerIdx]?.name ?? `P${r.playerIdx}`}</span>
            <span className="result-hand">{r.handName}</span>
            {winners.includes(r.playerIdx) && (
              <span className="result-pot">+{formatChips(result.payouts?.[r.playerIdx] ?? 0)}</span>
            )}
          </div>
        ))}
        <button className="btn btn-dismiss" onClick={onDismiss}>Continue</button>
      </div>
    </div>
  );
}

// ─── Main table ───────────────────────────────────────────────────────────────
export function PokerTable({
  gameState, holeCards, isMyTurn, myPlayerIdx,
  canCheck, toCall, minRaise,
  onFold, onCheck, onCall, onRaise, onAllIn,
  lastAction,
}) {
  const [showResult, setShowResult] = useState(null);

  useEffect(() => {
    if (lastAction?.type === 'hand_complete') {
      setShowResult(lastAction);
    }
  }, [lastAction]);

  const players = gameState?.players ?? [];
  const board   = gameState?.board   ?? [];
  const pot     = gameState?.pot     ?? '0';
  const street  = gameState?.state   ?? '';
  const actIdx  = gameState?.actionIdx ?? -1;

  // Seat positions around the table (for up to 6 players)
  const positions = ['bottom', 'bottom-right', 'right', 'top', 'top-left', 'left'];

  const myPlayer = myPlayerIdx >= 0 ? players[myPlayerIdx] : null;

  return (
    <div className="poker-table-wrapper">
      {/* Felt */}
      <div className="felt">
        {/* Seats */}
        {positions.map((pos, i) => {
          const player = players[i];
          return (
            <PlayerSeat
              key={i}
              player={player}
              isActive={actIdx === i}
              isMe={i === myPlayerIdx}
              holeCards={i === myPlayerIdx ? holeCards : null}
              position={pos}
            />
          );
        })}

        {/* Center info */}
        <div className="felt-center">
          <CommunityCards board={board} />
          <div className="pot-display">
            <span className="pot-label">Pot</span>
            <span className="pot-amount">{formatChips(pot)}</span>
          </div>
          {street && street !== 'WAITING' && (
            <div className="street-badge">{street}</div>
          )}
        </div>
      </div>

      {/* Action panel */}
      <ActionPanel
        isMyTurn={isMyTurn}
        canCheck={canCheck}
        toCall={toCall}
        myChips={myPlayer?.chips}
        minRaise={minRaise}
        onFold={onFold}
        onCheck={onCheck}
        onCall={onCall}
        onRaise={onRaise}
        onAllIn={onAllIn}
      />

      {/* Hand result overlay */}
      {showResult && (
        <HandResult
          result={showResult}
          players={players}
          onDismiss={() => setShowResult(null)}
        />
      )}
    </div>
  );
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function formatChips(raw) {
  const n = Number(raw ?? 0);
  if (n >= 1000) return `${(n / 100).toFixed(0)}`;
  return String(n);
}
