import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "./components/ui/button";
import { Card, CardContent } from "./components/ui/card";

// ---- Tunables ---- //
const GRID_COLS = 28;
const GRID_ROWS = 20;
const CELL = 22;
const BORDER = 2;
const START_SPEED_MS = 140;
const MIN_SPEED_MS = 60;
const TIME_LIMIT_S = 75;
const OBSTACLE_INTERVAL_TICKS = 18;
const MAX_OBSTACLES = 40;
const POISON_INTERVAL_TICKS = 23;

// Directions
const DIRS = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  z: { x: 0, y: -1 },
  s: { x: 0, y: 1 },
  q: { x: -1, y: 0 },
  d: { x: 1, y: 0 },
} as const;

type Vec = { x: number; y: number };
type GameState =
  | { phase: "idle" | "running"; code?: string }
  | { phase: "gameover"; code: string; reason: "hit" | "timeout" };

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const scoreRef = useRef<number>(0);

  const [state, setState] = useState<GameState>({ phase: "idle" });
  const [tickMs, setTickMs] = useState(START_SPEED_MS);
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT_S);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState<number>(() =>
    Number(localStorage.getItem("snake.best") || 0)
  );

  // Ref pour phase (évite le stale state dans requestAnimationFrame)
  const phaseRef = useRef<GameState["phase"]>("idle");
  useEffect(() => {
    phaseRef.current = state.phase;
  }, [state.phase]);

  const gridSize = useMemo(
    () => ({
      w: GRID_COLS,
      h: GRID_ROWS,
      pxW: GRID_COLS * CELL + BORDER * 2,
      pxH: GRID_ROWS * CELL + BORDER * 2,
    }),
    []
  );

  const snakeRef = useRef<Vec[]>([]);
  const dirRef = useRef<Vec>({ x: 1, y: 0 });
  const nextDirRef = useRef<Vec>({ x: 1, y: 0 });

  const foodRef = useRef<Vec | null>(null);
  const poisonRef = useRef<Vec | null>(null);
  const obstaclesRef = useRef<Set<string>>(new Set());

  const lastTickRef = useRef<number>(0);
  const lastSecondRef = useRef<number>(0);
  const tickCountRef = useRef<number>(0);

  const touchRef = useRef<Vec | null>(null);

  const key = (v: Vec) => `${v.x},${v.y}`;
  const within = (v: Vec) =>
    v.x >= 0 && v.x < GRID_COLS && v.y >= 0 && v.y < GRID_ROWS;

  const randomEmptyCell = (): Vec => {
    let v: Vec;
    const occupied = new Set<string>();
    snakeRef.current.forEach((s) => occupied.add(key(s)));
    obstaclesRef.current.forEach((k) => occupied.add(k));
    if (foodRef.current) occupied.add(key(foodRef.current));
    if (poisonRef.current) occupied.add(key(poisonRef.current));
    do {
      v = {
        x: Math.floor(Math.random() * GRID_COLS),
        y: Math.floor(Math.random() * GRID_ROWS),
      };
    } while (occupied.has(key(v)));
    return v;
  };

  const start = () => {
    const cx = Math.floor(GRID_COLS / 2);
    const cy = Math.floor(GRID_ROWS / 2);
    snakeRef.current = [
      { x: cx - 1, y: cy },
      { x: cx - 2, y: cy },
      { x: cx - 3, y: cy },
      { x: cx - 4, y: cy },
    ];
    dirRef.current = { x: 1, y: 0 };
    nextDirRef.current = { x: 1, y: 0 };

    obstaclesRef.current.clear();
    for (let i = 0; i < GRID_COLS; i++) {
      if (i % 3 === 0) obstaclesRef.current.add(key({ x: i, y: 0 }));
      if (i % 4 === 0)
        obstaclesRef.current.add(key({ x: i, y: GRID_ROWS - 1 }));
    }
    for (let j = 0; j < GRID_ROWS; j++) {
      if (j % 3 === 0) obstaclesRef.current.add(key({ x: 0, y: j }));
      if (j % 4 === 0)
        obstaclesRef.current.add(key({ x: GRID_COLS - 1, y: j }));
    }

    foodRef.current = randomEmptyCell();
    poisonRef.current = null;

    setScore(0);
    scoreRef.current = 0;
    setTickMs(START_SPEED_MS);
    setTimeLeft(TIME_LIMIT_S);
    tickCountRef.current = 0;
    lastTickRef.current = 0;
    lastSecondRef.current = 0;

    setState({ phase: "running" });
    loop();
  };

  const loop = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(step);
  };

  const step = (t: number) => {
    if (phaseRef.current !== "running") return;
    if (!lastTickRef.current) lastTickRef.current = t;
    if (!lastSecondRef.current) lastSecondRef.current = t;

    const dtSec = (t - lastSecondRef.current) / 1000;
    if (dtSec >= 1) {
      setTimeLeft((prev) => {
        const nxt = Math.max(0, prev - Math.floor(dtSec));
        if (nxt === 0) endGame("timeout");
        return nxt;
      });
      lastSecondRef.current = t;
    }

    const dt = t - lastTickRef.current;
    if (dt >= tickMs) {
      tick();
      lastTickRef.current = t;
    }

    draw();
    rafRef.current = requestAnimationFrame(step);
  };

  const endGame = (reason: "hit" | "timeout") => {
    const finalScore = scoreRef.current;
    const elapsed = TIME_LIMIT_S - timeLeft;
    const code = makeCode(finalScore, elapsed);

    setBest((b) => {
      const nb = Math.max(b, finalScore);
      localStorage.setItem("snake.best", String(nb));
      return nb;
    });

    setState({ phase: "gameover", code, reason });
  };

  const accel = () => {
    setTickMs((ms) => Math.max(MIN_SPEED_MS, Math.floor(ms - 4)));
  };

  const tick = () => {
    dirRef.current = validateTurn(dirRef.current, nextDirRef.current);

    const head = { ...snakeRef.current[0] };
    head.x += dirRef.current.x;
    head.y += dirRef.current.y;

    if (
      !within(head) ||
      obstaclesRef.current.has(key(head)) ||
      snakeRef.current.some((s) => s.x === head.x && s.y === head.y)
    ) {
      endGame("hit");
      return;
    }

    snakeRef.current.unshift(head);

    let grew = false;
    if (
      foodRef.current &&
      head.x === foodRef.current.x &&
      head.y === foodRef.current.y
    ) {
      setScore((s) => {
        const newScore = s + 5;
        scoreRef.current = newScore;
        return newScore;
      });
      foodRef.current = randomEmptyCell();
      grew = true;
      accel();
    }
    if (
      poisonRef.current &&
      head.x === poisonRef.current.x &&
      head.y === poisonRef.current.y
    ) {
      setScore((s) => {
        const newScore = s - 7;
        scoreRef.current = newScore;
        return newScore;
      });
      setTickMs((ms) => Math.max(MIN_SPEED_MS, Math.floor(ms - 8)));
      poisonRef.current = null;
    }

    if (!grew) snakeRef.current.pop();

    tickCountRef.current++;
    if (
      tickCountRef.current % OBSTACLE_INTERVAL_TICKS === 0 &&
      obstaclesRef.current.size < MAX_OBSTACLES
    ) {
      const o = randomEmptyCell();
      obstaclesRef.current.add(key(o));
    }
    if (tickCountRef.current % POISON_INTERVAL_TICKS === 0) {
      poisonRef.current = Math.random() < 0.6 ? randomEmptyCell() : null;
    }
  };

  const validateTurn = (cur: Vec, next: Vec) => {
    if (cur.x === -next.x && cur.y === -next.y) return cur;
    return next;
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#09090b";
    ctx.fillRect(0, 0, gridSize.pxW, gridSize.pxH);

    ctx.fillStyle = "#18181b";
    ctx.fillRect(BORDER, BORDER, GRID_COLS * CELL, GRID_ROWS * CELL);

    ctx.fillStyle = "#3f3f46";
    obstaclesRef.current.forEach((k) => {
      const [x, y] = k.split(",").map(Number);
      ctx.fillRect(BORDER + x * CELL, BORDER + y * CELL, CELL, CELL);
    });

    if (poisonRef.current) {
      const p = poisonRef.current;
      ctx.fillStyle = "#ef4444";
      ctx.fillRect(BORDER + p.x * CELL, BORDER + p.y * CELL, CELL, CELL);
    }

    if (foodRef.current) {
      const f = foodRef.current;
      ctx.fillStyle = "#22c55e";
      ctx.fillRect(BORDER + f.x * CELL, BORDER + f.y * CELL, CELL, CELL);
    }

    for (let i = 0; i < snakeRef.current.length; i++) {
      const s = snakeRef.current[i];
      ctx.fillStyle = i === 0 ? "#60a5fa" : "#bfdbfe";
      ctx.fillRect(BORDER + s.x * CELL, BORDER + s.y * CELL, CELL, CELL);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key in DIRS) {
        e.preventDefault();
        nextDirRef.current = DIRS[e.key as keyof typeof DIRS];
      }
      if (
        phaseRef.current !== "running" &&
        (e.key === " " || e.key === "Enter")
      ) {
        start();
      }
    };
    window.addEventListener("keydown", onKey, { passive: false });
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const onStart = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      touchRef.current = { x: t.clientX, y: t.clientY };
    };
    const onEnd = (e: TouchEvent) => {
      const start = touchRef.current;
      if (!start) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      const ax = Math.abs(dx);
      const ay = Math.abs(dy);
      if (ax > 24 || ay > 24) {
        if (ax > ay)
          nextDirRef.current = dx > 0 ? DIRS.ArrowRight : DIRS.ArrowLeft;
        else nextDirRef.current = dy > 0 ? DIRS.ArrowDown : DIRS.ArrowUp;
      }
    };
    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchend", onEnd);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    canvas.width = gridSize.pxW * dpr;
    canvas.height = gridSize.pxH * dpr;
    canvas.style.width = gridSize.pxW + "px";
    canvas.style.height = gridSize.pxH + "px";
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }, [gridSize.pxW, gridSize.pxH]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const makeCode = (scoreVal: number, elapsedSec: number) => {
    return scoreVal >= 100 ? "4712" : "Code non débloqué";
  };

  const progressPct = Math.round(
    ((TIME_LIMIT_S - timeLeft) / TIME_LIMIT_S) * 100
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 text-white px-4">
      <Card
        className={`w-full max-w-4xl p-6 border-4 rounded-2xl transition-all duration-500 ${
          state.phase === "running"
            ? "border-blue-400"
            : state.phase === "gameover"
            ? "border-red-400"
            : "border-zinc-700"
        } bg-zinc-900/70 backdrop-blur`}
      >
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h1 className="text-2xl font-bold tracking-wide">
              🐍 Snake HARDCORE
            </h1>
            <div className="flex items-center gap-3 text-sm">
              <span className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700">
                Score: <b>{score}</b>
              </span>
              <span className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700">
                Record: <b>{best}</b>
              </span>
              <span
                className={`px-2 py-1 rounded border ${
                  timeLeft <= 10
                    ? "bg-red-900/60 border-red-600"
                    : "bg-zinc-800 border-zinc-700"
                }`}
              >
                ⏱️ Temps: <b>{timeLeft}s</b>
              </span>
              <span className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700">
                Vitesse: <b>{tickMs}ms</b>
              </span>
            </div>
          </div>

          <div className="w-full">
            <div
              className="h-2 bg-zinc-800"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <div className="flex items-start gap-6 flex-wrap">
            <div className="rounded-xl border border-zinc-700 bg-zinc-950/60 p-2 shadow-inner">
              <canvas
                ref={canvasRef}
                className="rounded-md block"
                width={gridSize.pxW}
                height={gridSize.pxH}
              />
            </div>

            <div className="flex-1 min-w-[240px] space-y-3">
              {state.phase === "idle" && (
                <div className="space-y-3">
                  <p className="text-sm text-zinc-300">
                    Règles: 1 vie, Mange la nourriture verte, évite le poison
                    rouge. Les touches <b>↑↓←→</b> ou <b>ZQSD</b>. Fin de partie
                    en {TIME_LIMIT_S}s ou en cas d'impact.
                  </p>
                  <Button onClick={start} className="w-full">
                    🚀 Démarrer
                  </Button>
                </div>
              )}

              {state.phase === "running" && (
                <div className="space-y-3 text-sm text-zinc-300">
                  <p>
                    Atteignez le score de 100 pour débloquer le code secret !
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded border border-zinc-700 bg-zinc-900">
                      🟩 Nourriture: +5 points
                    </div>
                    <div className="p-2 rounded border border-zinc-700 bg-zinc-900">
                      🟥 Poison: −7 points
                    </div>
                    <div className="p-2 rounded border border-zinc-700 bg-zinc-900">
                      ⬛ Obstacles: mort
                    </div>
                    <div className="p-2 rounded border border-zinc-700 bg-zinc-900">
                      🧱 Bords: mort
                    </div>
                  </div>
                </div>
              )}

              {state.phase === "gameover" && (
                <div className="space-y-3">
                  <div className="text-red-400 font-semibold">
                    {state.reason === "timeout"
                      ? "⏰ Temps écoulé"
                      : "💥 Collision"}
                  </div>
                  <div className="text-green-400 text-lg font-bold">
                    CODE : {state.code}
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={start} className="flex-1">
                      🔁 Rejouer
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="text-xs text-zinc-400 text-center">
            Conseil: appuie sur{" "}
            <kbd className="px-1 py-0.5 bg-zinc-800 rounded border border-zinc-700">
              Entrée
            </kbd>{" "}
            pour (re)démarrer.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
