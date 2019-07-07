import { bind } from "decko";
import { h, Component, RenderableProps } from "preact";
import { listMetadata, DataType, getMetadata } from '../utils/data';
import Engine from "../Engine";
import Infobox, { NodeInfo, RecipeInfo } from './Infobox';
import Node, { Resource } from "../Node";
import Toolbox, { ToolboxNode } from './Toolbox';

interface AppState {
  nodes: ToolboxNode[];
  categories: string[];
  infoNode: NodeInfo | null;
}

export default class App extends Component {
  engine: Engine = new Engine();
  canvas: HTMLCanvasElement;
  state: AppState = {
    nodes: [],
    categories: [],
    infoNode: null
  };

  componentDidMount() {
    this.engine.mount(this.canvas);
    this.engine.on('toolbox', () => {
      this.updateToolbox();
    });
    this.engine.on('infobox', () => {
      this.updateInfobox();
    });

    const render = () => {
      this.engine.render();
      requestAnimationFrame(render);
    };
    
    setInterval(() => { this.engine.update(); }, 1000 / 20);
    render();

    if(window.localStorage.getItem('savestring') !== null) {
      try {
        let json = JSON.parse(window.localStorage.getItem('savestring'));
        this.engine.fromJson(json);
      } catch(e) { console.error('Failed to load save from localStorage'); console.error(e); }
    }

    setInterval(() => {
      window.localStorage.setItem('savestring', JSON.stringify(this.engine.toJson()));
    }, 30000);

    this.updateToolbox();
    this.updateInfobox();
  }

  @bind
  saveGame() {
    let save = JSON.stringify(this.engine.toJson());
    prompt("Here's a save string, click load and enter it to load it:", save);
  }

  @bind
  loadGame() {
    let save = prompt("Enter a save string:", "");
    if(save == "") {
      if(confirm("Loading an empty string will reset the game to the beginnig, are you sure?")) {
        this.engine.reset();
      }
      return;
    }
    
    if(save) {
      try {
        this.engine.fromJson(JSON.parse(save));
      } catch(e) {
        alert("Could not load save, maybe it's invalid?\n\n" + e);
      }
    }
  }

  updateToolbox() {
    let nodes =  listMetadata(DataType.Node)
      .map(key => getMetadata(DataType.Node, key))
      .map(node => ({
        key: node.key,
        name: node.name,
        category: node.category,
        visible: this.engine.nodeUnlocked(node.key)
      }));
    
    let categories = nodes.map(node => node.category)
      .filter((value, i, arr) => arr.indexOf(value) == i);

    this.setState({ nodes, categories });
  }

  updateInfobox() {
    if(!(this.engine.focusNode instanceof Node)) {
      this.setState({ infoNode: null });
    } else {
      const node = this.engine.focusNode;
      let recipeInfo: RecipeInfo = null;
      if(node.recipe !== null) {
        recipeInfo = {
          key: node.recipeName,
          speed: node.recipe.speed,
          inputs: node.recipe.ingredients,
          outputs: node.recipe.results
        }
      }

      this.setState({
        infoNode: {
          type: node.type,
          manual: node.manual,
          resources: Array.from(node.resources).reduce<{ [key: string]: Resource }>((obj, [key, value]) => (obj[key] = value, obj), {}),
          recipe: recipeInfo,
          recipes: node.recipes,
          ghost: node.isGhost()
        }
      })
    }
  }

  render(props: RenderableProps<{}>, state: AppState) {
    return (<div id="app">
      <Toolbox engine={this.engine} nodes={state.nodes} categories={state.categories} />
      { state.infoNode && <Infobox engine={this.engine} node={this.engine.focusNode} info={state.infoNode}  /> }
      <div class="controls floating">
        <div class="column">
          Left click = Select & View Info, Drag<br />
          Middle click = Connect Node Output<br />
          Shift + Middle click = Connect Node Input<br />
        </div>
        <div class="column">
          Right click = Pan View, Cancel Placement<br />
          Delete key = Delete Selected
        </div>
      </div>
      
      <div class="data floating">
        Game auto-saves every 30 seconds. <br />
        <button onClick={this.saveGame}>Save</button>
        <button onClick={this.loadGame}>Load</button>
      </div>
      <canvas id="game" ref={el => this.canvas = el}></canvas>
    </div>);
  }  
}