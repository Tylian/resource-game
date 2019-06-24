import { RedomComponent, el, Place, place } from "redom";
import Engine from "../Engine";
import { MachineMeta } from "../data";
import { evt } from "./utils";

import translate from "../i18n";
const i18n = translate('en-US');

import "../style/toolbox.scss";
import Accordian from "./Accordian";

class MachineButton implements RedomComponent {
  public el: HTMLElement;
  constructor({ engine, machine}: { engine: Engine, machine: MachineMeta }) {
    this.el = el('button', i18n(`machine.${machine.key}`), evt({
      click: () => { engine.createMachine(machine.key); }
    }))
  }
}

export default class ToolboxComponent implements RedomComponent {
  public el: HTMLElement;
  public buttons = new Map<string, Place>();
  constructor(private engine: Engine, private machines: MachineMeta[]) {
    let categories = machines
      .map(machine => machine.category)
      .filter((value, i, arr) => arr.indexOf(value) == i);

    let accordians = categories.map(category => {
      let matched = machines.filter(machine => machine.category == category);
      return new Accordian(
        i18n(`category.${category}`),
        el('div.children', matched.map(machine => {
          let button = place(MachineButton, { machine, engine });
          this.buttons.set(machine.key, button)
          return button;
        }))
      );
    });
    
    this.update();
    this.el = el('div#toolbox', accordians);
  }

  update() {
    for(let [key, button] of this.buttons) {
      button.update(this.engine.machineUnlocked(key));
    }
  }
}