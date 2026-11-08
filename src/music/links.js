// Reads YouTube, YouTube Music and playlist links into what the embed player needs.

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const LIST_ID = /^[A-Za-z0-9_-]{10,64}$/;

export class LinkError extends Error {}

/**
 * @returns {{kind:'video'|'playlist', videoId:string|null, listId:string|null, source:'YouTube'|'YouTube Music', url:string}}
 * @throws {LinkError} with a sentence the visitor can act on
 */
export function parseLink(raw) {
  const text = String(raw || '').trim();
  if (!text) throw new LinkError('Paste a link first.');
  // A bare 11-character ID works too.
  if (VIDEO_ID.test(text)) return { kind: 'video', videoId: text, listId: null, source: 'YouTube', url: `https://www.youtube.com/watch?v=${text}` };

  if (/\s/.test(text) || !text.includes('.')) throw new LinkError('That is not a link. Copy it from the address bar or the Share button.');
  let url;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    throw new LinkError('That is not a link. Copy it from the address bar or the Share button.');
  }
  const host = url.hostname.toLowerCase().replace(/^(www\.|m\.)/, '');
  const known = ['youtube.com', 'music.youtube.com', 'youtu.be', 'youtube-nocookie.com'];
  if (!known.includes(host)) throw new LinkError('Only YouTube and YouTube Music links can play here.');
  const source = host === 'music.youtube.com' ? 'YouTube Music' : 'YouTube';

  let videoId = null;
  const parts = url.pathname.split('/').filter(Boolean);
  if (host === 'youtu.be') videoId = parts[0] || null;
  else if (url.pathname === '/watch') videoId = url.searchParams.get('v');
  else if (['shorts', 'embed', 'live', 'v'].includes(parts[0])) videoId = parts[1] || null;
  if (videoId && !VIDEO_ID.test(videoId)) videoId = null;

  let listId = url.searchParams.get('list');
  if (listId && !LIST_ID.test(listId)) listId = null;
  // Mixes (RD...), Liked videos (LL) and Watch later (WL) do not play outside YouTube.
  const unplayableList = listId && (/^RD/.test(listId) || listId === 'LL' || listId === 'WL' || /^LM$/.test(listId));
  if (unplayableList) {
    if (videoId) listId = null;
    else throw new LinkError('Mixes and private lists cannot play outside YouTube. Paste a song, an album or a public playlist.');
  }

  if (!videoId && !listId) throw new LinkError('This link has no video or playlist in it. Open the song, then copy the link again.');
  const kind = listId ? 'playlist' : 'video';
  const clean = kind === 'playlist'
    ? `https://www.youtube.com/playlist?list=${listId}`
    : `https://www.youtube.com/watch?v=${videoId}`;
  return { kind, videoId, listId, source, url: clean };
}
