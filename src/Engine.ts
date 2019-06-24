import Machine, { InstanceData } from "./Machine";
import * as redom from 'redom';

import translate from './i18n';
import InfoComponent from "./dom/Info";
const i18n = translate('en-US');

const enum DragMode {
  None,
  Camera,
  Machine,
}

interface MachineJson extends InstanceData {
  type: string;
}

interface SaveData {
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
  
  constructor(public canvas: HTMLCanvasElement, infoContainer: HTMLElement, public ctx = canvas.getContext("2d")) {
    canvas.addEventListener("mousedown", (e) => {
      if(e.button == 2) {
        this.dragMode = DragMode.Camera;
        this.dragOrigin = {
          x: e.clientX,
          y: e.clientY
        }
      } else if(e.button == 0) {
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
      }
    });
    canvas.addEventListener("mousemove", (e) => {
      if(this.dragMode == DragMode.Camera) {
        this.cameraOffset.x = this.dragOrigin.x - e.clientX;
        this.cameraOffset.y = this.dragOrigin.y - e.clientY;
      } else if(this.dragMode == DragMode.Machine) {
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

    this.infoNode = new InfoComponent(this.machineFocus);
    redom.mount(document.body, this.infoNode, infoContainer, true);
  }

  public createMachine(id: string) {
    if(this.tempMachine == null) {
      this.tempMachine = new Machine(id);
    }
  }
  
  public tick() {
    for(let machine of this.machines.values()) {
      machine.tick();
    }

    if(this.machineFocus !== null) {
      this.infoNode.update(this.machineFocus);
    }
  }

  public render() {
    this.ctx.resetTransform();
    this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
    this.ctx.translate(-(this.camera.x + this.cameraOffset.x), -(this.camera.y + this.cameraOffset.y));
    for(let [uuid, machine] of this.machines) {
      machine.render(this.ctx, this.machineFocus !== null && this.machineFocus.uuid == uuid);
    }

    // XXX Can't combine with above loop because it renders under stuff
    for(let [uuid, machine] of this.machines) {
      for(let output of machine.outputs) {
        this.drawOutputLine(machine, output);
      }
    }

    if(this.tempMachine) {
      this.ctx.globalAlpha = 0.5;
      this.tempMachine.render(this.ctx, false);
      this.ctx.globalAlpha = 1;
    }
  }

  private drawOutputLine(input: Machine, output: Machine) {
    this.ctx.save();
    this.ctx.fillStyle = "transparent";
    this.ctx.strokeStyle = "2px solid black";
    let angle = Math.atan2(output.y - input.y, output.x - input.x);
    let head = 10;

    let fromX = input.x + Math.cos(angle) * input.radius;
    let fromY = input.y + Math.sin(angle) * input.radius;
    let toX = output.x - Math.cos(angle) * output.radius;
    let toY = output.y - Math.sin(angle) * output.radius;

    this.ctx.beginPath();
    this.ctx.moveTo(fromX, fromY);
    this.ctx.lineTo(toX, toY);
    
    this.ctx.lineTo(toX - head * Math.cos(angle - Math.PI/6), toY - head * Math.sin(angle - Math.PI/6));
    this.ctx.moveTo(toX, toY);
    this.ctx.lineTo(toX - head * Math.cos(angle + Math.PI/6), toY - head * Math.sin(angle + Math.PI/6));
    this.ctx.stroke();
    this.ctx.restore();
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

  public fromJson(data: SaveData) {
    this.machines.clear();

    this.camera.x = data.camera.x;
    this.camera.y = data.camera.y;

    // create machines
    for(let [uuid, info] of Object.entries(data.machines)) {
      let machine = new Machine(info.type, uuid);
      this.machines.set(machine.uuid, machine);
      machine.loadJson(info);
    }

    // load all data
    for(let [uuid, info] of Object.entries(data.machines)) {
      let machine = this.machines.get(uuid);
      info.outputs.forEach(uuid => {
        machine.addOutput(this.machines.get(uuid));
      });
    }
  }

  public toJson(): SaveData {
    let result: SaveData = {
      camera: {
        x: this.camera.x,
        y: this.camera.y
      },
      machines: {}
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