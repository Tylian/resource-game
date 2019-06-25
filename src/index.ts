import Engine from "./Engine";

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

const update = () => {
  engine.tick();
  setTimeout(update, 50);
};

const render = () => {
  engine.render();
  requestAnimationFrame(render);
};

if(window.location.search.length > 0) {
  let save = window.location
}

update();
render();

// debug exports
let exports = {
  engine: engine,
}

for(let [key, value] of Object.entries(exports)) {
  (window as any)[key] = value;
}