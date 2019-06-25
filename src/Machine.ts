import uuidv4 from 'uuid/v4';

import translate from './i18n';
const i18n = translate('en-US');

const PI2 = Math.PI * 2;
const nHalfPI = -Math.PI / 2;

import { el, RedomComponent, list } from 'redom';
import { getData, DataType, hasData, RecipeMeta, ResourceMap, ChanceRecipe } from './data';

export interface InstanceData {
  x: number;
  y: number;
  outputs: string[];
  recipe: string | null;
  resources?: ResourceMap;
  progress?: number;
}

export interface Resource {
  amount: number;
  maximum: number;
}

export interface RecipeProgress {
  remaining: number;
  ingredients: ResourceMap;
}

function pickRandom<T>(items: Array<T>, chances: Array<number>) {
  let sum = chances.reduce((acc, el) => acc + el, 0);
  let acc = 0;
  chances = chances.map(el => (acc = el + acc));
  let rand = Math.random() * sum;
  return items.find((el, i) => chances[i] > rand);
}

function isChanceRecipe(recipe: RecipeMeta): recipe is ChanceRecipe {
  return Array.isArray(recipe.results);
}

export default class Machine {
  public x = 0;
  public y = 0;

  public inputs = new Set<Machine>();
  public outputs = new Set<Machine>();

  // TODO make the resources a combination of machine + recipe?
  public resources = new Map<string, Resource>();

  public progress: number | null = null;
  public recipeName = '';

  //#region convenience getters
  public get data() {
    return getData(DataType.Machine, this.type);
  }

  public get manual() {
    return this.data.manual === true;
  }

  public get radius() {
    return this.data.radius;
  }

  public get recipes() {
    return this.data.recipes;
  }

  public get hasRecipes() {
    return this.data.recipes.length > 0;
  }

  public get recipe(): RecipeMeta {
    if(this.isGhost()) {
      return {
        key: "ghost",
        speed: this.data.buildtime,
        ingredients: this.data.ingredients,
        resources: this.data.ingredients,
        results: {}
      };
    } else {
      return hasData(DataType.Recipe, this.recipeName) 
        ? getData(DataType.Recipe, this.recipeName) : null;
    }
  }
  //#endregion

  constructor(public type: string, public uuid = uuidv4()) {
    if(!hasData(DataType.Machine, type)) {
      throw new ReferenceError(`${type} is not a valid machine type`);
    }

    this.setGhost(true);
  }

  //#region ghost
  public isGhost(): boolean {
    return this.recipeName === "ghost";
  }

  public setGhost(ghost: boolean) {
    this.recipeName = ghost ? "ghost" : null;
    this.progress = null;

    this.clearConnections();

    this.resources.clear();
    this.updateResources();
  }
  //#endregion

  public render(ctx: CanvasRenderingContext2D, color: string) {
    ctx.save();

    if(this.isGhost()) {
      ctx.globalAlpha = 0.5;
    }
    
    let recipePercent = this.progress !== null && this.recipeValid()
      ? this.progress / this.recipe.speed : 0;

    if(recipePercent > 0) {
      ctx.strokeStyle = "rgba(255, 0, 0, 0.5)";
      ctx.lineWidth = this.radius * 0.15;

      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius - ctx.lineWidth / 2, nHalfPI, nHalfPI + PI2 * recipePercent);
      ctx.stroke();
    }

    ctx.fillStyle = "transparent";

    let r = this.recipeValid() ? (this.radius * 0.85) : this.radius;
    let slice = r / this.resources.size;

    ctx.lineWidth = slice;
    for(let [name, resource] of this.resources) {
      ctx.strokeStyle = `${getData(DataType.Resource, name).color}`;
      ctx.beginPath();
      ctx.arc(this.x, this.y, r - ctx.lineWidth / 2, nHalfPI, nHalfPI + PI2 * (resource.amount / resource.maximum));
      ctx.stroke();
      
      r -= slice;
    }

    ctx.fillStyle = color;
    ctx.strokeStyle = "white";
    ctx.lineWidth = 3;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    if(this.recipe === null) {
      ctx.font = "bold 12px monospaced";
      ctx.strokeText(i18n(`machine.${this.type}`), this.x, this.y);
      ctx.fillText(i18n(`machine.${this.type}`), this.x, this.y);
    } else {
      ctx.font = "bold 12px monospaced";
      ctx.strokeText(i18n(`machine.${this.type}`), this.x, this.y - 6);
      ctx.fillText(i18n(`machine.${this.type}`), this.x, this.y - 5);
      
      ctx.font = "12px monospaced";
      ctx.strokeText(i18n(`recipe.${this.isGhost() ? "ghost" : this.recipeName}`), this.x, this.y + 6);
      ctx.fillText(i18n(`recipe.${this.isGhost() ? "ghost" : this.recipeName}`), this.x, this.y + 7);
    }

