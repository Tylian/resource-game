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

const update = () => {
  engine.tick();
  setTimeout(update, 50);
};

const render = () => {
  engine.render();
  requestAnimationFrame(render);
};

update();
render();

// debug exports
let exports = {
  engine: engine,
}

for(let [key, value] of Object.entries(exports)) {
  (window as any)[key] = value;
}