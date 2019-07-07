import { EventEmitter } from 'events';
import { DataType, getMetadata } from "./utils/data";
import Node, { InstanceData } from "./Node";

import { Matrix, mmult, circleInAABB, Point } from './utils/math';
import { bind } from 'decko';

const SAVE_VERSION = 3;

const enum DragMode {
  None,
  Camera,
  Node,
}

interface NodeJson extends InstanceData {
  type: string;
}

interface SaveData {
  version: number,
  camera: {
    x: number;
    y: number;
    zoom: number;
  }
  time: number;
  nodes: {
    [uuid: string]: NodeJson;
  },
  seenResources: string[];
}

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

const Konami: number[] = [13, 65, 66, 39, 37, 39, 37, 40, 40, 38, 38];

export default class Engine extends EventEmitter {
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;

  public nodes = new Map<string, Node>();
  public camera: Camera = { x: 0, y: 0, zoom: 1 };
  public cameraOffset: Point = new Point(0, 0)

  private dragMode: DragMode = DragMode.None;
  private dragOrigin: Point = new Point(0, 0);
  private dragOffset: Point = new Point(0, 0);

  private targetNode: Node | null = null;
  private tempNode: Node | null = null;
  private mouseNode: Node | null = null;
  public focusNode: Node | null = null;

  private domElement: Element;

  private seenResources = new Set<string>();

  private debug = false;
  private konami: number[] = [];

  private screenMatrix: Matrix;
  private worldMatrix: Matrix;

  private screenAABB: [Point, Point];

  get cameraX() { return this.camera.x + this.cameraOffset.x; }
  get cameraY() { return this.camera.y + this.cameraOffset.y; }

  get canvasWidth() { return this.canvas ? this.canvas.width : 0; }
  get canvasHeight() { return this.canvas ? this.canvas.height : 0; }

  private timeBase = (performance || Date).now();
  private timeOffset = 0;
  private timeScale = 1;

  private lastTick = this.time;

  get time() {
    return this.timeOffset + ((performance || Date).now() - this.timeBase) / 1000 * this.timeScale;
  }

  public mount(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D = canvas.getContext("2d", { alpha: false })) {
    this.canvas = canvas;
    this.ctx = ctx;

    this.canvas.width = document.documentElement.clientWidth;
    this.canvas.height = document.documentElement.clientHeight;

    this.bindEvents();
    this.updateMatrix();
  }

