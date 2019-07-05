import Engine from "./Engine";
import Stats, { Panel } from "./debug";

import "./style/style.scss";

import translate from './i18n';
const i18n = translate('en-US');

const canvas = document.querySelector("#game") as HTMLCanvasElement;
let engine = new Engine(canvas);

engine.mountInfobox(document.querySelector("#infobox") as HTMLElement);
engine.mountToolbox(document.querySelector("#toolbox") as HTMLElement);

(document.querySelector('#save') as HTMLElement).addEventListener('click', () => {
  let save = JSON.stringify(engine.toJson());
  prompt("Here's a save string, click load and enter it to load it:", save);
});

(document.querySelector('#load') as HTMLElement).addEventListener('click', () => {
  let save = prompt("Enter a save string:", "");
  if(save == "") {
    if(confirm("Loading an empty string will reset the game to the beginnig, are you sure?")) {
      save = '{"camera":{"x":0,"y":0,"zoom":1},"nodes":{},"seenResources":[]}';
    } else {
      return;
    }
  }
  if(save) {
    try {
      engine.fromJson(JSON.parse(save));
    } catch(e) {
      alert("Could not load save, maybe it's invalid?\n\n" + e);
    }
  }
});

if(process.env.NODE_ENV != 'development') {
  const render = () => {
    engine.render();
    requestAnimationFrame(render);
  };

  setInterval(() => { engine.tick(); }, 1000 / 20);
  render();
} else {
  const fpsStats = new Stats();
  const tpsStats = new Stats(
    new Panel('TPS', '#ff8', '#221'),
    new Panel('tick', '#f8f', '#212')
  );
  fpsStats.showPanel(0);
  fpsStats.showPanel(1);

  tpsStats.showPanel(0);
  tpsStats.showPanel(1);

  fpsStats.dom.style.left = "145px";
  tpsStats.dom.style.left = "230px";
  document.body.appendChild(fpsStats.dom);
  document.body.appendChild(tpsStats.dom);

  setInterval(() => {
    engine.tick(); tpsStats.update();
  }, 1000 / 20);
  
  const render = () => {
    engine.render(); fpsStats.update();
    requestAnimationFrame(render);
  };
  render();

  setInterval(() => {
    window.localStorage.setItem('savestring', JSON.stringify(engine.toJson()));
  }, 30000);

  if(window.localStorage.getItem('savestring') !== null) {
    try {
      let json = JSON.parse(window.localStorage.getItem('savestring'));
      engine.fromJson(json);
    } catch(e) { console.error('Failed to load save from localStorage'); console.error(e); }
  }

  // debug exports
  let exports = {
    engine: engine,
  }

  for(let [key, value] of Object.entries(exports)) {
    (window as any)[key] = value;
  }
}