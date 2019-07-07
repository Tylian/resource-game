import { FunctionalComponent, h } from "preact";
import Engine from "../Engine";
import Accordian from "./Accordian";

import "../style/toolbox.scss";

export interface ToolboxNode {
  key: string;
  name: string;
  category: string;
  visible: boolean;
}

interface ToolboxProps {
  engine: Engine,
  categories: string[],
  nodes: ToolboxNode[]
}

const Toolbox: FunctionalComponent<ToolboxProps> = ({ engine, categories, nodes }) => {
  let accordians = categories.map(category => {
    let matched = nodes.filter(node => node.visible && node.category == category);
    let buttons = matched.map(node => (
      <button onClick={() => engine.createNode(node.key)}>{node.name}</button>
    ));

    return (<Accordian title={category}>{buttons}</Accordian>);
  });

  return (<div class="toolbox floating">{accordians}</div>);
};

export default Toolbox;