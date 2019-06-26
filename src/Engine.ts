import Node, { InstanceData } from "./Node";
import * as redom from 'redom';

import InfoComponent from "./dom/Info";
import { listData, DataType, getData, NodeMeta } from "./data";
import ToolboxComponent from "./dom/Toolbox";

const enum DragMode {
  None,
  Camera,
  Node,
}

interface NodeJson extends InstanceData {
  type: string;
}

interface SaveData {
  seenResources: Iterable<string>;
  camera: {
    x: number;
    y: number;
  }
  nodes: {
    [uuid: string]: NodeJson;
  }
}

interface Point {
  x: number;
  y: number;
}

interface Camera {
  x: number;
  y: number;
  zoom: number;
}

const Konami: number[] = [13, 65, 66, 39, 37, 39, 37, 40, 40, 38, 38];

export default class Engine {
  public nodes = new Map<string, Node>();
  public camera: Camera = { x: 0, y: 0, zoom: 1 };
  public cameraOffset: Point = { x: 0, y: 0 }

  private dragMode: DragMode = DragMode.None;
  private dragOrigin: Point = { x: 0, y: 0 };
  private dragOffset: Point = { x: 0, y: 0 };

  private targetNode: Node | null = null;
  private tempNode: Node | null = null;
  private mouseNode: Node | null = null;
  private focusNode: Node | null = null;

  private infoboxElem: InfoComponent;
  private toolboxElem: ToolboxComponent;

  private seenResources = new Set<string>();

  private debug = false;
  private konami: number[] = [];
  
