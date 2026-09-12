/**
 * Getting someone's attention who is not looking at the screen.
 *
 * The bench is often across the room from its monitor, and a reception desk
 * has a patient in front of it. A change in a list is not enough; these are
 * the chime and the desktop notification that both queues use, in one place
 * so they sound and look the same.
 *
 * Browser only. Every function here is safe to call where there is no audio
 * context or no Notification API — it simply does nothing.
 */

/** A two-note chime: C5 then E5. */
export function playChime(): void {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const audioCtx = new AudioContextClass();

    const playTone = (freq: number, start: number, duration: number) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.12, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(start);
      osc.stop(start + duration);
    };

    const now = audioCtx.currentTime;
    playTone(523.25, now, 0.15);
    playTone(659.25, now + 0.12, 0.35);
  } catch (err) {
    console.error('AudioContext sound failed:', err);
  }
}

/** Asks once. A denied prompt still leaves the chime and the on-screen notice. */
export function requestNotificationPermission(): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission === 'default') {
    void Notification.requestPermission();
  }
}

/** A desktop notification, if the browser has been allowed to show one. */
export function desktopNotify(title: string, body: string): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body });
  } catch (e) {
    console.error('Desktop notification failed:', e);
  }
}
