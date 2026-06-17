// Sound effects using Web Audio API — no external files needed

let audioCtx = null;
const getCtx = () => {
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
};

// Helper function to create, connect, play and properly disconnect nodes
const playTone = (freq, type, duration, delay = 0, volume = 0.2) => {
  try {
    const ctx = getCtx();
    
    // Resume context if suspended (browser security policy)
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.frequency.value = freq;
    osc.type = type;
    
    const startTime = ctx.currentTime + delay;
    const endTime = startTime + duration;
    
    gain.gain.setValueAtTime(volume, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, endTime);
    
    osc.start(startTime);
    osc.stop(endTime);
    
    // Clean up connections when done playing to prevent memory leaks
    osc.onended = () => {
      try {
        osc.disconnect();
        gain.disconnect();
      } catch (e) {
        console.warn('[Audio Clean] Failed to disconnect nodes:', e);
      }
    };
  } catch (err) {
    console.error('[Audio Error]', err);
  }
};

export const playBeep = () => {
  playTone(880, 'sine', 0.12, 0, 0.25);
};

export const playSuccess = () => {
  [523, 659, 784].forEach((freq, i) => {
    playTone(freq, 'sine', 0.22, i * 0.1, 0.22);
  });
};

export const playError = () => {
  [330, 260].forEach((freq, i) => {
    playTone(freq, 'square', 0.2, i * 0.15, 0.15);
  });
};

export const playClick = () => {
  playTone(600, 'sine', 0.04, 0, 0.12);
};

export const playDelete = () => {
  [440, 330, 220].forEach((freq, i) => {
    playTone(freq, 'triangle', 0.12, i * 0.08, 0.18);
  });
};

export const playCashRegister = () => {
  // Cha-ching sound
  [1200, 1500, 1800].forEach((freq, i) => {
    playTone(freq, 'sine', 0.15, i * 0.06, 0.2);
  });
};
