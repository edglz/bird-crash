import { useEffect, useRef, useState } from 'react';
import { Game, type Snapshot } from './game/game';
import { isMuted, toggleMute } from './game/audio';

const EMPTY: Snapshot = { screen: 'menu', levelIndex: 0, levels: [], score: 0, birdsLeft: 0, stars: 0, progress: [] };

export default function App() {
  const mount = useRef<HTMLDivElement>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [snap, setSnap] = useState<Snapshot>(EMPTY);
  const [muted, setMuted] = useState(isMuted());

  // The game (PixiJS) is created once; the cancellation guard prevents double instances under StrictMode.
  useEffect(() => {
    let cancelled = false;
    let created: Game | null = null;
    Game.create(mount.current!).then(g => {
      if (cancelled) { g.destroy(); return; }
      created = g;
      if (import.meta.env.DEV) (window as unknown as { __game: Game }).__game = g;
      setGame(g);
    });
    return () => {
      cancelled = true;
      created?.destroy();
    };
  }, []);

  useEffect(() => {
    if (!game) return;
    return game.on(setSnap);
  }, [game]);

  useEffect(() => {
    if (!game) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') (snap.screen === 'paused' ? game.resume() : game.pause());
      else if (e.key === 'r' || e.key === 'R') game.restart();
      else if (e.key === 'm' || e.key === 'M') setMuted(toggleMute());
      else if (e.key === '+' || e.key === '=') game.zoomBy(1.2);
      else if (e.key === '-') game.zoomBy(1 / 1.2);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [game, snap.screen]);

  const { screen, levelIndex, levels, score, stars, progress } = snap;
  const won = screen === 'won';

  return (
    <div className="stage">
      <div className="canvas-host" ref={mount} />

      {screen !== 'menu' && (
        <>
          <div className="hud">
            <button className="btn-pause" onClick={() => game?.pause()} aria-label="Pause" title="Pause (Esc)" />
            <button className="btn-restart" onClick={() => game?.restart()} aria-label="Restart" title="Restart (R)" />
            <button className={`btn-mute${muted ? ' off' : ''}`} onClick={() => setMuted(toggleMute())} aria-label="Sound" title="Sound (M)" />
            <button className="zoom-btn zoom-in" onClick={() => game?.zoomBy(1.2)} aria-label="Zoom in" title="Zoom in (+)">+</button>
            <button className="zoom-btn zoom-out" onClick={() => game?.zoomBy(1 / 1.2)} aria-label="Zoom out" title="Zoom out (-)">−</button>
            <div className="score">Score: {score}</div>
          </div>
        </>
      )}

      {screen === 'menu' && (
        <div className="overlay show menu">
          <div className="episode-title" aria-label="Select Episode" role="heading" />
          <div className="cards">
            {levels.map((lvl, i) => {
              const unlocked = i === 0 || (progress[i - 1] ?? 0) > 0;
              const n = progress[i] ?? 0;
              return (
                <button
                  key={lvl.id}
                  className={`card${unlocked ? '' : ' locked'}`}
                  disabled={!unlocked}
                  title={lvl.name}
                  onClick={() => { game?.startLevel(i); }}
                >
                  <span className="num">{i + 1}</span>
                  <span className="stars">
                    {[0, 1, 2].map(k => <img key={k} src="/assets/hud/star.png" alt="" className={k < n ? 'on' : ''} />)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {screen === 'paused' && (
        <div className="overlay show">
          <div className="panel">
            <h2>Paused</h2>
            <button onClick={() => game?.resume()}>Resume</button>
            <button onClick={() => game?.restart()}>Restart</button>
            <button onClick={() => game?.toMenu()}>Menu</button>
          </div>
        </div>
      )}

      {(screen === 'won' || screen === 'lost') && (
        <div className="overlay show">
          <div className="panel">
            <h2>{won ? 'Level cleared!' : 'Out of birds'}</h2>
            <div className="end-stars">
              {[0, 1, 2].map(k => <img key={k} src="/assets/hud/star.png" alt="" className={k < stars ? 'on' : ''} />)}
            </div>
            <p>Score: {score}</p>
            {won && levelIndex + 1 < levels.length && <button onClick={() => game?.next()}>Next level</button>}
            <button onClick={() => game?.restart()}>Retry</button>
            <button onClick={() => game?.toMenu()}>Menu</button>
          </div>
        </div>
      )}
    </div>
  );
}
