import { RedomComponent, el, Place, place } from "redom";
import Engine from "../Engine";
import { NodeMeta } from "../data";
import { evt } from "./utils";

import translate from "../i18n";
const i18n = translate('en-US');

import "../style/toolbox.scss";
import Accordian from "./Accordian";

class NodeButton implements RedomComponent {
  public el: HTMLElement;
  constructor({ engine, node}: { engine: Engine, node: NodeMeta }) {
    this.el = el('button', i18n(`node.${node.key}`), evt({
      click: () => { engine.createNode(node.key); }
    }))
  }
}

export default class ToolboxComponent implements RedomComponent {
  public el: HTMLElement;
  public buttons = new Map<string, Place>();
  constructor(private engine: Engine, private nodes: NodeMeta[]) {
    let categories = nodes
      .map(node => node.category)
      .filter((value, i, arr) => arr.indexOf(value) == i);

    let accordians = categories.map(category => {
      let matched = nodes.filter(node => node.category == category);
      return new Accordian(
        i18n(`category.${category}`),
        el('div.children', matched.map(node => {
          let button = place(NodeButton, { node, engine });
          this.buttons.set(node.key, button)
          return button;
        }))
      );
    });
    
    this.update();
    this.el = el('div#toolbox.floating', accordians);
  }

  update() {
    for(let [key, button] of this.buttons) {
      button.update(this.engine.nodeUnlocked(key));
    }
  }
}