    ctx.lineWidth = 1;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  public drawOutputLine(ctx: CanvasRenderingContext2D, output: Machine, color: string) {
    ctx.save();
    ctx.fillStyle = "transparent";
    ctx.strokeStyle = color;
    if(output.isGhost()) {
      ctx.globalAlpha = 0.5;
    }
    
    let angle = Math.atan2(output.y - this.y, output.x - this.x);
    let head = 10;

    let fromX = this.x + Math.cos(angle) * this.radius;
    let fromY = this.y + Math.sin(angle) * this.radius;
    let toX = output.x - Math.cos(angle) * output.radius;
    let toY = output.y - Math.sin(angle) * output.radius;

    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    
    ctx.lineTo(toX - head * Math.cos(angle - Math.PI/6), toY - head * Math.sin(angle - Math.PI/6));
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - head * Math.cos(angle + Math.PI/6), toY - head * Math.sin(angle + Math.PI/6));
    ctx.stroke();
    ctx.restore();
  }

  public tick() {
    // Only pull resources when not building
    if(!this.isGhost() || (this.isGhost() && this.progress === null)) {
      this.pullResources();
    }

    this.processRecipe();
  }

  private pullResources() {
     // resources
     for(let [name, amount] of this.getPullResources()) {
      let remaining = amount;
      let resource = this.resources.get(name);
      for(let input of this.inputs) {
        if(!this.recipeValid() && input.hasInput(this) && input.resources.has(name))
          continue;

        let pulled = input.pullResource(name, remaining);
        if(pulled > 0) {
          resource.amount += pulled;
          remaining -= pulled;
        }
        
        if(remaining <= 0) {
          break;
        }
      }
    }

    // balance
    for(let [name] of this.getPullResources()) {
      let resource = this.resources.get(name);
      for(let input of this.inputs) {
        if(!this.recipeValid() && input.hasInput(this) && input.resources.has(name)) {
          let difference = input.resources.get(name).amount - resource.amount; 
          if(difference > 0) {
            let pulled = input.pullResource(name, Math.min(difference / 2, resource.maximum - resource.amount));
            if(pulled > 0) {
              resource.amount += pulled;
            }
          }
        }
      }
    }
  }

  public poke() {
    if(!this.recipeReady() || this.progress !== null) {
      return;
    }

    this.progress = 0;
  }

  public move(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  /**
   * Pulls up to a maximum of a resource out of a machine and returns the amount pulled.
   * @param name The name of the resource to pull
   * @param amount The maximum amount of the resource to pull
   * @param simulate Simulate, don't actually remove resources from the source machine
   */
  public pullResource(name: string, amount: number, simulate: boolean = false): number {
    if(!this.resources.has(name)) {
      return 0;
    }

    let resource = this.resources.get(name);
    let available = Math.floor(Math.min(resource.amount, amount));

    if(!simulate) {
      resource.amount -= available;
    }

    return available;
  }

  //#region node connections
  public clearConnections() {
    for(let machine of this.outputs) {
      this.removeOutput(machine);
    }

    for(let machine of this.inputs) {
      this.removeInput(machine);
    }
  }

  public hasOutput(machine: Machine) {
    for(let item of this.outputs) {
      if(item.uuid == machine.uuid) return true;
    }
    return false;
  }

  public addOutput(machine: Machine) {
    if(this.uuid == machine.uuid || this.isGhost()) return;
    if(!this.outputs.has(machine) && !machine.inputs.has(this)) {
      this.outputs.add(machine);
      machine.inputs.add(this);
    }
  }

  public removeOutput(machine: Machine) {
    this.outputs.delete(machine);
    machine.inputs.delete(this);
  }

  public toggleOutput(machine: Machine) {
    if(this.hasOutput(machine)) {
      this.removeOutput(machine);
    } else {
      this.addOutput(machine);
    }
  }

  public hasInput(machine: Machine) {
    for(let item of this.inputs) {
      if(item.uuid == machine.uuid) return true;
    }
    return false;
  }

  public addInput(machine: Machine) {
    if(this.uuid == machine.uuid) return;
    if(!this.inputs.has(machine) && !machine.outputs.has(this)) {
      this.inputs.add(machine);
      machine.outputs.add(this);
    }
  }

  public removeInput(machine: Machine) {
    this.inputs.delete(machine);
    machine.outputs.delete(this);
  }

  public toggleInput(machine: Machine) {
    if(this.hasInput(machine)) {
      this.removeInput(machine);
    } else {
      this.addInput(machine);
    }
  }
  //#endregion node connections

  //#region json
  public toJson(): InstanceData {
    let save: InstanceData = {
      x: this.x,
      y: this.y,
      recipe: this.isGhost() ? "ghost" : this.recipeName,
      outputs: [...this.outputs].map(node => node.uuid),
      resources: {}
    };

    if(this.resources.size > 0) {
      save.resources = Array.from(this.resources).reduce<ResourceMap>((obj, [key, value]) => (obj[key] = value.amount, obj), {});
    }

    if(this.progress !== null) {
      save.progress = this.progress;
    }

    return save;
  }
  
  public loadJson(save: InstanceData) {
    this.move(save.x, save.y);
    this.setGhost(save.recipe === "ghost");
    if(save.recipe !== "ghost") {
      this.setRecipe(save.recipe);
    }
    
    Object.entries(save.resources).forEach(([key, value]) => {
      this.resources.get(key).amount = value;
    });

    this.progress = save.progress !== null && save.progress !== undefined
      ? save.progress
      : null;
  }
  //#endregion json

  /**
   * Sets the current recipe the machine processes
   * @param name Internal name of the recipe
   */
  public setRecipe(name: string | null) {
    if(this.isGhost() && name !== null) {
      throw new ReferenceError(`${name} is not a valid recipe on a ghost ${this.type}`);
    }
    if(name !== null && !this.recipes.includes(name)) {
      throw new ReferenceError(`${name} is not a valid recipe on a ${this.type}`);
    }

    this.recipeName = name;
    this.updateResources();
  }

  public equals(machine: Machine) {
    if(!(machine instanceof Machine)) return false;
    return this.uuid === machine.uuid;
  }

  private updateResources() {
    let info = getData(DataType.Machine, this.type);
    let resources = {
      ...(this.isGhost() ? info.ingredients : info.resources),
      ...(this.recipe !== null ? this.recipe.resources : {})
    };

    for(let [name, maximum] of Object.entries(resources)) {
      if(this.resources.has(name)) {
        let resource = this.resources.get(name);
        resource.amount = Math.min(resource.amount, maximum);
        resource.maximum = maximum;
      } else {
        this.resources.set(name, { amount: 0, maximum: maximum });
      }
    }

    for(let name of this.resources.keys()) {
      if(typeof resources[name] === "undefined") {
        this.resources.delete(name);
      }
    }
  }

  private recipeValid() {
    return this.recipe !== null && (
      !Array.isArray(this.recipe.results) && Object.keys(this.recipe.results).length > 0
      || this.isGhost());
  }

  /**
   * Checks if a recipe has all required ingredient(s), and room for the resulting resource(s).
   * @param recipe The recipe to check for
   */
  private recipeReady(): boolean {
    if(!this.recipeValid()) return false;

    for(let [name, amount] of Object.entries(this.recipe.ingredients)) {
      if(this.resources.get(name).amount < amount) {
        return false;
      }
    }

    for(let [name, amount] of Object.entries(this.recipe.results)) {
      let resource = this.resources.get(name);
      if(resource.amount + amount > resource.maximum) {
        return false;
      }
    }

    return true;
  }

  private processRecipe() {
    if(!this.recipeValid()) return;
    
    // Should start a new recipe?
    if(this.progress === null && !(this.manual && !this.isGhost())) {
      if(!this.recipeReady()) {
        return;
      }

      this.progress = 0;
      for(let [name, amount] of Object.entries(this.recipe.ingredients)) {
        this.resources.get(name).amount -= amount;
        // XXX js floating point shit ...
        this.resources.get(name).amount = Math.round(this.resources.get(name).amount / amount) * amount;
      }
    }
    
    if(this.progress !== null && this.progress < this.recipe.speed) {
      this.progress++;

      if(this.progress == this.recipe.speed) {
        if(this.isGhost()) {
          this.setGhost(false);
        } else {
          let result = isChanceRecipe(this.recipe)
            ? pickRandom(this.recipe.results, this.recipe.chances)
            : this.recipe.results;

          for(let [name, amount] of Object.entries(result)) {
            this.resources.get(name).amount += amount;
          }
        }
        
        this.progress = null;
      }
    }
  }

  private * getPullResources(): IterableIterator<[string, number]> {
    if(this.isGhost() || !this.recipeValid()) {
      for(let [name, resource] of this.resources) {
        yield [name, Math.max(0, resource.maximum - resource.amount)];
      }
    } else {
      for(let [name, amount] of Object.entries(this.recipe.ingredients)) {
        let resource = this.resources.get(name);
        yield [name, Math.max(0, Math.min(Math.ceil(amount * 2 - resource.amount), resource.maximum))];
      }
    }
  }
}