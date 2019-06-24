import Engine from "./Engine";
// import { h } from "preact";

import "./style/style.scss";
import Machine, { MachineMeta } from "./Machine";

const machineData: {[ name: string]: MachineMeta } = require("./data/machines.json");

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

//engine.fromJson(require("./data/save.json"));

for(let [id, machine] of Object.entries(machineData)) {
  let el = document.createElement("button");
  el.textContent = id;
  el.addEventListener("click", () => {
    engine.createMachine(id);
  });

  machines.appendChild(el);
}

update();
render();

// debug exports
let exports = {
  engine: engine,
  Engine: Engine,
  Machine: Machine,
  recipeData: require("./data/recipes.json"),
  machineData: require("./data/machines.json")
}

for(let [key, value] of Object.entries(exports)) {
  (window as any)[key] = value;
}