  constructor(public canvas: HTMLCanvasElement, public ctx = canvas.getContext("2d", { alpha: false }) as CanvasRenderingContext2D) {
    document.addEventListener('keyup', (e) => {
      let key = e.which || e.keyCode;
      
      if(process.env.NODE_ENV == "development" && this.debug) {
        console.log(`${e.key}: ${key}`);
      }

      if((key == 46 || key == 8) && this.focusNode !== null) {
        this.focusNode.clearConnections();
        this.nodes.delete(this.focusNode.uuid);
        this.focusNode = null;
        this.infoboxElem.update(null);
      }

      this.konami = [key, ...this.konami].slice(0, Konami.length);
      if(this.konami.every((v, i) => v == Konami[i])) {
        this.debugMode();
      }

      if(this.debug && key == 70 && this.focusNode !== null) {
        for(let [key, resource] of this.focusNode.resources) {
          resource.amount = resource.maximum;
        }
      }

      if(this.debug && key == 69 && this.focusNode !== null) {
        for(let [key, resource] of this.focusNode.resources) {
          resource.amount = 0;
        }
      }

    }, true);

    canvas.addEventListener("mousedown", (e) => {
      if(e.button == 0) {
        let node = this.getNodeAt(e.clientX, e.clientY);
        if(node !== null) {
          this.dragMode = DragMode.Node;
          this.targetNode = node;
          this.dragOrigin = { x: e.clientX, y: e.clientY };
          this.dragOffset = {
            x: node.x - (this.camera.x + e.clientX),
            y: node.y - (this.camera.y + e.clientY)
          };
        }
      } else if(e.button == 2) {
        this.dragMode = DragMode.Camera;
        this.dragOrigin = {
          x: e.clientX,
          y: e.clientY
        }
      } 
    });
    canvas.addEventListener("mousemove", (e) => {
      this.mouseNode = this.getNodeAt(e.clientX, e.clientY);
      if(this.dragMode == DragMode.Camera) {
        this.cameraOffset.x = this.dragOrigin.x - e.clientX;
        this.cameraOffset.y = this.dragOrigin.y - e.clientY;
      } else if(this.dragMode == DragMode.Node && this.targetNode !== null) {
        this.targetNode.move(
          (this.camera.x + e.clientX) + this.dragOffset.x,
          (this.camera.y + e.clientY) + this.dragOffset.y
        );
      }

      // Update cursor
      let node = this.getNodeAt(e.clientX, e.clientY);
      canvas.classList.toggle("cursor-move", node !== null && !node.manual);
      canvas.classList.toggle("cursor-pointer", node !== null && node.manual);

      if(this.tempNode) {
        this.tempNode.move(this.camera.x + e.clientX, this.camera.y + e.clientY);
      }
    });
    canvas.addEventListener("mouseup", (e) => {
      if(this.dragMode == DragMode.None || this.dragMode > DragMode.None && (e.clientX == this.dragOrigin.x && e.clientY == this.dragOrigin.y)) {
        this.click(e);
      }

      if(this.dragMode == DragMode.Camera && e.button == 2) {
        this.camera.x += this.cameraOffset.x;
        this.camera.y += this.cameraOffset.y;
        this.dragMode = DragMode.None;
        this.cameraOffset = { x: 0, y: 0 };
      } else if(this.dragMode == DragMode.Node && e.button == 0) {
        this.dragMode = DragMode.None;
        this.dragOffset = { x: 0, y: 0 };
        this.targetNode = null;
      }
    });

    canvas.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      return false;
    });

    this.infoboxElem = new InfoComponent(this);
  }

  public mountInfobox(container: HTMLElement) {
    redom.mount(document.body, this.infoboxElem, container, true);
  }

  public mountToolbox(container: HTMLElement) {
    this.toolboxElem = new ToolboxComponent(this, listData(DataType.Node).map(key => <NodeMeta>getData(DataType.Node, key)));
    redom.mount(document.body, this.toolboxElem, container, true);
  }

  public createNode(id: string) {
    if(this.tempNode == null) {
      this.tempNode = new Node(id);
    }
  }

  public nodeUnlocked(id: string): boolean {
    if(this.debug) return true;

    const data = getData(DataType.Node, id);
    if(data === null) return false;
    for(let ingredient of Object.keys(data.ingredients)) {
      if(!this.seenResources.has(ingredient)) {
        return false;
      }
    }
    return true;
  }

  public recipeUnlocked(id: string): boolean {
    if(this.debug) return true;

    const data = getData(DataType.Recipe, id)
    if(data === null) return false;
    for(let ingredient of Object.keys(data.ingredients)) {
      if(!this.seenResources.has(ingredient)) {
        return false;
      }
    }
    return true;
  }
  
  public tick() {
    for(let node of this.nodes.values()) {
      node.tick();
    }

    for(let node of this.nodes.values()) {
      for(let [key, resource] of node.resources) {
        if(!this.seenResources.has(key) && resource.amount > 0) {
          this.seenResources.add(key);
          this.toolboxElem.update();
        }
      }
    }

    if(this.focusNode !== null) {
      this.infoboxElem.update(this.focusNode);
    }
  }

  public render() {
    this.ctx.resetTransform();
    this.ctx.fillStyle = 'white';
    this.ctx.fillRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
    this.ctx.translate(-(this.camera.x + this.cameraOffset.x), -(this.camera.y + this.cameraOffset.y));
    
    for(let [uuid, node] of this.nodes) {
      for(let output of node.outputs) {
        if(!(node.equals(this.focusNode) || node.equals(this.mouseNode))) {
          node.drawOutputLine(this.ctx, output, 'rgba(0, 0, 0, 0.5)');
        }
      }
    }
    
    for(let [uuid, node] of this.nodes) {
      node.render(this.ctx, node.equals(this.focusNode));
    }

    if(this.mouseNode !== null && !this.mouseNode.equals(this.focusNode)) {
      for(let output of this.mouseNode.outputs) {
        this.mouseNode.drawOutputLine(this.ctx, output, 'black');
      }
    }

    if(this.focusNode !== null) {
      for(let output of this.focusNode.outputs) {
        this.focusNode.drawOutputLine(this.ctx, output, 'green');
      }
    }

    // XXX Can't combine with above loop because it renders under stuff
    if(this.tempNode !== null) {
      this.ctx.globalAlpha = 0.5;
      this.tempNode.render(this.ctx, false);
      this.ctx.globalAlpha = 1;
    }
  }
  

  public getNodeAt(x: number, y: number): Node | null {
    let realX = this.camera.x + x;
    let realY = this.camera.y + y;
    for(let node of this.nodes.values()) {
      if(Math.pow(realX - node.x, 2) + Math.pow(realY - node.y, 2) < Math.pow(node.radius, 2)) {
        return node;
      }
    }
    return null;
  }

  public click(e: MouseEvent) {
    let node = this.getNodeAt(e.clientX, e.clientY);
    switch(e.button) {
      case 0: 
        if(this.tempNode) {
          this.nodes.set(this.tempNode.uuid, this.tempNode);
          this.tempNode = null;
          break;
        }

        if(node !== null) {
          this.focusNode = node;
        } else if(this.focusNode !== null) {
          this.focusNode = null;
        }

        break;
      case 1:
        if(this.focusNode && node !== null) {
          if(e.shiftKey) {
            this.focusNode.toggleInput(node);
          } else {
            this.focusNode.toggleOutput(node);
          }
          
        }
        break;
      case 2: 
        if(this.tempNode) {
          this.tempNode = null;
        }
    }
  }

  public getNode(uuid: string): Node | undefined {
    return this.nodes.get(uuid);
  }

  public debugMode() {
    console.log('Debug mode enabled');
    this.debug = true;
    this.toolboxElem.update();
    this.infoboxElem.update(this.focusNode);
  }

  public fromJson(data: SaveData) {
    this.nodes.clear();

    this.camera.x = data.camera.x;
    this.camera.y = data.camera.y;

    this.seenResources = new Set(data.seenResources);
    // create nodes
    for(let [uuid, info] of Object.entries(data.nodes)) {
      let node = new Node(info.type, uuid);
      this.nodes.set(node.uuid, node);
      node.loadJson(info);
    }

    // load all data
    for(let [uuid, node] of this.nodes) {
      data.nodes[uuid].outputs.forEach(uuid => {
        let output = this.nodes.get(uuid);
        if(output !== undefined) {
          node.addOutput(output);
        }
      });
    }

    this.focusNode = null;
    this.infoboxElem.update(null);
    this.toolboxElem.update();
  }

  public toJson(): SaveData {
    let result: SaveData = {
      camera: {
        x: this.camera.x,
        y: this.camera.y
      },
      nodes: {},
      seenResources: [...this.seenResources]
    };

    // create nodes
    for(let [uuid, node] of this.nodes) {
      result.nodes[uuid] = {
        type: node.type,
        ...node.toJson()
      };
    }

    return result;
  }
}