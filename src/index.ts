import Engine from "./Engine";
// import { h } from "preact";

import "./style/style.scss";

import { el, mount } from "redom";
import { getData, DataType, listData } from "./data";
import translate from './i18n';
const i18n = translate('en-US');

const canvas = document.getElementById("game") as HTMLCanvasElement;
const machines = document.getElementById("machines") as HTMLDivElement;
const info = document.getElementById('information');
const engine = new Engine(canvas, info);

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

mount(machines, el('span', listData(DataType.Machine).map(key => (
  el('button', i18n(`machine.${key}`), (el) => {
    el.addEventListener("click", () => {
      engine.createMachine(key);
    });
  })
))))

update();
render();

// debug exports
let exports = {
  engine: engine,
}

for(let [key, value] of Object.entries(exports)) {
  (window as any)[key] = value;
}