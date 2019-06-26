import Engine from "./Engine";
import Stats, { Panel } from "./debug";

import "./style/style.scss";

import translate from './i18n';
const i18n = translate('en-US');

const canvas = <HTMLCanvasElement>document.querySelector("#game");
const engine = new Engine(canvas);

engine.mountInfobox(document.querySelector("#infobox"));
engine.mountToolbox(document.querySelector("#toolbox"));

canvas.width = document.documentElement.clientWidth;
canvas.height = document.documentElement.clientHeight;

window.addEventListener("resize", e => {
  canvas.width = document.documentElement.clientWidth;
  canvas.height = document.documentElement.clientHeight;
});

document.querySelector('#save').addEventListener('click', () => {
  let save = JSON.stringify(engine.toJson());
  prompt("Here's a save string, click load and enter it to load it:", save);
});

document.querySelector('#load').addEventListener('click', () => {
  let save = prompt("Enter a save string:", "");
  try {
    engine.fromJson(JSON.parse(save));
  } catch(e) {
    alert("Could not load save, maybe it's invalid?\n\n" + e);
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

  if(module.hot) {
    module.hot.accept('./Engine', function() {
      console.log('Engine updated, reloading');
      let save = engine.toJson();
  
      engine = new Engine(canvas);
      engine.mountInfobox(<HTMLElement>document.querySelector("#infobox"));
      engine.mountToolbox(<HTMLElement>document.querySelector("#toolbox"));
  
      engine.fromJson(save);
    });
}

// debug exports
let exports = {
  engine: engine,
}

for(let [key, value] of Object.entries(exports)) {
  (window as any)[key] = value;
}
}