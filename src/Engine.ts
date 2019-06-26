import Machine, { InstanceData } from "./Machine";
import * as redom from 'redom';

import translate from './i18n';
import InfoComponent from "./dom/Info";
import { listData, DataType, getData } from "./data";
import ToolboxComponent from "./dom/Toolbox";

const enum DragMode {
  None,
  Camera,
  Machine,
}

interface MachineJson extends InstanceData {
  type: string;
}

interface SaveData {
  seenResources: Iterable<string>;
  camera: {
    x: number;
    y: number;
  }
  machines: {
    [uuid: string]: MachineJson;
  }
}

interface Point {
  x: number;
  y: number;
}


const Konami: number[] = [13, 65, 66, 39, 37, 39, 37, 40, 40, 38, 38];

export default class Engine {
  public machines = new Map<string, Machine>();
  public camera: Point = { x: 0, y: 0 };
  public cameraOffset: Point = { x: 0, y: 0 }

  private dragMode: DragMode = DragMode.None;
  private dragOrigin: Point = { x: 0, y: 0 };
  private dragOffset: Point = { x: 0, y: 0 };

  private machineTarget: Machine = null;
  private tempMachine: Machine = null;

  private machineFocus: Machine = null;
  private infoNode: InfoComponent;
  private toolboxNode: ToolboxComponent;

  private seenResources = new Set<string>();
  
  private debug = false;
  private konami: number[] = [];
  
    document.addEventListener('keyup', (e) => {
      let key = e.which || e.keyCode;
      
      if(process.env.NODE_ENV == "development" && this.debug) {
        console.log(`${e.key}: ${key}`);
      }

      if((key == 46 || key == 8) && this.machineFocus !== null) {
        this.machineFocus.clearConnections();
        this.machines.delete(this.machineFocus.uuid);
        this.machineFocus = null;
        this.infoNode.update(null);
      }

      this.konami = [key, ...this.konami].slice(0, Konami.length);
      if(this.konami.every((v, i) => v == Konami[i])) {
        this.debugMode();
      }

      if(this.debug && key == 70 && this.machineFocus !== null) {
        for(let [key, resource] of this.machineFocus.resources) {
          resource.amount = resource.maximum;
        }
      }

      if(this.debug && key == 69 && this.machineFocus !== null) {
        for(let [key, resource] of this.machineFocus.resources) {
          resource.amount = 0;
        }
      }

    }, true);

    canvas.addEventListener("mousedown", (e) => {
      if(e.button == 0) {
        let machine = this.getMachineAt(e.clientX, e.clientY);
        if(machine !== null) {
          this.dragMode = DragMode.Machine;
          this.machineTarget = machine;
          this.dragOrigin = { x: e.clientX, y: e.clientY };
          this.dragOffset = {
            x: machine.x - (this.camera.x + e.clientX),
            y: machine.y - (this.camera.y + e.clientY)
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
      this.mouseMachine = this.getMachineAt(e.clientX, e.clientY);
      if(this.dragMode == DragMode.Camera) {
        this.cameraOffset.x = this.dragOrigin.x - e.clientX;
        this.cameraOffset.y = this.dragOrigin.y - e.clientY;
      } else if(this.dragMode == DragMode.Machine && this.machineTarget !== null) {
        this.machineTarget.move(
          (this.camera.x + e.clientX) + this.dragOffset.x,
          (this.camera.y + e.clientY) + this.dragOffset.y
        );
      }

      // Update cursor
      let machine = this.getMachineAt(e.clientX, e.clientY);
      canvas.classList.toggle("cursor-move", machine !== null && !machine.manual);
      canvas.classList.toggle("cursor-pointer", machine !== null && machine.manual);

      if(this.tempMachine) {
        this.tempMachine.move(this.camera.x + e.clientX, this.camera.y + e.clientY);
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
      } else if(this.dragMode == DragMode.Machine && e.button == 0) {
        this.dragMode = DragMode.None;
        this.dragOffset = { x: 0, y: 0 };
        this.machineTarget = null;
      }
    });

    canvas.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      return false;
    });

    this.infoNode = new InfoComponent(this);
  }

  public mountInfobox(container: HTMLElement) {
    redom.mount(document.body, this.infoNode, container, true);
  }

