// Sets up the browser-shaped globals that public/components/**/*.js modules
// assume exist (jsdom for DOM/customElements, plus `io`/`feathers` — normally
// loaded via <script> tags in index.html — for socketConfig.js, imported
// transitively by every minmax-engine component through the store).
// Must be imported BEFORE any component module, and before `cdn-module-loader.mjs`
// is registered, since LitElement/customElements.define need window/document
// to exist at module-evaluation time.
import { JSDOM } from 'jsdom';
import feathers from '@feathersjs/feathers';
import socketio from '@feathersjs/socketio-client';
import { io } from 'socket.io-client';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });

global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
global.customElements = dom.window.customElements;
global.CustomEvent = dom.window.CustomEvent;
global.Event = dom.window.Event;
global.Node = dom.window.Node;
global.navigator = dom.window.navigator;
global.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
global.cancelAnimationFrame = (id) => clearTimeout(id);

// socketConfig.js does `const socket = io(); const client = feathers();` at
// import time — real `feathers()` is side-effect-free, but `io()` would try
// to open a real connection unless autoConnect is disabled. No component
// test in this repo actually calls a store service method, so a real (but
// never-connecting) socket is safer than a hand-rolled fake with a
// guessed-at interface.
global.feathers = Object.assign(feathers, { socketio });
global.io = () => io('http://fake-socket.test', { autoConnect: false });
