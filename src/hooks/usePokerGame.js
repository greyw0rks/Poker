/**
 * hooks/usePokerGame.js
 *
 * Manages the full Socket.io connection and game state.
 * Consumes events from the backend and exposes clean state + actions.
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';

const SERVER_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

const INITIAL_STATE = {
  tableId:     null,
  gameState:   null,   // { state, board, pot, currentBet, actionIdx, players }
  holeCards:   [],     // ['As', 'Kd']
  handHistory: [],
  lobbyTimer:  null,   // { secondsLeft, startsAt }
  phase:       'idle', // idle | lobby | playing | finished
  error:       null,
  lastAction:  null,
  tableList:   [],
};

export function usePokerGame(address) {
  const [state,    setState]    = useState(INITIAL_STATE);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef  = useRef(null);
  const timerRef   = useRef(null);

  // ── Connect socket ────────────────────────────────────────────────────────
  useEffect(() => {
    const socket = io(SERVER_URL, { autoConnect: true });
    socketRef.current = socket;

    socket.on('connect',    () => { setIsConnected(true); });
    socket.on('disconnect', () => { setIsConnected(false); });

    socket.on('table_list', (tables) => {
      setState(s => ({ ...s, tableList: tables }));
    });

    socket.on('player_joined', (data) => {
      setState(s => ({ ...s, lastAction: { type: 'player_joined', ...data } }));
    });

    socket.on('lobby_timer', ({ tableId, secondsLeft, startsAt }) => {
      setState(s => ({ ...s, lobbyTimer: { secondsLeft, startsAt } }));
      // Start client-side countdown
      clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setState(s => {
          if (!s.lobbyTimer) return s;
          const left = Math.max(0, Math.round((s.lobbyTimer.startsAt - Date.now()) / 1000));
          return { ...s, lobbyTimer: { ...s.lobbyTimer, secondsLeft: left } };
        });
      }, 1000);
    });

    socket.on('game_started', (data) => {
      clearInterval(timerRef.current);
      setState(s => ({ ...s, phase: 'playing', lobbyTimer: null, lastAction: { type: 'game_started', ...data } }));
    });

    socket.on('game_state', ({ tableId, state: gameState }) => {
      setState(s => ({ ...s, gameState }));
    });

    socket.on('hand_started', (data) => {
      setState(s => ({
        ...s,
        holeCards:   [],
        lastAction:  { type: 'hand_started', ...data },
      }));
    });

    socket.on('hole_cards', ({ cards }) => {
      setState(s => ({ ...s, holeCards: cards }));
    });

    socket.on('street_dealt', (data) => {
      setState(s => ({ ...s, lastAction: { type: 'street_dealt', ...data } }));
    });

    socket.on('player_action', (data) => {
      setState(s => ({ ...s, lastAction: { type: 'player_action', ...data } }));
    });

    socket.on('action_timeout', (data) => {
      setState(s => ({ ...s, lastAction: { type: 'action_timeout', ...data } }));
    });

    socket.on('hand_complete', (data) => {
      setState(s => ({
        ...s,
        handHistory: [...s.handHistory.slice(-19), data],
        lastAction:  { type: 'hand_complete', ...data },
      }));
    });

    socket.on('table_finished', (data) => {
      setState(s => ({ ...s, phase: 'finished', lastAction: { type: 'table_finished', ...data } }));
    });

    socket.on('error', ({ message }) => {
      setState(s => ({ ...s, error: message }));
      setTimeout(() => setState(s => ({ ...s, error: null })), 4000);
    });

    socket.on('join_ok', ({ tableId, chips, tableState }) => {
      setState(s => ({
        ...s,
        tableId,
        phase:     'lobby',
        gameState: tableState?.gameState ?? null,
      }));
    });

    // Request table list on connect
    socket.emit('get_state', {});

    return () => {
      clearInterval(timerRef.current);
      socket.disconnect();
    };
  }, []);

  // ── Actions ───────────────────────────────────────────────────────────────

  const joinTable = useCallback(({ tableId, name, buyInUSD }) => {
    if (!socketRef.current || !address) return;
    socketRef.current.join?.(tableId); // handled server-side
    socketRef.current.emit('join_table', { tableId, name, address, buyInUSD });
  }, [address]);

  const sendAction = useCallback((type, amount) => {
    if (!socketRef.current || !state.tableId) return;
    const payload = { tableId: state.tableId, type };
    if (amount !== undefined) payload.amount = String(amount);
    socketRef.current.emit('action', payload);
  }, [state.tableId]);

  const fold   = useCallback(() => sendAction('fold'),  [sendAction]);
  const check  = useCallback(() => sendAction('check'), [sendAction]);
  const call   = useCallback(() => sendAction('call'),  [sendAction]);
  const allIn  = useCallback(() => sendAction('allin'), [sendAction]);
  const raise  = useCallback((chips) => sendAction('raise', chips), [sendAction]);

  const requestTables = useCallback(() => {
    socketRef.current?.emit('get_state', {});
    fetch(`${SERVER_URL}/tables`)
      .then(r => r.json())
      .then(tables => setState(s => ({ ...s, tableList: tables })))
      .catch(() => {});
  }, []);

  const requestState = useCallback(() => {
    if (state.tableId) {
      socketRef.current?.emit('get_state', { tableId: state.tableId });
      socketRef.current?.emit('get_cards', { tableId: state.tableId });
    }
  }, [state.tableId]);

  // ── Derived helpers ───────────────────────────────────────────────────────

  const myPlayerIdx = state.gameState?.players?.findIndex(
    p => p.address?.toLowerCase() === address?.toLowerCase()
  ) ?? -1;

  const isMyTurn = state.gameState?.actionIdx === myPlayerIdx && myPlayerIdx >= 0;

  const myPlayer = myPlayerIdx >= 0 ? state.gameState?.players?.[myPlayerIdx] : null;

  const toCall = (() => {
    if (!state.gameState || myPlayerIdx < 0) return 0;
    const curBet = Number(state.gameState.currentBet);
    const myBet  = Number(myPlayer?.bet ?? 0);
    return Math.max(0, curBet - myBet);
  })();

  const canCheck = toCall === 0;

  const minRaise = (() => {
    if (!state.gameState) return 0;
    const bb = 2; // chips — matches backend bigBlind
    const curBet = Number(state.gameState.currentBet);
    return curBet + Math.max(bb, curBet); // min-raise = 2x current bet
  })();

  return {
    // State
    ...state,
    isConnected,
    myPlayerIdx,
    myPlayer,
    isMyTurn,
    toCall,
    canCheck,
    minRaise,
    // Actions
    joinTable,
    fold, check, call, allIn, raise,
    requestTables,
    requestState,
  };
}
