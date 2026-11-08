import { Emitter, clamp } from '../core/emitter.js';
import { load, save } from '../core/store.js';
import { parseLink, loadYouTubeApi, fetchDetails, ERROR_TEXT, LinkError } from './links.js';

let uid = 0;
const newId = () => `q${Date.now().toString(36)}${(uid++).toString(36)}`;

/**
 * The music queue and the YouTube embed that plays it.
 * status: idle | loading-api | loading | playing | paused | buffering | ended | api-error
 */
export class MusicPlayer extends Emitter {
  constructor(host) {
    super();
    this.host = host;
    const saved = load('music', {});
    this.queue = Array.isArray(saved.queue) ? saved.queue.filter((q) => q && (q.videoId || q.listId)).map((q) => ({ ...q, status: q.status === 'error' ? 'error' : 'ready' })) : [];
    this.current = Number.isInteger(saved.current) && saved.current < this.queue.length ? saved.current : -1;
    this.volume = Number.isFinite(saved.volume) ? clamp(saved.volume, 0, 100) : 70;
    this.loop = saved.loop === true;
    this.shuffle = saved.shuffle === true;
    this.status = 'idle';
    this.nowTitle = '';
    this.apiError = '';
    this.player = null;
    this._ready = false;
    this._pending = null;
    this._seekToVideo = null;
  }

  get item() {
    return this.queue[this.current] || null;
  }

  get isPlaying() {
    return this.status === 'playing' || this.status === 'buffering';
  }

  // ------------------------------------------------------------ queue
  /** Adds a link. Returns the new item or throws LinkError. */
  add(raw, { playNow = false } = {}) {
    const parsed = parseLink(raw);
    const dup = this.queue.findIndex((q) => q.videoId === parsed.videoId && q.listId === parsed.listId);
    if (dup >= 0) {
      if (playNow || this.current < 0) this.play(dup);
      throw new LinkError(this.current === dup ? 'That link is already playing.' : 'That link is already in the queue.');
    }
    const item = { id: newId(), ...parsed, title: '', author: '', thumb: '', status: 'ready', error: '' };
    this.queue.push(item);
    this.persist();
    this.emit('change');
    fetchDetails(item).then((d) => {
      const it = this.queue.find((q) => q.id === item.id);
      if (!it) return;
      if (d && d.title) Object.assign(it, { title: d.title, author: d.author || '', thumb: d.thumb || '' });
      if (d && d.error === 'private') Object.assign(it, { status: 'error', error: 'This video or list is private.' });
      if (d && d.error === 'missing') Object.assign(it, { status: 'error', error: 'YouTube cannot find this video or list.' });
      this.persist();
      this.emit('change');
    });
    if (playNow || this.current < 0 || this.status === 'ended') this.play(this.queue.length - 1);
    return item;
  }

  remove(index) {
    if (index < 0 || index >= this.queue.length) return;
    const wasCurrent = index === this.current;
    this.queue.splice(index, 1);
    if (index < this.current) this.current--;
    if (wasCurrent) {
      if (this.queue.length === 0) {
        this.current = -1;
        this._stop();
      } else {
        this.current = Math.min(index, this.queue.length - 1);
        if (this.isPlaying) this.play(this.current);
        else this._cue(this.current);
      }
    }
    this.persist();
    this.emit('change');
  }

  move(index, dir) {
    const to = index + dir;
    if (to < 0 || to >= this.queue.length) return;
    const [it] = this.queue.splice(index, 1);
    this.queue.splice(to, 0, it);
    if (this.current === index) this.current = to;
    else if (this.current === to) this.current = index;
    this.persist();
    this.emit('change');
  }

  clear() {
    this.queue = [];
    this.current = -1;
    this._stop();
    this.persist();
    this.emit('change');
  }

  setVolume(v) {
    this.volume = clamp(Math.round(v), 0, 100);
    if (this._ready) this.player.setVolume(this.volume);
    this.persist();
    this.emit('change');
  }

  setLoop(on) {
    this.loop = !!on;
    this.persist();
    this.emit('change');
  }

  setShuffle(on) {
    this.shuffle = !!on;
    this.persist();
    this.emit('change');
  }

  // ------------------------------------------------------------ player
  async _ensurePlayer() {
    if (this._ready) return true;
    if (this._creating) return this._creating;
    this.status = 'loading-api';
    this.apiError = '';
    this.emit('change');
    this._creating = (async () => {
      try {
        const YT = await loadYouTubeApi();
        await new Promise((resolve) => {
          const mount = document.createElement('div');
          this.host.replaceChildren(mount);
          this.player = new YT.Player(mount, {
            width: '100%',
            height: '100%',
            playerVars: { playsinline: 1, rel: 0, modestbranding: 1, origin: location.origin },
            events: {
              onReady: () => {
                this._ready = true;
                this.player.setVolume(this.volume);
                resolve();
              },
              onStateChange: (e) => this._onState(e.data),
              onError: (e) => this._onError(e.data),
            },
          });
        });
        return true;
      } catch (err) {
        this.status = 'api-error';
        this.apiError = err && err.message === 'timeout'
          ? 'YouTube took too long to answer. Check the connection, then try again.'
          : 'YouTube did not load. Check the connection or an ad blocker, then try again.';
        this.emit('change');
        return false;
      } finally {
        this._creating = null;
      }
    })();
    return this._creating;
  }
}
