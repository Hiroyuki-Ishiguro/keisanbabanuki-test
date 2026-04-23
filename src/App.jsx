import React, { useEffect, useMemo, useState } from 'react';

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = [
  { label: 'A', value: 1 },
  { label: '2', value: 2 },
  { label: '3', value: 3 },
  { label: '4', value: 4 },
  { label: '5', value: 5 },
  { label: '6', value: 6 },
  { label: '7', value: 7 },
  { label: '8', value: 8 },
  { label: '9', value: 9 },
  { label: '10', value: 10 },
  { label: 'J', value: 11 },
  { label: 'Q', value: 12 },
  { label: 'K', value: 13 },
];

function buildDeck() {
  let id = 1;
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        id: id++,
        suit,
        rank: rank.label,
        value: rank.value,
        text: `${rank.label}${suit}`,
      });
    }
  }
  return deck;
}

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function rightNeighborIndex(current, players) {
  let idx = (current - 1 + players.length) % players.length;
  let guard = 0;
  while (players[idx].finished && guard < players.length) {
    idx = (idx - 1 + players.length) % players.length;
    guard += 1;
  }
  return idx;
}

function nextIndexInOrder(current, count) {
  return (current + 1) % count;
}

function isIntegerResult(n) {
  return Number.isInteger(n) && Number.isFinite(n);
}

function evaluatePair(a, b, op) {
  switch (op) {
    case '+':
      return a + b;
    case '-':
      return a - b;
    case '*':
      return a * b;
    case '/':
      if (b === 0) return null;
      return a / b;
    case '^':
      return Math.pow(a, b);
    case '^-':
      return Math.pow(a, -b);
    default:
      return null;
  }
}

function createExpressionText(a, b, op) {
  const symbol = op === '*' ? '×' : op === '/' ? '÷' : op === '^' ? '^' : op === '^-' ? '^(-)' : op;
  return `${a} ${symbol} ${b}`;
}

function allowedOpsForMode(mode) {
  return mode === 'advanced' ? ['+', '-', '*', '/', '^', '^-'] : ['+', '-', '*', '/'];
}

function validateMove(cardA, cardB, op, target, mode) {
  if (!cardA || !cardB) {
    return { ok: false, message: '2枚選んでください。' };
  }
  if (cardA.id === cardB.id) {
    return { ok: false, message: '同じカードは2回使えません。' };
  }
  const allowedOps = allowedOpsForMode(mode);
  if (!allowedOps.includes(op)) {
    return { ok: false, message: 'そのモードでは使えない演算子です。' };
  }

  const result = evaluatePair(cardA.value, cardB.value, op);
  if (result === null) {
    return { ok: false, message: 'その計算はできません。' };
  }
  if (!isIntegerResult(result)) {
    return { ok: false, message: '整数にならない式は出せません。' };
  }
  if (result !== target) {
    return { ok: false, message: `その式は ${target} になりません。` };
  }

  return {
    ok: true,
    expression: `${createExpressionText(cardA.value, cardB.value, op)} = ${target}`,
  };
}

function sortHand(hand) {
  return [...hand].sort((x, y) => x.value - y.value || x.suit.localeCompare(y.suit));
}

function getValidStartConfigs() {
  const configs = [];
  for (let players = 3; players <= 6; players += 1) {
    for (let stock = 6; stock <= 10; stock += 1) {
      const remaining = 52 - stock;
      if (remaining % players === 0) {
        configs.push({ players, stock, handSize: remaining / players });
      }
    }
  }
  return configs;
}

function rankingText(players) {
  const active = [...players].sort((a, b) => {
    if (a.finished && !b.finished) return -1;
    if (!a.finished && b.finished) return 1;
    if (a.finished && b.finished) return a.finishOrder - b.finishOrder;
    return a.hand.length - b.hand.length;
  });
  return active.map((p, idx) => `${idx + 1}位: ${p.name}`).join(' / ');
}

