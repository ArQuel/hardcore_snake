import { useState, useEffect, useRef } from "react";
import { Button } from "./components/ui/button";
import { Card, CardContent } from "./components/ui/card";

const PIN_COUNT = 8;
const TOLERANCE = 2;

const getRandomPositions = (count: number) =>
  Array.from({ length: count }, () => Math.floor(Math.random() * 100));

export default function App() {
  const [targetPositions, setTargetPositions] = useState<number[]>(
    getRandomPositions(PIN_COUNT)
  );
  const [currentPositions, setCurrentPositions] = useState<number[]>(
    Array(PIN_COUNT).fill(0)
  );
  const [unlocked, setUnlocked] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleSliderChange = (index: number, value: string) => {
    const updated = [...currentPositions];
    updated[index] = parseInt(value);
    setCurrentPositions(updated);
  };

  useEffect(() => {
    const allCorrect = currentPositions.every(
      (pos, i) => Math.abs(pos - targetPositions[i]) <= TOLERANCE
    );
    if (allCorrect && !unlocked) {
      setUnlocked(true);
      audioRef.current?.play();
    }
  }, [currentPositions, targetPositions, unlocked]);

  const resetGame = () => {
    setTargetPositions(getRandomPositions(PIN_COUNT));
    setCurrentPositions(Array(PIN_COUNT).fill(0));
    setUnlocked(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 text-white px-4">
      <audio ref={audioRef} src="/lockOpen.wav" preload="auto" />
      <Card
        className={`w-full max-w-4xl p-6 border-4 rounded-2xl transition-all duration-700 shadow-[inset_0_0_40px_rgba(0,0,0,0.6)]
        ${
          unlocked
            ? "border-green-400 rotate-[2deg] scale-105"
            : "border-zinc-700"
        }
        ${
          unlocked
            ? "bg-gradient-to-br from-zinc-800 to-zinc-600"
            : "bg-zinc-900"
        }`}
      >
        <CardContent className="space-y-8">
          <h1 className="text-2xl font-bold tracking-wide text-gray-100 text-center">
            🔐 Crochetage de Serrure Blindée
          </h1>

          {unlocked && (
            <div className="text-green-400 text-center text-lg font-semibold">
              ✅ Serrure déverrouillée ! CODE : 4584
            </div>
          )}

          {/* Barillet */}
          <div
            className={`flex justify-center gap-4 flex-wrap transition-all duration-700 ${
              unlocked ? "scale-105" : ""
            }`}
          >
            {currentPositions.map((pos, i) => {
              const target = targetPositions[i];
              const distance = Math.abs(pos - target);
              const color =
                distance <= TOLERANCE
                  ? "bg-green-500"
                  : distance <= 10
                  ? "bg-yellow-500"
                  : "bg-gray-600";

              return (
                <div key={i} className="flex flex-col items-center gap-2">
                  <div className="relative w-6 h-40 bg-zinc-800 border border-zinc-700 rounded-xl shadow-inner overflow-hidden">
                    <div
                      className={`absolute w-full rounded-sm ${color} transition-all duration-300`}
                      style={{
                        bottom: `${pos}%`,
                        height: "12%",
                      }}
                    />
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={pos}
                    onChange={(e) => handleSliderChange(i, e.target.value)}
                    className="w-24 accent-blue-500"
                    disabled={unlocked}
                  />
                </div>
              );
            })}
          </div>

          <div className="text-center mt-4">
            <Button onClick={resetGame}>
              {unlocked ? "🔄 Rejouer" : "Réinitialiser"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
