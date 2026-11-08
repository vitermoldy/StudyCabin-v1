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

  function row(item, i) {
    const li = document.createElement('li');
    li.className = 'qrow';
    if (i === player.current) li.classList.add('is-current');
    if (item.status === 'error') li.classList.add('is-error');
    const thumb = thumbFor(item);
    if (thumb) {
      const img = document.createElement('img');
      img.className = 'qrow__thumb';
      img.src = thumb;
      img.alt = '';
      img.width = 56;
      img.height = 32;
      img.loading = 'lazy';
      img.decoding = 'async';
      li.appendChild(img);
    } else {
      const ph = document.createElement('span');
      ph.className = 'qrow__thumb qrow__thumb--list';
      ph.appendChild(svgUse('i-music'));
      li.appendChild(ph);
    }
    const main = document.createElement('button');
    main.type = 'button';
    main.className = 'qrow__main';
    const isCurrent = i === player.current;
    main.setAttribute('aria-label', `${isCurrent && player.isPlaying ? 'Playing' : 'Play'} ${titleOf(item)}`);
    if (isCurrent) main.setAttribute('aria-current', 'true');
    const t = document.createElement('span');
    t.className = 'qrow__title';
    t.textContent = titleOf(item);
    const meta = document.createElement('span');
    meta.className = 'qrow__meta';
    const icon = document.createElement('img');
    icon.src = ICON[item.source] || ICON.YouTube;
    icon.alt = item.source;
    icon.width = 16;
    icon.height = 12;
    meta.appendChild(icon);
    const metaText = document.createElement('span');
    if (item.status === 'error') metaText.textContent = item.error;
    else if (isCurrent && player.isPlaying) metaText.textContent = item.kind === 'playlist' ? 'Playlist, playing now' : 'Playing now';
    else metaText.textContent = item.kind === 'playlist' ? 'Playlist' : item.author || item.source;
    meta.appendChild(metaText);
    main.append(t, meta);
    main.addEventListener('click', () => player.play(i));
    li.appendChild(main);

    const tools = document.createElement('div');
    tools.className = 'qrow__tools';
    const tool = (icon, label, fn, disabled) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'icon-btn';
      b.setAttribute('aria-label', label);
      b.disabled = !!disabled;
      b.appendChild(svgUse(icon));
      b.addEventListener('click', fn);
      tools.appendChild(b);
      return b;
    };
    tool('i-up', `Move ${titleOf(item)} up`, () => { player.move(i, -1); focusRow(i - 1, 0); }, i === 0);
    tool('i-down', `Move ${titleOf(item)} down`, () => { player.move(i, 1); focusRow(i + 1, 1); }, i === player.queue.length - 1);
    tool('i-remove', `Remove ${titleOf(item)}`, () => {
      player.remove(i);
      toast('Removed from the queue.');
      focusRow(Math.min(i, player.queue.length - 1), 2);
    });
    li.appendChild(tools);
    return li;
  }

  function focusRow(index, toolIndex) {
    requestAnimationFrame(() => {
      const li = qItems.children[index];
      if (!li) {
        qToggle.focus();
        return;
      }
      const btns = li.querySelectorAll('.qrow__tools .icon-btn');
      const target = btns[toolIndex] && !btns[toolIndex].disabled ? btns[toolIndex] : li.querySelector('.qrow__main');
      target.focus();
    });
  }

  function render() {
    const q = player.queue;
    const item = player.item;
    const has = q.length > 0;
    const playing = player.isPlaying;

    // The queue list
    const focusedIndex = [...qItems.children].findIndex((li) => li.contains(document.activeElement));
    qItems.replaceChildren(...q.map(row));
    if (focusedIndex >= 0 && !qItems.contains(document.activeElement)) focusRow(Math.min(focusedIndex, q.length - 1), 0);
    qEmpty.hidden = has;
    qClear.hidden = !has;
    qLabel.textContent = has ? `Queue: ${q.length} ${q.length === 1 ? 'link' : 'links'}` : 'Queue is empty';

    // State over the video area (empty, loading, error, end)
    let msg = '';
    if (player.status === 'api-error') msg = player.apiError;
    else if (player.status === 'loading-api') msg = 'Loading the YouTube player…';
    else if (!has) msg = 'Nothing queued yet. Paste a link above and it starts here.';
    else if (player.status === 'ended') msg = 'That was the last link. Add another, or turn on Repeat.';
    else if (player.status === 'idle') msg = `Press play to start “${titleOf(item || q[0])}”.`;
    state.textContent = msg;
    state.hidden = !msg;

    // Now playing
    if (item) {
      nowTitle.textContent = item.kind === 'playlist' && player.nowTitle ? player.nowTitle : titleOf(item);
      const bits = [];
      if (item.kind === 'playlist') bits.push(`From ${titleOf(item)}`);
      else if (item.author) bits.push(item.author);
      if (item.status === 'error') bits.push(item.error);
      nowSub.textContent = bits.join(' · ') || item.source;
      nowSrc.src = ICON[item.source] || ICON.YouTube;
      nowSrc.alt = item.source;
      nowSrc.hidden = false;
    } else {
      nowTitle.textContent = 'No song playing';
      nowSub.textContent = '';
      nowSrc.hidden = true;
    }

    // Controls
    const label = playing ? 'Pause music' : 'Play music';
    for (const b of [playBtn, dockPlay]) {
      b.disabled = !has;
      b.setAttribute('aria-label', label);
      setIcon(b, playing ? 'i-pause' : 'i-play');
    }
    prevBtn.disabled = !has;
    nextBtn.disabled = !has || (q.length < 2 && !(item && item.kind === 'playlist'));
    seek.disabled = !(player.status === 'playing' || player.status === 'paused' || player.status === 'buffering');
    shuffle.setAttribute('aria-pressed', String(player.shuffle));
    loop.setAttribute('aria-pressed', String(player.loop));
    vol.value = player.volume;
    volOut.textContent = `${player.volume}%`;

    // The top-right chip says what is on.
    const nowText = item && playing ? `Playing: ${nowTitle.textContent}` : 'Add music';
    if (openMusicText.textContent !== nowText) openMusicText.textContent = nowText;
    onPlayingChange(playing);
  }

  player.on('change', render);
  render();

  // Progress while the music panel is open.
  setInterval(() => {
    if (panels.current !== 'music' || seeking) return;
    const { time, duration } = player.progress();
    seek.value = duration ? String(Math.round((time / duration) * 100)) : '0';
    seekTime.textContent = `${formatDuration(time)} / ${formatDuration(duration)}`;
  }, 500);

  return { render };
}