  public mountToolbox(container: HTMLElement) {
    this.toolboxNode = new ToolboxComponent(this, listData(DataType.Machine).map(key => getData(DataType.Machine, key)));
    redom.mount(document.body, this.toolboxNode, container, true);
  }

  public createMachine(id: string) {
    if(this.tempMachine == null) {
      this.tempMachine = new Machine(id);
    }
  }

  public machineUnlocked(id: string): boolean {
    if(this.debug) return true;
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
    for(let machine of this.machines.values()) {
      machine.tick();
    }

    for(let machine of this.machines.values()) {
      for(let [key, resource] of machine.resources) {
        if(!this.seenResources.has(key) && resource.amount > 0) {
          this.seenResources.add(key);
          this.toolboxNode.update();
        }
      }
    }

    if(this.machineFocus !== null) {
      this.infoNode.update(this.machineFocus);
    }
  }

  public render() {
    this.ctx.resetTransform();
    this.ctx.fillStyle = 'white';
    this.ctx.fillRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
    this.ctx.translate(-(this.camera.x + this.cameraOffset.x), -(this.camera.y + this.cameraOffset.y));
    for(let [uuid, machine] of this.machines) {
      machine.render(this.ctx, machine.equals(this.machineFocus) ? 'green' : 'black');
    }

    // XXX Can't combine with above loop because it renders under stuff
    for(let [uuid, machine] of this.machines) {
      for(let output of machine.outputs) {
        machine.drawOutputLine(this.ctx, output, machine.equals(this.machineFocus) ? 'green' : 'black');
      }
    }

    if(this.tempMachine) {
      this.ctx.globalAlpha = 0.5;
      this.tempMachine.render(this.ctx, "black");
      this.ctx.globalAlpha = 1;
    }
  }
  

  public getMachineAt(x: number, y: number): Machine | null {
    let realX = this.camera.x + x;
    let realY = this.camera.y + y;
    for(let machine of this.machines.values()) {
      if(Math.pow(realX - machine.x, 2) + Math.pow(realY - machine.y, 2) < Math.pow(machine.radius, 2)) {
        return machine;
      }
    }
    return null;
  }

  public click(e: MouseEvent) {
    let machine = this.getMachineAt(e.clientX, e.clientY);
    switch(e.button) {
      case 0: 
        if(this.tempMachine) {
          this.machines.set(this.tempMachine.uuid, this.tempMachine);
          this.tempMachine = null;
          break;
        }

        if(machine !== null) {
          this.machineFocus = machine;
        } else if(this.machineFocus !== null) {
          this.machineFocus = null;
        }

        break;
      case 1:
        if(this.machineFocus && machine !== null) {
          this.machineFocus.toggleOutput(machine);
        }
        break;
      case 2: 
        if(this.tempMachine) {
          this.tempMachine = null;
        }
    }
  }

  public fillMachine() {
    for(let [key, resource] of this.machineFocus.resources) {
      resource.amount = resource.maximum;
    }

  public debugMode() {
    console.log('Debug mode enabled');
    this.debug = true;
    this.toolboxNode.update();
    this.infoNode.update(this.machineFocus);
  }

  public fromJson(data: SaveData) {
    this.machines.clear();

    this.camera.x = data.camera.x;
    this.camera.y = data.camera.y;

    this.seenResources = new Set(data.seenResources);

    // create machines
    for(let [uuid, info] of Object.entries(data.machines)) {
      let machine = new Machine(info.type, uuid);
      this.machines.set(machine.uuid, machine);
      machine.loadJson(info);
      
    }

    console.log('created');

    // load all data
    for(let [uuid, info] of Object.entries(data.machines)) {
      let machine = this.machines.get(uuid);
      info.outputs.forEach(uuid => {
        machine.addOutput(this.machines.get(uuid));
      });
    }

    this.machineFocus = null;
    this.infoNode.update(null);
    this.toolboxNode.update();
  }

  public toJson(): SaveData {
    let result: SaveData = {
      camera: {
        x: this.camera.x,
        y: this.camera.y
      },
      machines: {},
      seenResources: [...this.seenResources]
    };

    // create machines
    for(let [uuid, machine] of this.machines) {
      result.machines[uuid] = {
        type: machine.type,
        ...machine.toJson()
      };
    }

    return result;
  }
}