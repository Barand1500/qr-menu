import { useMemo, useState } from 'react';
import { buildDetectiveRound, DETECTIVE_LADDER, type DetectivePlayQuestion } from '@/lib/detectiveQuestionPool';
import type { DetectiveAdminQuestion } from '@/lib/menuGamesConfig';
import { gamesUi } from '@/lib/menuGamesUi';

const LETTERS = ['A', 'B', 'C', 'D'] as const;

type Phase = 'intro' | 'ask' | 'feedback' | 'end';

type Props = {
  lang?: string;
  adminQuestions?: DetectiveAdminQuestion[];
};

export default function DetectiveGame({ lang = 'tr', adminQuestions = [] }: Props) {
  const ui = gamesUi(lang);
  const [seed, setSeed] = useState(0);
  const questions = useMemo(
    () =>
      buildDetectiveRound(
        lang,
        adminQuestions.map((q) => ({
          id: q.id,
          prompt: q.prompt,
          choices: q.choices,
          correctIndex: q.correctIndex,
          fromAdmin: true,
        }))
      ),
    [lang, adminQuestions, seed]
  );

  const [phase, setPhase] = useState<Phase>('intro');
  const [index, setIndex] = useState(0);
  const [locked, setLocked] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  const [hidden, setHidden] = useState<number[]>([]);
  const [fiftyUsed, setFiftyUsed] = useState(false);
  const [score, setScore] = useState(0);

  const current: DetectivePlayQuestion | undefined = questions[index];
  const total = questions.length;
  const ladderValue = DETECTIVE_LADDER[Math.min(index, DETECTIVE_LADDER.length - 1)] || 0;

  function start() {
    setPhase('ask');
    setIndex(0);
    setLocked(false);
    setPicked(null);
    setHidden([]);
    setFiftyUsed(false);
    setScore(0);
  }

  function restart() {
    setSeed((s) => s + 1);
    setPhase('intro');
    setIndex(0);
    setLocked(false);
    setPicked(null);
    setHidden([]);
    setFiftyUsed(false);
    setScore(0);
  }

  function useFifty() {
    if (!current || fiftyUsed || locked) return;
    const wrong = [0, 1, 2, 3].filter((i) => i !== current.correctIndex);
    const drop = wrong.sort(() => Math.random() - 0.5).slice(0, 2);
    setHidden(drop);
    setFiftyUsed(true);
  }

  function answer(choice: number) {
    if (!current || locked || hidden.includes(choice)) return;
    setLocked(true);
    setPicked(choice);
    const ok = choice === current.correctIndex;
    if (ok) {
      setScore(DETECTIVE_LADDER[index] || score);
      setPhase('feedback');
    } else {
      setPhase('feedback');
    }
  }

  function continueAfter() {
    if (!current || picked == null) return;
    const ok = picked === current.correctIndex;
    if (!ok) {
      setPhase('end');
      return;
    }
    if (index >= total - 1) {
      setPhase('end');
      return;
    }
    setIndex((i) => i + 1);
    setLocked(false);
    setPicked(null);
    setHidden([]);
    setPhase('ask');
  }

  if (phase === 'intro') {
    return (
      <div className="menu-det">
        <div className="menu-det__hero">
          <p className="menu-det__kicker">{ui.detective.badge}</p>
          <h3>{ui.detective.title}</h3>
          <p>{ui.detective.blurb}</p>
          <ol className="menu-det__ladder" aria-label={ui.detLadder}>
            {[...DETECTIVE_LADDER].reverse().map((v, i) => (
              <li key={v}>
                <span>{DETECTIVE_LADDER.length - i}</span>
                <strong>{v.toLocaleString(lang.startsWith('tr') ? 'tr-TR' : 'en-US')}</strong>
              </li>
            ))}
          </ol>
          <button type="button" className="menu-games__primary" onClick={start}>
            {ui.detStart}
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'end' || !current) {
    const won = score >= DETECTIVE_LADDER[DETECTIVE_LADDER.length - 1];
    return (
      <div className="menu-det menu-det--end">
        <div className="menu-det__result">
          <p className="menu-det__kicker">{won ? ui.detWin : ui.detWrong}</p>
          <strong className="menu-det__prize">{ui.detScore(score)}</strong>
          <button type="button" className="menu-games__primary" onClick={restart}>
            {ui.playAgain}
          </button>
        </div>
      </div>
    );
  }

  const ok = picked != null && picked === current.correctIndex;

  return (
    <div className="menu-det">
      <div className="menu-det__top">
        <span>{ui.detQuestion(index + 1, total)}</span>
        <strong>{ui.detScore(ladderValue)}</strong>
      </div>

      <div className="menu-det__board">
        <p className="menu-det__prompt">{current.prompt}</p>
        {current.fromAdmin ? <span className="menu-det__admin-tag">★</span> : null}

        <div className="menu-det__answers">
          {current.choices.map((choice, i) => {
            if (hidden.includes(i)) return null;
            let cls = 'menu-det__answer';
            if (picked != null) {
              if (i === current.correctIndex) cls += ' is-correct';
              else if (i === picked) cls += ' is-wrong';
            }
            return (
              <button
                key={`${current.id}-${i}`}
                type="button"
                className={cls}
                disabled={locked}
                onClick={() => answer(i)}
              >
                <em>{LETTERS[i]}</em>
                <span>{choice}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="menu-det__bar">
        <button
          type="button"
          className="menu-games__ghost"
          disabled={fiftyUsed || locked}
          onClick={useFifty}
        >
          {ui.detFifty}
        </button>
        {phase === 'feedback' ? (
          <button
            type="button"
            className="menu-games__primary"
            onClick={() => {
              if (ok) continueAfter();
              else restart();
            }}
          >
            {ok ? (index >= total - 1 ? ui.detWin : ui.detNext) : ui.playAgain}
          </button>
        ) : null}
      </div>
      {phase === 'feedback' ? (
        <p className={`menu-det__flash${ok ? ' is-ok' : ' is-bad'}`}>
          {ok ? ui.detCorrect : ui.detWrong}
        </p>
      ) : null}
    </div>
  );
}
