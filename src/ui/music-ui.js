import { formatDuration } from '../core/emitter.js';
import { thumbFor, LinkError } from '../music/links.js';
import { toast } from './panels.js';

const $ = (id) => document.getElementById(id);
const ICON = { YouTube: './icons/youtube.svg', 'YouTube Music': './icons/youtubemusic.svg' };

function svgUse(id) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(ns, 'use');
  use.setAttribute('href', `#${id}`);
  svg.appendChild(use);
  return svg;
}

function setIcon(button, id) {
  const use = button.querySelector('use');
  if (use && use.getAttribute('href') !== `#${id}`) use.setAttribute('href', `#${id}`);
}

export function titleOf(item) {
  if (!item) return '';
  if (item.title) return item.title;
  return item.kind === 'playlist' ? 'YouTube playlist' : 'YouTube video';
}

export function mountMusic(player, panels, { onPlayingChange }) {
  const form = $('add-form');
  const input = $('link');
  const err = $('link-error');
  const state = $('player-state');
  const playBtn = $('playpause');
  const dockPlay = $('dock-play');
  const prevBtn = $('prev');
  const nextBtn = $('next');
  const seek = $('seek');
  const seekTime = $('seek-time');
  const vol = $('music-vol');
  const volOut = $('music-vol-out');
  const shuffle = $('shuffle');
  const loop = $('loop');
  const qToggle = $('queue-toggle');
  const qList = $('queue-list');
  const qItems = $('queue-items');
  const qEmpty = $('queue-empty');
  const qClear = $('queue-clear');
  const qLabel = $('queue-label');
  const nowTitle = $('now-title');
  const nowSub = $('now-sub');
  const nowSrc = $('now-src');
  const openMusic = $('open-music');
  const openMusicText = $('open-music-text');

  panels.registerOpener('music', openMusic);

  function showError(msg) {
    err.textContent = msg;
    err.hidden = false;
    input.setAttribute('aria-invalid', 'true');
  }
  function clearError() {
    err.hidden = true;
    err.textContent = '';
    input.removeAttribute('aria-invalid');
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    clearError();
    try {
      const item = player.add(input.value);
      input.value = '';
      toast(item.kind === 'playlist' ? 'Playlist added to the queue.' : 'Added to the queue.');
    } catch (ex) {
      if (ex instanceof LinkError) {
        showError(ex.message);
        input.focus();
      } else {
        showError('Something went wrong reading that link. Try copying it again.');
      }
    }
  });
  input.addEventListener('input', () => {
    if (!err.hidden && !input.value) clearError();
  });

  const togglePlay = () => player.toggle();
  playBtn.addEventListener('click', togglePlay);
  dockPlay.addEventListener('click', togglePlay);
  prevBtn.addEventListener('click', () => player.prev());
  nextBtn.addEventListener('click', () => player.next());
  shuffle.addEventListener('click', () => player.setShuffle(!player.shuffle));
  loop.addEventListener('click', () => player.setLoop(!player.loop));
  vol.addEventListener('input', () => {
    player.setVolume(Number(vol.value));
  });
  let seeking = false;
  seek.addEventListener('input', () => {
    seeking = true;
    const { duration } = player.progress();
    seekTime.textContent = `${formatDuration((Number(seek.value) / 100) * duration)} / ${formatDuration(duration)}`;
  });
  seek.addEventListener('change', () => {
    const { duration } = player.progress();
    player.seek((Number(seek.value) / 100) * duration);
    seeking = false;
  });

  qToggle.addEventListener('click', () => {
    const open = qToggle.getAttribute('aria-expanded') !== 'true';
    qToggle.setAttribute('aria-expanded', String(open));
    qList.hidden = !open;
  });
  let clearArmed = 0;
  qClear.addEventListener('click', () => {
    if (!clearArmed) {
      qClear.textContent = `Clear all ${player.queue.length}? Press again`;
      clearArmed = setTimeout(() => {
        clearArmed = 0;
        qClear.textContent = 'Clear the queue';
      }, 3500);
      return;
    }
    clearTimeout(clearArmed);
    clearArmed = 0;
    qClear.textContent = 'Clear the queue';
    player.clear();
    toast('Queue cleared.');
    qToggle.focus();
  });
}
