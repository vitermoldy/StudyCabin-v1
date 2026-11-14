// The "History" block in the focus panel: focus blocks kept on the server, the
// recovery code for this browser, and restoring another browser's settings.
import { cloudState, fetchStats, onCloud, recoveryCode, restoreFrom } from '../core/cloud.js';
import { replaceAll } from '../core/store.js';
import { toast } from './panels.js';

const $ = (id) => document.getElementById(id);
const minutes = (m) => (m >= 60 ? `${Math.floor(m / 60)} h ${Math.round(m % 60)} min` : `${Math.round(m)} min`);
const clock = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export function mountCloud() {
  let stats = null;

  function render(state = cloudState()) {
    $('cloud-code').textContent = recoveryCode();
    const waiting = state.pending > 0 ? ` ${state.pending} focus ${state.pending === 1 ? 'block waits' : 'blocks wait'} to be sent.` : '';
    $('cloud-status').textContent =
      state.status === 'online'
        ? `Connected to the server.${state.lastSaved ? ` Settings last saved at ${clock(state.lastSaved)}.` : ''}${waiting}`
        : state.status === 'offline'
          ? `The server is not reachable. Everything stays in this browser.${waiting}`
          : 'Checking the server…';
    const days = $('cloud-days');
    const summary = $('cloud-summary');
    if (!stats) {
      days.hidden = true;
      summary.textContent = state.status === 'offline' ? '' : 'Focus blocks you finish appear here, day by day.';
      return;
    }
    const max = Math.max(1, ...stats.perDay.map((d) => d.minutes));
    days.hidden = false;
    days.setAttribute('aria-label', `Minutes of focus over the last ${stats.perDay.length} days: ${stats.perDay.map((d) => `${d.day.slice(5)} ${d.minutes}`).join(', ')}`);
    days.replaceChildren(
      ...stats.perDay.map((d) => {
        const bar = document.createElement('span');
        bar.className = 'days__bar';
        bar.style.setProperty('--h', String(d.minutes / max));
        if (d.minutes === 0) bar.classList.add('is-empty');
        bar.title = `${new Date(`${d.day}T12:00`).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}: ${minutes(d.minutes)}`;
        return bar;
      }),
    );
    const fortnight = stats.perDay.reduce((a, d) => a + d.minutes, 0);
    summary.textContent = `Last ${stats.perDay.length} days: ${minutes(fortnight)} of focus. ${stats.sessions} ${stats.sessions === 1 ? 'block' : 'blocks'} in all on the server${stats.streak > 1 ? `, ${stats.streak} days in a row` : ''}.`;
  }

  async function refresh() {
    stats = await fetchStats(14);
    render();
  }

  onCloud((state) => render(state));
  // Opening the focus panel fetches the latest history.
  document.querySelector('[data-panel="focus"]')?.addEventListener('click', () => void refresh());

  $('cloud-copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(recoveryCode());
      toast('Recovery code copied.');
    } catch {
      toast(`Your recovery code: ${recoveryCode()}`);
    }
  });

  $('cloud-restore').addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = $('cloud-input');
    const err = $('cloud-error');
    err.hidden = true;
    input.removeAttribute('aria-invalid');
    try {
      const text = await restoreFrom(input.value);
      replaceAll(text);
      location.reload();
    } catch (e) {
      input.setAttribute('aria-invalid', 'true');
      err.textContent =
        e.code === 'format' || e.status === 400
          ? 'A recovery code has 12 letters and digits.'
          : e.code === 'offline'
            ? 'The server is not reachable. Start it, then try again.'
            : e.status === 404
              ? 'Nothing is saved under that code.'
              : 'That code could not be used. Try again in a moment.';
      err.hidden = false;
    }
  });

  render();
  void refresh();
}