  public bindEvents() {
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

      if((key == 46 || key == 8) && this.focusNode instanceof Node) {
        this.focusNode.clearConnections();
        this.nodes.delete(this.focusNode.uuid);
        this.setFocusNode(null);
      }

      this.konami = [key, ...this.konami].slice(0, Konami.length);
      if(this.konami.every((v, i) => v == Konami[i])) {
        this.debugMode();
      }

      if(this.debug && key == 70 && this.mouseNode instanceof Node) {
        for(let [key, resource] of this.mouseNode.resources) {
          resource.amount = resource.maximum;
        }
      }

      if(this.debug && key == 69 && this.mouseNode instanceof Node) {
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

    this.canvas.addEventListener("mousedown", (e) => {
      let mouse = this.screenToWorld(e.clientX, e.clientY);
      if(e.button == 0) {
        let node = this.getNodeAt(...mouse);
        if(node instanceof Node) {
          this.dragMode = DragMode.Node;
          this.targetNode = node;
          this.dragOrigin = new Point(e.clientX, e.clientY);
          this.dragOffset = new Point(node.x - mouse[0], node.y - mouse[1]);
        }
      } else if(e.button == 2) {
        this.dragMode = DragMode.Camera;
        this.dragOrigin = new Point(e.clientX, e.clientY)
      } 
    });

    this.canvas.addEventListener("mousemove", (e) => {
      let mouse = this.screenToWorld(e.clientX, e.clientY);
      this.mouseNode = this.getNodeAt(...mouse);

      if(this.dragMode == DragMode.Camera) {
        this.cameraOffset.x = (this.dragOrigin.x - e.clientX) / this.camera.zoom;
        this.cameraOffset.y = (this.dragOrigin.y - e.clientY) / this.camera.zoom;
        this.updateMatrix();
      } else if(this.dragMode == DragMode.Node && this.targetNode instanceof Node) {
        let x = mouse[0] + this.dragOffset.x;
        let y = mouse[1] + this.dragOffset.y;
        let gridSnap = e.shiftKey ? (e.ctrlKey ? this.targetNode.radius / 2 : this.targetNode.radius) : 0;

        if(gridSnap > 0) {
          x = Math.round(x / gridSnap) * gridSnap;
          y = Math.round(y / gridSnap) * gridSnap;
        }

        this.targetNode.move(x, y);
      }

      // Update cursor
      let node = this.getNodeAt(...mouse);
      this.canvas.classList.toggle("cursor-move", node instanceof Node && !node.manual);
      this.canvas.classList.toggle("cursor-pointer", node instanceof Node && node.manual);

      if(this.tempNode) {
        this.tempNode.move(...mouse);
      }
    });

    this.canvas.addEventListener("mouseup", (e) => {
      if(this.dragMode == DragMode.None || this.dragMode > DragMode.None && (e.clientX == this.dragOrigin.x && e.clientY == this.dragOrigin.y)) {
        this.click(e);
      }

      if(this.dragMode == DragMode.Camera && e.button == 2) {
        this.camera.x += this.cameraOffset.x;
        this.camera.y += this.cameraOffset.y;
        this.dragMode = DragMode.None;
        this.cameraOffset = new Point(0, 0);
        this.updateMatrix();
      } else if(this.dragMode == DragMode.Node && e.button == 0) {
        this.dragMode = DragMode.None;
        this.dragOffset = new Point(0, 0);
        this.targetNode = null;
      }
    });

    this.canvas.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      return false;
    });
  }

  /*
  public mountInfobox(container: HTMLElement) {
    redom.mount(document.body, this.infoboxElem, container, true);
  }

  public mountToolbox(container: HTMLElement) {
    this.toolboxElem = new ToolboxComponent(this, listMetadata(DataType.Node).map(key => getMetadata(DataType.Node, key)));
    redom.mount(document.body, this.toolboxElem, container, true);
  }
  */

  public createNode(id: string) {
    if(!(this.tempNode instanceof Node)) {
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

  public update() {
    for(let node of this.nodes.values()) {
      node.update(this.time);
    }

    for(let node of this.nodes.values()) {
      for(let [key, resource] of node.resources) {
        if(!this.seenResources.has(key) && resource.amount > 0) {
          this.seenResources.add(key);
          this.emit('toolbox');
        }
      }
    }

    this.lastTick = this.time;
  }

  public render() {
    this.ctx.save();
    this.ctx.resetTransform();
    this.ctx.fillStyle = 'white';
    this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

    this.ctx.translate(this.canvasWidth / 2, this.canvasHeight / 2);
    this.ctx.scale(this.camera.zoom, this.camera.zoom);
    this.ctx.translate(-this.cameraX, -this.cameraY);

    let topLeft = this.screenToWorld(0, 0);
    let bottomRight = this.screenToWorld(this.canvasWidth, this.canvasHeight);
    const distance = 100;

    this.ctx.strokeStyle = "#ddd";
    this.ctx.lineWidth = 1;
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
    this.ctx.beginPath();
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    for(let [uuid, node] of this.nodes) {
      for(let output of node.outputs) {
        if(!(node.equals(this.focusNode) || node.equals(this.mouseNode))) {
          node.drawOutputLine(this.ctx, output, this.screenAABB);
        }
      }
    }
    this.ctx.stroke();
    
    for(let [uuid, node] of this.nodes) {
      if(this.isNodeVisible(node)) {
        node.render(this.ctx, this.time, node.equals(this.focusNode));
      }
    }

    this.ctx.lineWidth = 2;
    if(this.mouseNode instanceof Node && !this.mouseNode.equals(this.focusNode)) {
      this.ctx.strokeStyle = this.mouseNode.isGhost() ? 'rgba(0,0,0,0.5)' : 'black';
      this.ctx.beginPath();
      for(let output of this.mouseNode.outputs) {
        this.mouseNode.drawOutputLine(this.ctx, output, this.screenAABB);
      }
      this.ctx.stroke();
    }
    

    if(this.focusNode instanceof Node) {
      this.ctx.strokeStyle = this.focusNode.isGhost() ? 'rgba(0,0,80,0.5)' : 'green';
      this.ctx.beginPath();
      for(let output of this.focusNode.outputs) {
        this.focusNode.drawOutputLine(this.ctx, output, this.screenAABB);
      }
      this.ctx.stroke();
    }

    // XXX Can't combine with above loop because it renders under stuff
    if(this.tempNode instanceof Node) {
      this.ctx.globalAlpha = 0.5;
      this.tempNode.render(this.ctx, this.time, false);
      this.ctx.globalAlpha = 1;
    }
    this.ctx.restore();
  }

  @bind
  private emitInfobox() {
    this.emit('infobox');
  }
  
  public setFocusNode(node: Node | null) {
    if(this.focusNode instanceof Node) {
      this.focusNode.removeListener('update', this.emitInfobox);
    }

    this.focusNode = node;
    this.emit('infobox');

    if(node instanceof Node) {
      node.on('update', this.emitInfobox);
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

        if(node instanceof Node) {
          if(e.shiftKey) {
            node.poke();
          } else {
            this.setFocusNode(node);
          }
        } else if(this.focusNode instanceof Node) {
          this.setFocusNode(null);
        }

        break;
      case 1:
        if(this.focusNode instanceof Node && node instanceof Node) {
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

  public isNodeVisible(node: Node) {
    return circleInAABB(this.screenAABB, new Point(node.x, node.y), node.radius);
  }

  public setTimescale(scale: number) {
    this.timeOffset = this.time;
    this.timeBase = (performance || Date).now();
    this.timeScale = scale;
  }

  public debugMode() {
    console.log('Debug mode enabled');
    this.debug = true;
    this.emit('toolbox');
    this.emit('infobox');
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
    const A = [[1, 0, 0], [0, 1, 0], [this.canvasWidth / 2, this.canvasHeight / 2, 1]];
    const B = [[this.camera.zoom, 0, 0],[0, this.camera.zoom, 0],[0, 0, 1]];
    const C = [[1, 0, 0], [0 , 1 , 0], [-this.cameraX, -this.cameraY, 1]];
    
    const D = [[1 , 0 , 0 ], [0 , 1 , 0], [-(this.canvasWidth / 2), -(this.canvasHeight / 2), 1]];
    const E = [[1 / this.camera.zoom, 0 , 0], [0 , 1 / this.camera.zoom, 0], [0 , 0 , 1]];
    const F = [[1 , 0 , 0], [0 , 1 , 0], [this.cameraX, this.cameraY, 1]];

    this.screenMatrix = mmult(mmult(A, B), C);
    this.worldMatrix = mmult(mmult(D, E), F);

    let topLeft = this.screenToWorld(0, 0);
    let bottomRight = this.screenToWorld(this.canvasWidth, this.canvasHeight);

    this.screenAABB = [
      new Point(topLeft[0], topLeft[1]),
      new Point(bottomRight[0], bottomRight[1]),
    ]
  }

  public fromJson(save: SaveData) {
    this.reset();

    if(save.version !== SAVE_VERSION) {
      alert("Loading a save from a different version, migration is not implemented yet so this break things and/or void your warrenty");
    }

    this.timeOffset = save.time;
    this.camera = { ...save.camera };
    this.updateMatrix();

    this.seenResources = new Set(save.seenResources);
    // create nodes
    for(let [uuid, info] of Object.entries(save.nodes)) {
      let node = new Node(info.type, uuid);
      this.nodes.set(node.uuid, node);
      node.loadJson(info);
    }

    // load all data
    for(let [uuid, node] of this.nodes) {
      save.nodes[uuid].outputs.forEach(uuid => {
        let output = this.nodes.get(uuid);
        if(output !== undefined) {
          node.addOutput(output);
        }
      });
    }

    this.nodes.entries

    this.lastTick = this.time;
  }

  public toJson(): SaveData {
    let result: SaveData = {
      version: SAVE_VERSION,
      camera: {...this.camera},
      time: this.time,
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

  public reset() {
    this.seenResources.clear();
    this.nodes.clear();

    this.timeBase = (performance || Date).now();
    this.timeOffset = 0;
    this.timeScale = 1;
    this.camera = { x: 0, y: 0, zoom: 1};
    this.cameraOffset = new Point(0, 0);
    this.dragMode = DragMode.None;

    this.updateMatrix();

    this.setFocusNode(null);
    this.mouseNode = null;
    this.tempNode = null;

    this.konami = [];
    this.debug = false;

    // this.infoboxElem.update(null);
    // this.toolboxElem.update();
    this.emit('toolbox');

    this.lastTick = this.time;
  }
}