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
