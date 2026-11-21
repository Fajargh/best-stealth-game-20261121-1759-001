// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps, and the renderer paints what is there. The game moves
// between title, play, paused, level-clear, caught and won screens.
//
// ?seed=N fixes the patrol wobble and gem sparkle. ?shot=cover|patrol|alert|win
// (with &seed=N) stages that scene instead of running the loop, paints it
// twice and sets window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  createWorld, stepWorld, startLevel, advanceWorld,
  SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_LEVEL_DONE,
  SCREEN_CAUGHT, SCREEN_WON,
} from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer } from './render.js';
import { updateGuard } from './guards.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();
const input = createInput(canvas, (x, y) => renderer.screenToWorld(x, y));

// Guard footsteps, panned by where the guard is relative to the player.
world.onStep = (guard) => {
  const pan = Math.max(-1, Math.min(1, (guard.x - world.player.x) / 360));
  audio.footstep(pan);
};

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off: the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world, scene.screen, scene.best, performance.now() / 1000);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  // Sounds and speech for what just happened in the world.
  function drainEvents() {
    for (const event of world.events) {
      if (event.type === 'gem') audio.gem();
      else if (event.type === 'spotted') audio.spotted();
      else if (event.type === 'alarm') audio.alarm();
      else if (event.type === 'caught') audio.caught();
      else if (event.type === 'levelDone') audio.levelDone();
      else if (event.type === 'won') audio.won();
      else if (event.type === 'start') audio.click();
    }
    world.events.length = 0;
  }

  function syncScreen() {
    if (world.state !== screen) {
      screen = world.state;
      if (screen === SCREEN_CAUGHT) {
        announce('Caught! Press Space to try again.');
        if (world.score > best) {
          best = world.score;
          saveBest(best);
        }
      } else if (screen === SCREEN_LEVEL_DONE) {
        announce('Level clear! Press Space for the next level.');
      } else if (screen === SCREEN_WON) {
        announce('You won! The ember is yours.');
        if (world.score > best) {
          best = world.score;
          saveBest(best);
        }
      }
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM) audio.unlock();
    if (actions & ACTION_CONFIRM && screen === SCREEN_TITLE) {
      startLevel(world);
      screen = SCREEN_PLAY;
      announce(`Playing. ${world.level.name}.`);
    } else if (actions & ACTION_CONFIRM && screen === SCREEN_LEVEL_DONE) {
      advanceWorld(world);
      screen = SCREEN_PLAY;
      announce(`Playing. ${world.level.name}.`);
    } else if (actions & ACTION_CONFIRM && screen === SCREEN_CAUGHT) {
      advanceWorld(world);
      screen = SCREEN_PLAY;
      announce('Try again.');
    } else if (actions & ACTION_CONFIRM && screen === SCREEN_WON) {
      world.score = 0;
      world.gemsGot = 0;
      world.time = 0;
      world.levelIndex = 0;
      startLevel(world);
      screen = SCREEN_PLAY;
      announce(`Playing. ${world.level.name}.`);
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      world.state = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      world.state = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      // The museum lives behind the title: guards walk their rounds.
      for (const guard of world.guards) updateGuard(guard, STEP, world);
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const dir = input.direction();
    const click = input.takeClick();
    stepWorld(world, STEP, { mx: dir.x, my: dir.y, running: input.running(), click });
    drainEvents();
    syncScreen();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
      step();
      accumulator -= STEP;
    }
    if (screen !== SCREEN_TITLE && screen !== SCREEN_PLAY) accumulator = 0;
    renderer.draw(world, screen, best, now / 1000);
  }

  // Leaving the tab pauses a running game rather than letting guards close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      world.state = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Emberlight Heist. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
