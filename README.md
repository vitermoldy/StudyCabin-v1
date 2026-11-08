# StudyCabin

A study room in a live beach house. A cabin on a misty beach keeps its own day (one game minute
every real second, so a day lasts 24 minutes), the weather turns, five seasons change, and a
resident lives through the day while you study, with your own YouTube music.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static files in dist/, open with any static server
npm run preview    # serves dist/
```

Needs a browser with WebGL 2 (any current Chrome, Edge, Firefox or Safari). Without it the page
shows a still picture and the music, timer and ambient sound still work.

## What is in it

- **The cabin and the resident.** A sage board cabin with a standing-seam roof, glass front, deck,
  fire bowl and stove; inside a kitchen, table, sofa, armchair, bookcase, bed and a desk by the
  glass. The resident follows a daily routine (sleep, coffee, breakfast, study, a walk on the
  shore, cooking, reading, guitar, journal) and swaps outdoor plans for indoor ones when it rains
  or snows. Lamps, the stove, the porch light and the fire bowl follow the hour and the weather.
- **Clock.** 1 minute every second by default; also stopped, real time and 10 minutes a second.
  Jump to any hour from the Day panel or its timeline.
- **Seasons.** Spring, summer, rainy season, autumn, winter: day length, temperature, grass and
  tree colours, petals, falling leaves, snow on the roof and dunes. Optionally moves on every
  7 game days.
- **Weather.** Follows the season, or pick clear, cloudy, fog, rain, storm or snow. Rain streaks,
  storm lightning (soft, at most two flashes a second), snowfall, fog, wind in the grass.
- **Sky.** Clouds at every hour, sunrise and sunset colours, moon, a Milky Way band and stars at
  night, and northern lights on clear nights (strongest in winter).
- **Water.** Clear in the shallows with caustic light on the sand, calm long swells, soft glints,
  and a ripple simulation in front of the cabin (after Evan Wallace's WebGL Water): tap the sea to
  ring it, Shift+drag to draw ripples; raindrops ring it by themselves.
- **Grass and trees.** A thick lawn of fine blades that rolls in gusts and parts around the mouse;
  pines and broadleaf trees on the slope behind the cabin, their crowns following the season.
- **Music.** Paste a YouTube or YouTube Music link: a song, a video, an album or a public
  playlist. Links line up in the queue dropdown (reorder, remove, clear); next, previous,
  shuffle, repeat, seek and volume. The queue is kept in the browser.
- **Focus timer.** 25/5 or 50/10 blocks with a long break; the resident studies at the desk while
  it runs and takes a break with you. A bell at the end of each block.
- **Ambient sound.** Waves, rain, wind, birds and crickets, stove fire and thunder, made in the
  browser from the weather and the hour, with a mixer. It turns down while music plays.
- **Camera.** Five views (shore, deck, window, water, follow the resident), plus your own: drag to
  turn, right-drag or Ctrl+drag to slide, scroll or pinch to zoom, double-click to reset.

## Keys

| Key | Does |
| --- | --- |
| Space | Play or pause music |
| 1 to 5 | Shore, deck, window, water, follow |
| Arrows | Turn the camera |
| + and − | Zoom |
| R | Reset the camera |
| H | Show or hide the big words |
| P | Pause or move the scene |
| F | Full screen |
| Esc | Close the open panel |

## Known limits

- Some music videos refuse to play outside YouTube (YouTube error 101/150). The queue shows the
  reason on that row and moves to the next link.
- YouTube mixes (lists starting with RD), Liked videos and Watch later cannot be embedded; a song
  link copied from a YouTube Music mix plays as that one song.
- The video plays in the Music panel at about 400 by 225 px. When the panel is closed the player
  keeps playing out of sight.
- The scene is heavy on purpose (about a million grass triangles on a desktop, fewer on phones).
  The page lowers its resolution by itself when frames run slow.

## Before launch

- The wordmark "StudyCabin" and the "S" favicon are placeholders; no logo was given.
- `og:image` points at `share.jpg`; add `<link rel="canonical">` once the site has a domain.
