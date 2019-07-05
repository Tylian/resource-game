import * as redom from 'redom';

import { listMetadata, DataType, getMetadata, NodeMeta } from "./data";
import Node, { InstanceData } from "./Node";

import InfoboxComponent from "./dom/Infobox";
import ToolboxComponent from "./dom/Toolbox";
import { Matrix, mmult } from './utils';

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
    zoom: number;
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

  private infoboxElem: InfoboxComponent;
  private toolboxElem: ToolboxComponent;

  private seenResources = new Set<string>();

  private debug = false;
  private konami: number[] = [];

  private screenMatrix: Matrix;
  private worldMatrix: Matrix;

  get cameraX() { return this.camera.x + this.cameraOffset.x; }
  get cameraY() { return this.camera.y + this.cameraOffset.y; }
  
  constructor(public canvas: HTMLCanvasElement, public ctx = canvas.getContext("2d", { alpha: false }) as CanvasRenderingContext2D) {
    this.canvas.width = document.documentElement.clientWidth;
    this.canvas.height = document.documentElement.clientHeight;

    window.addEventListener("resize", e => {
      this.canvas.width = document.documentElement.clientWidth;
      this.canvas.height = document.documentElement.clientHeight;
      this.updateMatrix();
    });

    document.body.addEventListener('keyup', (e) => {
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

      if(this.debug && key == 70 && this.mouseNode !== null) {
        for(let [key, resource] of this.mouseNode.resources) {
          resource.amount = resource.maximum;
        }
      }

      if(this.debug && key == 69 && this.mouseNode !== null) {
        for(let [key, resource] of this.mouseNode.resources) {
          resource.amount = 0;
        }
      }

    }, true);

    document.body.addEventListener("wheel", (e) => {
      if (e.deltaY > 0) {
        this.camera.zoom /= 1.12;
      }
      else if (e.deltaY < 0) {
        this.camera.zoom *= 1.12;
      }
      this.updateMatrix();
      e.preventDefault();
    })

    canvas.addEventListener("mousedown", (e) => {
      let mouse = this.screenToWorld(e.clientX, e.clientY);
      if(e.button == 0) {
        let node = this.getNodeAt(...mouse);
        if(node !== null) {
          this.dragMode = DragMode.Node;
          this.targetNode = node;
          this.dragOrigin = { x: e.clientX, y: e.clientY };
          this.dragOffset = { x: node.x - mouse[0], y: node.y - mouse[1] };
        }
      } else if(e.button == 2) {
        this.dragMode = DragMode.Camera;
        this.dragOrigin = { x: e.clientX, y: e.clientY }
      } 
    });

    canvas.addEventListener("mousemove", (e) => {
      let mouse = this.screenToWorld(e.clientX, e.clientY);
      this.mouseNode = this.getNodeAt(...mouse);

      if(this.dragMode == DragMode.Camera) {
        this.cameraOffset.x = (this.dragOrigin.x - e.clientX) / this.camera.zoom;
        this.cameraOffset.y = (this.dragOrigin.y - e.clientY) / this.camera.zoom;
        this.updateMatrix();
      } else if(this.dragMode == DragMode.Node && this.targetNode !== null) {
        this.targetNode.move(
          mouse[0] + this.dragOffset.x,
          mouse[1] + this.dragOffset.y
        );
      }

      // Update cursor
      let node = this.getNodeAt(...mouse);
      canvas.classList.toggle("cursor-move", node !== null && !node.manual);
      canvas.classList.toggle("cursor-pointer", node !== null && node.manual);

      if(this.tempNode) {
        this.tempNode.move(...mouse);
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
        this.updateMatrix();
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

    this.infoboxElem = new InfoboxComponent(this);
    this.updateMatrix();
  }

  public mountInfobox(container: HTMLElement) {
    redom.mount(document.body, this.infoboxElem, container, true);
  }

  public mountToolbox(container: HTMLElement) {
    this.toolboxElem = new ToolboxComponent(this, listMetadata(DataType.Node).map(key => getMetadata(DataType.Node, key)));
    redom.mount(document.body, this.toolboxElem, container, true);
  }

  public createNode(id: string) {
    if(this.tempNode == null) {
      this.tempNode = new Node(id);
      this.tempNode.move(Infinity, Infinity); // stops flash of node lol
    }
  }

  public nodeUnlocked(id: string): boolean {
    if(this.debug) return true;

    const data = getMetadata(DataType.Node, id);
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

    const data = getMetadata(DataType.Recipe, id)
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

    this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
    this.ctx.scale(this.camera.zoom, this.camera.zoom);
    this.ctx.translate(-this.cameraX, -this.cameraY);

    let topLeft = this.screenToWorld(0, 0);
    let bottomRight = this.screenToWorld(this.canvas.width, this.canvas.height);
    const distance = 100;

    this.ctx.strokeStyle = "#ddd";
    this.ctx.beginPath();
    for(let x = Math.floor(topLeft[0] / distance) * distance; x < bottomRight[0]; x += distance) {
      for(let y = Math.floor(topLeft[1] / distance) * distance; y < bottomRight[1]; y += distance) {
        
        this.ctx.moveTo(x - 5, y);
        this.ctx.lineTo(x + 5, y);
        this.ctx.moveTo(x, y + -5);
        this.ctx.lineTo(x, y + 5);
      }
    }
    this.ctx.stroke();
    
    this.ctx.lineWidth = 1;
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

    this.ctx.lineWidth = 2;

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
    for(let node of this.nodes.values()) {
      if(Math.pow(x - node.x, 2) + Math.pow(y - node.y, 2) < Math.pow(node.radius, 2)) {
        return node;
      }
    }
    return null;
  }

  public click(e: MouseEvent) {
    let node = this.getNodeAt(...this.screenToWorld(e.clientX, e.clientY));
    switch(e.button) {
      case 0: 
        if(this.tempNode) {
          this.nodes.set(this.tempNode.uuid, this.tempNode);
          this.tempNode = null;
          break;
        }

        if(node !== null) {
          if(e.shiftKey) {
            node.poke();
          } else {
            this.focusNode = node;
          }
        } else if(this.focusNode !== null) {
          this.focusNode = null;
          this.infoboxElem.update(this.focusNode);
        }

        break;
      case 1:
        if(this.focusNode && node !== null) {
          if(e.shiftKey) {
            if(e.ctrlKey) {
              for(let input of this.focusNode.inputs) {
                this.focusNode.removeInput(input);
              }
            } else {
              this.focusNode.toggleInput(node);
            }
          } else {
            if(e.ctrlKey) {
              for(let output of this.focusNode.outputs) {
                this.focusNode.removeOutput(output);
              }
            } else {
              this.focusNode.toggleOutput(node);
            }
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

  public screenToWorld(x: number, y: number): [number, number] {
    let result = mmult([[x, y, 1]], this.worldMatrix);
    return [result[0][0], result[0][1]];
  }

  public worldToScreen(x: number, y: number): [number, number] {
    let result = mmult([[x, y, 1]], this.screenMatrix);
    return [result[0][0], result[0][1]];
  }

  public updateMatrix() {
    const A = [
      [1                    , 0                     , 0],
      [0                    , 1                     , 0],
      [this.canvas.width / 2, this.canvas.height / 2, 1],
    ];
    const B = [
      [this.camera.zoom, 0               , 0],
      [0               , this.camera.zoom, 0],
      [0               , 0               , 1],
    ];
    const C = [
      [1            , 0            , 0],
      [0            , 1            , 0],
      [-this.cameraX, -this.cameraY, 1],
    ];
    
    const D = [
      [1                       , 0                        , 0 ],
      [0                       , 1                        , 0],
      [-(this.canvas.width / 2), -(this.canvas.height / 2), 1],
    ];
    const E = [
      [1 / this.camera.zoom, 0                   , 0],
      [0                   , 1 / this.camera.zoom, 0],
      [0                   , 0                   , 1],
    ];
    const F = [
      [1           , 0           , 0],
      [0           , 1           , 0],
      [this.cameraX, this.cameraY, 1],
    ];

    this.screenMatrix = mmult(mmult(A, B), C);
    this.worldMatrix = mmult(mmult(D, E), F);
  }

  public fromJson(data: SaveData) {
    this.nodes.clear();

    this.camera = { ...data.camera };
    this.updateMatrix();

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
      camera: {...this.camera},
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