function getNextActiveIndexFrom(start, players) {
  let idx = start;
  let guard = 0;
  while (players[idx].finished && guard < players.length) {
    idx = nextIndexInOrder(idx, players.length);
    guard += 1;
  }
  return idx;
}

function getNextNonFinishedAfter(current, players) {
  let idx = nextIndexInOrder(current, players.length);
  let guard = 0;
  while (players[idx].finished && guard < players.length) {
    idx = nextIndexInOrder(idx, players.length);
    guard += 1;
  }
  return idx;
}

function findPlayableMove(hand, target, mode) {
  const ops = allowedOpsForMode(mode);
  for (let i = 0; i < hand.length; i += 1) {
    for (let j = 0; j < hand.length; j += 1) {
      if (i === j) continue;
      for (const op of ops) {
        const result = validateMove(hand[i], hand[j], op, target, mode);
        if (result.ok) {
          return {
            cardA: hand[i],
            cardB: hand[j],
            op,
            expression: result.expression,
          };
        }
      }
    }
  }
  return null;
}

export default function App() {
  const configs = useMemo(() => getValidStartConfigs(), []);
  const [selectedConfigKey, setSelectedConfigKey] = useState(`${configs[0].players}-${configs[0].stock}`);
  const [playerNames, setPlayerNames] = useState(['あなた', 'CPU 1', 'CPU 2', 'CPU 3', 'CPU 4', 'CPU 5']);
  const [game, setGame] = useState(null);
  const [selectedCardIds, setSelectedCardIds] = useState([]);
  const [selectedOp, setSelectedOp] = useState('+');
  const [message, setMessage] = useState('設定を選んでゲームを始めてください。');
  const [hasDrawnThisTurn, setHasDrawnThisTurn] = useState(false);
  const [ruleMode, setRuleMode] = useState('normal');

  const selectedConfig = configs.find((c) => `${c.players}-${c.stock}` === selectedConfigKey);

  function appendLog(logs, text) {
    return [text, ...logs].slice(0, 24);
  }

  function markFinishIfNeeded(players, playerIndex, finishCount) {
    const nextPlayers = [...players];
    const player = { ...nextPlayers[playerIndex] };
    nextPlayers[playerIndex] = player;
    let nextFinishCount = finishCount;
    let text = null;

    if (!player.finished && player.hand.length === 0) {
      player.finished = true;
      player.finishOrder = finishCount + 1;
      nextFinishCount += 1;
      text = `${player.name} が上がりました。`;
    }

    return { nextPlayers, nextFinishCount, text };
  }

  function createRoundState(players, stock, stockIndex, logs, finishCount, startLeader = null) {
    const targetCard = stock[stockIndex] ?? null;
    if (!targetCard) {
      return {
        phase: 'ended',
        players,
        stock,
        stockIndex,
        targetCard: null,
        roundLeader: startLeader,
        currentPlayer: null,
        mode: 'ended',
        logs: appendLog(logs, '山札がなくなったためゲーム終了です。'),
        ruleMode,
        finishCount,
      };
    }

    const chosenLeader = startLeader ?? Math.floor(Math.random() * players.length);
    const leader = getNextActiveIndexFrom(chosenLeader, players);

    return {
      phase: 'turn',
      players,
      stock,
      stockIndex,
      targetCard,
      roundLeader: leader,
      currentPlayer: leader,
      mode: 'play',
      logs: appendLog(logs, `新しいお題は ${targetCard.text}（${targetCard.value}）。このラウンドの先頭は ${players[leader].name} です。`),
      finishCount,
      ruleMode,
    };
  }

  function startGame() {
    const deck = shuffle(buildDeck());
    const stock = deck.slice(0, selectedConfig.stock);
    const dealCards = deck.slice(selectedConfig.stock);
    const players = [];
    let index = 0;

    for (let i = 0; i < selectedConfig.players; i += 1) {
      const hand = sortHand(dealCards.slice(index, index + selectedConfig.handSize));
      index += selectedConfig.handSize;
      players.push({
        id: i,
        name: playerNames[i]?.trim() || (i === 0 ? 'あなた' : `CPU ${i}`),
        hand,
        finished: false,
        finishOrder: null,
        isCpu: i !== 0,
      });
    }

    const initialLeader = Math.floor(Math.random() * players.length);
    const initialState = createRoundState(
      players,
      stock,
      0,
      [`ゲーム開始。先頭プレイヤーは ${players[initialLeader].name} に決まりました。`],
      0,
      initialLeader,
    );

    setGame(initialState);
    setSelectedCardIds([]);
    setSelectedOp('+');
    setHasDrawnThisTurn(false);

    if (initialState.phase === 'ended') {
      setMessage('ゲーム終了です。順位を確認してください。スタート画面へ戻れます。');
    } else if (initialState.players[initialState.currentPlayer].isCpu) {
      setMessage(`お題は ${initialState.targetCard.value}。CPUが考えています。`);
    } else {
      setMessage(`お題は ${initialState.targetCard.value}。まず全員が出せるだけ出します。現在は ${initialState.players[initialState.currentPlayer].name} の番です。`);
    }
  }

  function finishGameIfNeeded(nextState) {
    const remainingActive = nextState.players.filter((p) => !p.finished).length;
    if (remainingActive <= 1) {
      return {
        ...nextState,
        phase: 'ended',
        mode: 'ended',
        currentPlayer: null,
        logs: appendLog(nextState.logs, '上がり順が決まったためゲーム終了です。'),
      };
    }
    return nextState;
  }

  function applyMove(state, playerIndex, move) {
    const nextPlayers = [...state.players];
    const player = { ...nextPlayers[playerIndex] };
    player.hand = sortHand(player.hand.filter((c) => c.id !== move.cardA.id && c.id !== move.cardB.id));
    nextPlayers[playerIndex] = player;

    const finishCheck = markFinishIfNeeded(nextPlayers, playerIndex, state.finishCount);

    let nextState = {
      ...state,
      players: finishCheck.nextPlayers,
      finishCount: finishCheck.nextFinishCount,
      logs: appendLog(state.logs, `${state.players[playerIndex].name} が ${move.expression} で ${move.cardA.text} と ${move.cardB.text} を出しました。`),
    };

    if (finishCheck.text) {
      nextState.logs = appendLog(nextState.logs, finishCheck.text);
    }

    return finishGameIfNeeded(nextState);
  }

  function advanceAfterPlayPhase(state) {
    const nextPlayerIndex = getNextNonFinishedAfter(state.currentPlayer, state.players);
    if (nextPlayerIndex === state.roundLeader) {
      return {
        ...state,
        mode: 'draw',
        currentPlayer: state.roundLeader,
        logs: appendLog(state.logs, '全員が出し終えたので、これから右隣から1枚引くフェーズに入ります。'),
      };
    }
    return {
      ...state,
      currentPlayer: nextPlayerIndex,
    };
  }

  function handleSelectCard(cardId) {
    if (!game || game.phase === 'ended') return;
    const currentPlayer = game.currentPlayer !== null ? game.players[game.currentPlayer] : null;
    if (!currentPlayer || currentPlayer.isCpu) return;

    setSelectedCardIds((prev) => {
      if (prev.includes(cardId)) return prev.filter((id) => id !== cardId);
      if (prev.length >= 2) return [prev[1], cardId];
      return [...prev, cardId];
    });
  }

  function handleSubmitMove() {
    if (!game || game.phase !== 'turn' || game.currentPlayer === null) return;
    const currentPlayer = game.players[game.currentPlayer];
    if (!currentPlayer || currentPlayer.isCpu) return;

    const target = game.targetCard?.value ?? null;
    const selectedCards = selectedCardIds.map((id) => currentPlayer.hand.find((c) => c.id === id)).filter(Boolean);
    const [cardA, cardB] = selectedCards;
    const result = validateMove(cardA, cardB, selectedOp, target, game.ruleMode);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }

    const nextState = applyMove(game, game.currentPlayer, {
      cardA,
      cardB,
      op: selectedOp,
      expression: result.expression,
    });

    setGame(nextState);
    setSelectedCardIds([]);
    if (game.mode === 'draw') setHasDrawnThisTurn(true);

    if (nextState.phase === 'ended') {
      setMessage('ゲーム終了です。順位を確認してください。スタート画面へ戻れます。');
      return;
    }

    if (game.mode === 'play') {
      setMessage('成立しました。同じお題で、まだ出せるなら続けて出してください。出し終えたら「この人は出し終えた」を押します。');
    } else {
      setMessage('成立しました。引いた直後に出せる1組を出しました。次は「この人の引き処理を終える」で進めてください。');
    }
  }

  function handleEndPlayForCurrentPlayer() {
    if (!game || game.phase !== 'turn' || game.mode !== 'play' || game.currentPlayer === null) return;
    const currentPlayer = game.players[game.currentPlayer];
    if (!currentPlayer || currentPlayer.isCpu) return;

    const nextState = advanceAfterPlayPhase(game);
    setGame(nextState);
    setSelectedCardIds([]);

    if (nextState.mode === 'draw') {
      setHasDrawnThisTurn(false);
      setMessage(`出すフェーズ終了。これから右隣から引きます。最初は ${nextState.players[nextState.currentPlayer].name} の引き処理です。`);
    } else if (nextState.players[nextState.currentPlayer].isCpu) {
      setMessage(`お題は ${nextState.targetCard.value} のままです。CPUが考えています。`);
    } else {
      setMessage(`お題は ${nextState.targetCard.value} のままです。次は ${nextState.players[nextState.currentPlayer].name} が出せるだけ出します。`);
    }
  }

  function handleDrawFromRight() {
    if (!game || game.phase !== 'turn' || game.mode !== 'draw' || game.currentPlayer === null) return;
    const currentPlayer = game.players[game.currentPlayer];
    if (!currentPlayer || currentPlayer.isCpu) return;
    if (hasDrawnThisTurn) {
      setMessage('この人はすでにこのラウンドで引いています。次へ進むには「この人の引き処理を終える」を押してください。');
      return;
    }

    const fromIndex = rightNeighborIndex(game.currentPlayer, game.players);
    const source = game.players[fromIndex];
    if (!source || source.finished || source.hand.length === 0) {
      setMessage('右隣のプレイヤーに引けるカードがありません。この人の引き処理を終えてください。');
      return;
    }

    const pickIndex = Math.floor(Math.random() * source.hand.length);
    const drawnCard = source.hand[pickIndex];
    const nextPlayers = [...game.players];
    const nextSource = { ...nextPlayers[fromIndex] };
    const nextCurrent = { ...nextPlayers[game.currentPlayer] };
    nextSource.hand = sortHand(nextSource.hand.filter((c) => c.id !== drawnCard.id));
    nextCurrent.hand = sortHand([...nextCurrent.hand, drawnCard]);
    nextPlayers[fromIndex] = nextSource;
    nextPlayers[game.currentPlayer] = nextCurrent;

    const sourceFinish = markFinishIfNeeded(nextPlayers, fromIndex, game.finishCount);
    let nextState = {
      ...game,
      players: sourceFinish.nextPlayers,
      finishCount: sourceFinish.nextFinishCount,
      logs: appendLog(game.logs, `${currentPlayer.name} が右隣の ${source.name} から1枚引きました（${drawnCard.text}）。`),
    };

    if (sourceFinish.text) nextState.logs = appendLog(nextState.logs, sourceFinish.text);
    nextState = finishGameIfNeeded(nextState);
    setGame(nextState);
    setSelectedCardIds([]);
    setHasDrawnThisTurn(true);

    if (nextState.phase === 'ended') {
      setMessage('ゲーム終了です。順位を確認してください。スタート画面へ戻れます。');
      return;
    }

    setMessage(`1枚引きました（${drawnCard.text}）。この直後は1組だけ出せます。出さない場合は「この人の引き処理を終える」を押してください。`);
  }

  function handleEndDrawForCurrentPlayer() {
    if (!game || game.phase !== 'turn' || game.mode !== 'draw' || game.currentPlayer === null) return;
    const currentPlayer = game.players[game.currentPlayer];
    if (!currentPlayer || currentPlayer.isCpu) return;

    const nextPlayerIndex = getNextNonFinishedAfter(game.currentPlayer, game.players);
    if (nextPlayerIndex === game.roundLeader) {
      const nextStockIndex = game.stockIndex + 1;
      const nextLeader = getNextNonFinishedAfter(game.roundLeader, game.players);
      const nextState = createRoundState(
        game.players,
        game.stock,
        nextStockIndex,
        appendLog(game.logs, `${currentPlayer.name} の引き処理が終わりました。ラウンド終了です。`),
        game.finishCount,
        nextLeader,
      );
      setGame(nextState);
      setSelectedCardIds([]);
      setHasDrawnThisTurn(false);

      if (nextState.phase === 'ended') {
        setMessage('山札がなくなったためゲーム終了です。順位を確認してください。スタート画面へ戻れます。');
      } else if (nextState.players[nextState.currentPlayer].isCpu) {
        setMessage(`次のお題は ${nextState.targetCard.value}。CPUが考えています。`);
      } else {
        setMessage(`次のお題は ${nextState.targetCard.value}。先頭は ${nextState.players[nextState.currentPlayer].name} です。まず全員が出せるだけ出します。`);
      }
      return;
    }

    const nextState = {
      ...game,
      currentPlayer: nextPlayerIndex,
      logs: appendLog(game.logs, `${currentPlayer.name} の引き処理が終わりました。`),
    };
    setGame(nextState);
    setSelectedCardIds([]);
    setHasDrawnThisTurn(false);

    if (nextState.players[nextState.currentPlayer].isCpu) {
      setMessage('次はCPUの引き処理です。CPUが考えています。');
    } else {
      setMessage(`次は ${nextState.players[nextState.currentPlayer].name} が右隣から引きます。`);
    }
  }

  useEffect(() => {
    if (!game || game.phase !== 'turn' || game.currentPlayer === null) return undefined;
    const currentPlayer = game.players[game.currentPlayer];
    if (!currentPlayer || !currentPlayer.isCpu) return undefined;

    const timer = setTimeout(() => {
      const target = game.targetCard?.value ?? null;

      if (game.mode === 'play') {
        const move = findPlayableMove(currentPlayer.hand, target, game.ruleMode);
        if (move) {
          const nextState = applyMove(game, game.currentPlayer, move);
          setGame(nextState);
          if (nextState.phase === 'ended') {
            setMessage('ゲーム終了です。順位を確認してください。スタート画面へ戻れます。');
          } else {
            setMessage(`${currentPlayer.name} が式を見つけました。さらに出せるか考えています。`);
          }
        } else {
          const nextState = advanceAfterPlayPhase(game);
          setGame(nextState);
          setHasDrawnThisTurn(false);
          if (nextState.mode === 'draw') {
            setMessage(`全員が出し終えました。これから ${nextState.players[nextState.currentPlayer].name} から引きフェーズです。`);
          } else {
            setMessage(`${currentPlayer.name} は出し終えました。次は ${nextState.players[nextState.currentPlayer].name} の番です。`);
          }
        }
        return;
      }

      if (!hasDrawnThisTurn) {
        const fromIndex = rightNeighborIndex(game.currentPlayer, game.players);
        const source = game.players[fromIndex];
        if (!source || source.finished || source.hand.length === 0) {
          setHasDrawnThisTurn(true);
          setMessage(`${currentPlayer.name} は引ける相手がいません。引き処理を終えます。`);
          return;
        }

        const pickIndex = Math.floor(Math.random() * source.hand.length);
        const drawnCard = source.hand[pickIndex];
        const nextPlayers = [...game.players];
        const nextSource = { ...nextPlayers[fromIndex] };
        const nextCurrent = { ...nextPlayers[game.currentPlayer] };
        nextSource.hand = sortHand(nextSource.hand.filter((c) => c.id !== drawnCard.id));
        nextCurrent.hand = sortHand([...nextCurrent.hand, drawnCard]);
        nextPlayers[fromIndex] = nextSource;
        nextPlayers[game.currentPlayer] = nextCurrent;

        const sourceFinish = markFinishIfNeeded(nextPlayers, fromIndex, game.finishCount);
        let nextState = {
          ...game,
          players: sourceFinish.nextPlayers,
          finishCount: sourceFinish.nextFinishCount,
          logs: appendLog(game.logs, `${currentPlayer.name} が右隣の ${source.name} から1枚引きました（${drawnCard.text}）。`),
        };
        if (sourceFinish.text) nextState.logs = appendLog(nextState.logs, sourceFinish.text);
        nextState = finishGameIfNeeded(nextState);
        setGame(nextState);
        setHasDrawnThisTurn(true);

        if (nextState.phase === 'ended') {
          setMessage('ゲーム終了です。順位を確認してください。スタート画面へ戻れます。');
          return;
        }

        const move = findPlayableMove(nextState.players[game.currentPlayer].hand, target, game.ruleMode);
        if (move) {
          const afterMove = applyMove(nextState, game.currentPlayer, move);
          setGame(afterMove);
          if (afterMove.phase === 'ended') {
            setMessage('ゲーム終了です。順位を確認してください。スタート画面へ戻れます。');
          } else {
            setMessage(`${currentPlayer.name} は引いた直後に1組出しました。`);
          }
        } else {
          setMessage(`${currentPlayer.name} は1枚引きました。引き処理を終えます。`);
        }
        return;
      }

      const nextPlayerIndex = getNextNonFinishedAfter(game.currentPlayer, game.players);
      if (nextPlayerIndex === game.roundLeader) {
        const nextStockIndex = game.stockIndex + 1;
        const nextLeader = getNextNonFinishedAfter(game.roundLeader, game.players);
        const nextState = createRoundState(
          game.players,
          game.stock,
          nextStockIndex,
          appendLog(game.logs, `${currentPlayer.name} の引き処理が終わりました。ラウンド終了です。`),
          game.finishCount,
          nextLeader,
        );
        setGame(nextState);
        setHasDrawnThisTurn(false);
        if (nextState.phase === 'ended') {
          setMessage('山札がなくなったためゲーム終了です。順位を確認してください。スタート画面へ戻れます。');
        } else if (nextState.players[nextState.currentPlayer].isCpu) {
          setMessage(`次のお題は ${nextState.targetCard.value}。CPUが考えています。`);
        } else {
          setMessage(`次のお題は ${nextState.targetCard.value}。あなたの番です。`);
        }
      } else {
        const nextState = {
          ...game,
          currentPlayer: nextPlayerIndex,
          logs: appendLog(game.logs, `${currentPlayer.name} の引き処理が終わりました。`),
        };
        setGame(nextState);
        setHasDrawnThisTurn(false);
        if (nextState.players[nextState.currentPlayer].isCpu) {
          setMessage(`次は ${nextState.players[nextState.currentPlayer].name} の引き処理です。`);
        } else {
          setMessage('次はあなたの引き処理です。');
        }
      }
    }, 700);

    return () => clearTimeout(timer);
  }, [game, hasDrawnThisTurn]);

  if (!game) {
    return (
      <div className="page">
        <div className="app shell">
          <section className="panel">
            <div className="panel-header">
              <h1>計算ババ抜き 公開版</h1>
            </div>
            <div className="panel-body stack-lg">
              <div className="stack-sm">
                <label className="label">開始設定</label>
                <div className="choice-grid two-cols">
                  {configs.map((config) => {
                    const key = `${config.players}-${config.stock}`;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSelectedConfigKey(key)}
                        className={`choice-card ${selectedConfigKey === key ? 'selected dark' : ''}`}
                      >
                        <div className="choice-title">{config.players}人 / 山札{config.stock}枚</div>
                        <div className="choice-sub">手札 {config.handSize} 枚ずつ</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <hr className="sep" />

              <div className="stack-sm">
                <label className="label">ルールモード</label>
                <div className="choice-grid two-cols">
                  <button type="button" onClick={() => setRuleMode('normal')} className={`choice-card ${ruleMode === 'normal' ? 'selected dark' : ''}`}>
                    <div className="choice-title">通常モード</div>
                    <div className="choice-sub">四則計算のみ</div>
                  </button>
                  <button type="button" onClick={() => setRuleMode('advanced')} className={`choice-card ${ruleMode === 'advanced' ? 'selected dark' : ''}`}>
                    <div className="choice-title">アドバンスモード</div>
                    <div className="choice-sub">累乗 ^ と負の累乗 ^- を追加</div>
                  </button>
                </div>
              </div>

              <div className="stack-sm">
                <label className="label">プレイヤー名（1人目があなた、2人目以降はCPU）</label>
                <div className="name-grid">
                  {Array.from({ length: selectedConfig.players }).map((_, i) => (
                    <div key={i} className="stack-xs">
                      <label className="field-label" htmlFor={`player-${i}`}>{i === 0 ? 'あなた' : `CPU ${i}`}</label>
                      <input
                        id={`player-${i}`}
                        className="text-input"
                        value={playerNames[i]}
                        onChange={(e) => {
                          const next = [...playerNames];
                          next[i] = e.target.value;
                          setPlayerNames(next);
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="notice">1人目が人間プレイヤー、2人目以降はCPUです。通常モードでは四則計算、アドバンスモードでは累乗 ^ と負の累乗 ^- も使えます。</div>

              <button type="button" className="primary-btn" onClick={startGame}>ゲーム開始</button>
            </div>
          </section>
        </div>
      </div>
    );
  }

  const currentPlayer = game.currentPlayer !== null ? game.players[game.currentPlayer] : null;
  const selectedCards = currentPlayer ? selectedCardIds.map((id) => currentPlayer.hand.find((c) => c.id === id)).filter(Boolean) : [];
  const isHumanTurn = currentPlayer && !currentPlayer.isCpu && game.phase !== 'ended';
  const ranking = rankingText(game.players);

  return (
    <div className="page">
      <div className="app main-grid">
        <div className="stack-lg">
          <section className="panel">
            <div className="panel-header row-between wrap gap-md">
              <h1>計算ババ抜き</h1>
              <button
                type="button"
                className="ghost-btn"
                onClick={() => {
                  setGame(null);
                  setSelectedCardIds([]);
                  setHasDrawnThisTurn(false);
                  setMessage('設定を選んでゲームを始めてください。');
                }}
              >
                スタート画面へ戻る
              </button>
            </div>
            <div className="panel-body stack-md">
              <div className="status-grid">
                <div className="target-card">
                  <div className="meta-label">今回のお題</div>
                  <div className="target-row">
                    <div className="target-number">{game.targetCard?.value ?? '-'}</div>
                    <div className="target-text">{game.targetCard?.text ?? 'なし'}</div>
                  </div>
                </div>

                <div className="mini-grid">
                  <div className="mini-card">
                    <div className="meta-label">お題番号</div>
                    <div className="mini-value">{game.stockIndex + 1} / {game.stock.length}</div>
                  </div>
                  <div className="mini-card">
                    <div className="meta-label">山札残り</div>
                    <div className="mini-value">{Math.max(game.stock.length - game.stockIndex - 1, 0)}</div>
                  </div>
                  <div className="mini-card phase-card dark-card">
                    <div className="meta-label light">フェーズ</div>
                    <div className="phase-value">{game.mode === 'play' ? '出す' : game.mode === 'draw' ? '引く' : '終了'}</div>
                  </div>
                  <div className="mini-card wide-card">
                    <div className="meta-label">現在のプレイヤー</div>
                    <div className="mini-value player-now">{currentPlayer?.name ?? '-'}</div>
                  </div>
                </div>
              </div>

              <div className="notice">{message}</div>
              {game.phase === 'ended' && <div className="notice success">最終順位: {ranking}</div>}
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <h2>{currentPlayer?.name ?? '-'} の手札</h2>
            </div>
            <div className="panel-body stack-md">
              {game.phase !== 'ended' && currentPlayer ? (
                <>
                  {currentPlayer.isCpu ? (
                    <div className="info-box">CPUの手番です。CPUが自動で進めます。</div>
                  ) : (
                    <div className="hand-grid">
                      {currentPlayer.hand.map((card) => {
                        const selected = selectedCardIds.includes(card.id);
                        return (
                          <button
                            key={card.id}
                            type="button"
                            onClick={() => handleSelectCard(card.id)}
                            className={`hand-card ${selected ? 'selected dark' : ''}`}
                          >
                            <div className="hand-card-title">{card.text}</div>
                            <div className="hand-card-sub">数値: {card.value}</div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="formula-box">
                    <div className="formula-title">式を作る</div>
                    <div className="formula-row wrap gap-md">
                      <div className="pill">1枚目: {selectedCards[0]?.text ?? '未選択'}</div>
                      <select
                        value={selectedOp}
                        onChange={(e) => setSelectedOp(e.target.value)}
                        className="select-input"
                        disabled={!isHumanTurn}
                      >
                        <option value="+">＋</option>
                        <option value="-">－</option>
                        <option value="*">×</option>
                        <option value="/">÷</option>
                        {game.ruleMode === 'advanced' && (
                          <>
                            <option value="^">^</option>
                            <option value="^-">^-</option>
                          </>
                        )}
                      </select>
                      <div className="pill">2枚目: {selectedCards[1]?.text ?? '未選択'}</div>
                    </div>

                    <div className="btn-row wrap gap-md">
                      <button type="button" className="primary-btn" onClick={handleSubmitMove} disabled={!isHumanTurn}>この2枚を出す</button>

                      {game.mode === 'play' ? (
                        <button type="button" className="secondary-btn" onClick={handleEndPlayForCurrentPlayer} disabled={!isHumanTurn}>この人は出し終えた</button>
                      ) : (
                        <>
                          <button type="button" className="ghost-btn" onClick={handleDrawFromRight} disabled={!isHumanTurn || hasDrawnThisTurn}>右の人から1枚引く</button>
                          <button type="button" className="secondary-btn" onClick={handleEndDrawForCurrentPlayer} disabled={!isHumanTurn}>この人の引き処理を終える</button>
                        </>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="muted">ゲームは終了しました。スタート画面へ戻ると新しく遊べます。</div>
              )}
            </div>
          </section>
        </div>

        <div className="stack-lg">
          <section className="panel">
            <div className="panel-header"><h2>プレイヤー状況</h2></div>
            <div className="panel-body stack-sm">
              {game.players.map((player, idx) => (
                <div key={player.id} className="player-card">
                  <div className="row-between wrap gap-md">
                    <div className="row gap-sm strong wrap">
                      {player.finished && <span className="crown">👑</span>}
                      <span>{player.name}</span>
                      {player.isCpu && <span className="tag">CPU</span>}
                    </div>
                    <div className="row gap-sm wrap">
                      {idx === game.currentPlayer && game.phase !== 'ended' && <span className="tag solid">現在</span>}
                      {idx === game.roundLeader && game.phase !== 'ended' && <span className="tag">先頭</span>}
                      {player.finished && <span className="tag winner">上がり</span>}
                    </div>
                  </div>
                  <div className="player-count">手札 {player.hand.length} 枚</div>
                  <div className="chips">
                    {player.isCpu && !player.finished ? (
                      Array.from({ length: player.hand.length }).map((_, i) => <span key={i} className="chip">?</span>)
                    ) : (
                      player.hand.map((card) => <span key={card.id} className="chip">{card.text}</span>)
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel-header"><h2>進行ログ</h2></div>
            <div className="panel-body stack-sm">
              {game.logs.map((log, i) => (
                <div key={i} className="log-item">{log}</div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
