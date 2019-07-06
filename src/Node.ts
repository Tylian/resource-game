import uuidv4 from 'uuid/v4';

import { getMetadata, DataType, hasMetadata, RecipeMeta, ResourceMap, ChanceRecipe, NodeMeta, DisplayType } from './utils/data';

import translate from './utils/i18n';
import { Point, AABB, lineInAABB } from './utils/math';
const i18n = translate('en-US');

const PI2 = Math.PI * 2;
const nHalfPI = -Math.PI / 2;

export interface InstanceData {
  x: number;
  y: number;
  outputs: string[];
  recipe: string | null;
  resources: ResourceMap;
  start?: number;
}

export interface Resource {
  amount: number;
  maximum: number;
}

export interface RecipeProgress {
  remaining: number;
  ingredients: ResourceMap;
}

function pickRandom<T>(items: Array<T>, chances: Array<number>): T {
  let sum = chances.reduce((acc, el) => acc + el, 0);
  let acc = 0;
  chances = chances.map(el => (acc = el + acc));
  let rand = Math.random() * sum;
  return items.find((el, i) => chances[i] > rand) as T;
}

function isChanceRecipe(recipe: RecipeMeta): recipe is ChanceRecipe {
  return Array.isArray(recipe.results);
}

function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, fill = "black", stroke = "white") {
  ctx.save()
 
  ctx.lineWidth = 2;
  ctx.strokeStyle = stroke;
  ctx.fillStyle = fill;
  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);

  ctx.restore();
}

export default class Node {
  public x = 0;
  public y = 0;

  public inputs = new Set<Node>();
  public outputs = new Set<Node>();

  // TODO make the resources a combination of node2 + recipe?
  public resources = new Map<string, Resource>();

  public recipeName: string | null = '';
  public recipeStart: number | null;

  public poked: boolean = false;

  //#region convenience getters
  public get data() {
    return getMetadata(DataType.Node, this.type) as NodeMeta;
  }

  public get display() {
    return this.isGhost() ? DisplayType.Progress : this.data.display;
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

  public get recipe(): RecipeMeta | null {
    if(this.isGhost()) {
      return {
        key: "ghost",
        speed: this.data.buildtime,
        ingredients: this.data.ingredients,
        resources: this.data.ingredients,
        results: {}
      };
    } else {
      return getMetadata(DataType.Recipe, this.recipeName);
    }
  }

  public get recipeEnd() {
    return this.recipeStart === null || this.recipe === null
      ? null : this.recipeStart + this.recipe.speed;
  }
  //#endregion

  constructor(public type: string, public uuid = uuidv4()) {
    if(!hasMetadata(DataType.Node, type)) {
      throw new ReferenceError(`${type} is not a valid node type`);
    }

    this.setGhost(true);
  }

  //#region ghost
  public isGhost(): boolean {
    return this.recipeName === "ghost";
  }

  public setGhost(ghost: boolean) {
    this.clearConnections();
    this.resources.clear();

    this.recipeName = null; // XXX remove ghost so setRecipe works
    this.setRecipe(ghost ? "ghost" : (this.recipes.length == 1 ? this.recipes[0] : null));
  }
  //#endregion

  public render(ctx: CanvasRenderingContext2D, time: number, focus: boolean) {
    ctx.save();

    const mainColor = focus ? 'green' : 'black';
    const accentColor = focus ? '#dfd' : 'white';

    if(this.isGhost()) {
      ctx.globalAlpha = 0.5;
    }

    ctx.lineWidth = 1;
    
    ctx.fillStyle = accentColor;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();

    if(this.recipeValid()) {
      ctx.strokeStyle = "#ff8080";
      ctx.lineWidth = this.radius * 0.15;

      if(this.display == DisplayType.Progress) {
        let recipePercent = this.recipeStart !== null ? (time - this.recipeStart) / this.recipe.speed : 0;

        if(recipePercent > 0) {
          ctx.beginPath();
          ctx.arc(this.x, this.y, this.radius - ctx.lineWidth / 2, nHalfPI, nHalfPI + PI2 * recipePercent);
          ctx.stroke();
        }
      } else if (this.display == DisplayType.Working && this.recipeStart !== null) {
        let progress = time % 3;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius - ctx.lineWidth / 2, nHalfPI + PI2 * progress, nHalfPI + PI2 * (progress + 1/3));
        ctx.stroke();
      }
    }

    ctx.fillStyle = "transparent";

    let r = this.recipeValid() && this.display !== DisplayType.None ? this.radius * 0.85 : this.radius;
    let slice = r / this.resources.size;

    ctx.lineWidth = slice;
    for(let [name, resource] of this.resources) {
      let resData = getMetadata(DataType.Resource, name);
      ctx.strokeStyle = resData !== null ? resData.color : 'black';
      ctx.beginPath();
      ctx.arc(this.x, this.y, r - ctx.lineWidth / 2, nHalfPI, nHalfPI + PI2 * (resource.amount / resource.maximum));
      ctx.stroke();
      
      r -= slice;
    }

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const lineHeight = 14;

    if(this.recipe === null || this.isGhost()) {
      ctx.font = "bold 9px sans-serif";
      drawText(ctx, i18n(`node.${this.type}`), this.x, this.y, mainColor, accentColor);
    } else {
      ctx.font = "bold 9px sans-serif";
      drawText(ctx, i18n(`node.${this.type}`), this.x, this.y - lineHeight / 2, mainColor, accentColor);
      ctx.font = "9px sans-serif";
      drawText(ctx, i18n(`recipe.${this.isGhost() ? "ghost" : this.recipeName}`), this.x, this.y + lineHeight / 2, mainColor, accentColor);
    }

    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  public drawOutputLine(ctx: CanvasRenderingContext2D, output: Node, screenAABB: AABB) {
    const angle = Math.atan2(output.y - this.y, output.x - this.x);
    const head = 10;

    const from: Point = {
      x: this.x + Math.cos(angle) * this.radius,
      y: this.y + Math.sin(angle) * this.radius
    };
    const to: Point = {
      x: output.x - Math.cos(angle) * output.radius,
      y: output.y - Math.sin(angle) * output.radius
    };

    if(lineInAABB(from, to, screenAABB)) {
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      
      ctx.lineTo(to.x - head * Math.cos(angle - Math.PI/6), to.y - head * Math.sin(angle - Math.PI/6));
      ctx.moveTo(to.x, to.y);
      ctx.lineTo(to.x - head * Math.cos(angle + Math.PI/6), to.y - head * Math.sin(angle + Math.PI/6));
    }
  }

  public update(time: number) {
    // Only pull resources when not building
    if(!this.isGhost() || (this.isGhost() && this.recipeStart === null)) {
      this.pullResources();
    }

    this.processRecipe(time);
  }

  private pullResources() {
     // resources
     for(let [name, amount] of this.getPullResources()) {
      let remaining = amount;
      let resource = this.getResource(name) as Resource;
      let inputs = [...this.inputs]
        .filter(node => node.getResource(name) !== null)
        .sort((a, b) => b.getResourceAmount(name) - a.getResourceAmount(name));

      for(let [i, input] of inputs.entries()) {
        let pulled = input.pullResource(name, Math.ceil(remaining / (inputs.length - i)));
        if(pulled > 0) {
          resource.amount += pulled;
          remaining -= pulled;
        }
        
        if(remaining <= 0) {
          break;
        }
      }
    }
  }

  public poke() {
    if(!this.recipeReady() || this.recipeStart !== null) {
      return;
    }

    this.poked = true;
  }

  public move(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  /**
   * Pulls up to a maximum of a resource out of a node and returns the amount pulled.
   * @param name The name of the resource to pull
   * @param amount The maximum amount of the resource to pull
   * @param simulate Simulate, don't actually remove resources from the source node
   */
  public pullResource(name: string, amount: number, simulate: boolean = false): number {
    let resource = this.getResource(name);
    if(resource == null) {
      return 0;
    }

    let available = Math.floor(Math.min(resource.amount, amount));
    if(!simulate) {
      resource.amount -= available;
    }

    return available;
  }

  public getResource(name: string): Resource | null {
    let resource = this.resources.get(name) 
    return resource == undefined ? null : resource;
  }

  public setResource(name: string, value = 0, maximum = Infinity): void {
    this.resources.set(name, {
      amount: value,
      maximum: maximum
    }); 
  }


  public setResourceAmount(name: string, value: number): void {
    let resource = this.resources.get(name); 
    if(resource !== undefined) {
      resource.amount = value;
    }
  }

  public getResourceAmount(name: string, strict?: false): number
  public getResourceAmount(name: string, strict?: true): number | null
  public getResourceAmount(name: string, strict: boolean = false): number | null {
    let resource = this.resources.get(name);
    return resource === undefined
      ? (strict ? null : 0)
      : resource.amount;
  }

  //#region node connections
  public clearConnections() {
    for(let node of this.outputs) {
      this.removeOutput(node);
    }

    for(let node of this.inputs) {
      this.removeInput(node);
    }
  }

  public hasOutput(node: Node) {
    for(let item of this.outputs) {
      if(item.uuid == node.uuid) return true;
    }
    return false;
  }

  public addOutput(node: Node) {
    if(this.uuid == node.uuid || this.isGhost()) return;
    if(!this.outputs.has(node) && !node.inputs.has(this)) {
      this.outputs.add(node);
      node.inputs.add(this);
    }
  }

  public removeOutput(node: Node) {
    this.outputs.delete(node);
    node.inputs.delete(this);
  }

  public toggleOutput(node: Node) {
    if(this.hasOutput(node)) {
      this.removeOutput(node);
    } else {
      this.addOutput(node);
    }
  }

  public hasInput(node: Node) {
    for(let item of this.inputs) {
      if(item.uuid == node.uuid) return true;
    }
    return false;
  }

  public addInput(node: Node) {
    if(this.uuid == node.uuid) return;
    if(!this.inputs.has(node) && !node.outputs.has(this)) {
      this.inputs.add(node);
      node.outputs.add(this);
    }
  }

  public removeInput(node: Node) {
    this.inputs.delete(node);
    node.outputs.delete(this);
  }

  public toggleInput(node: Node) {
    if(this.hasInput(node)) {
      this.removeInput(node);
    } else {
      this.addInput(node);
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

    if(this.recipeStart !== null) {
      save.start = this.recipeStart;
    }

    return save;
  }
  
  public loadJson(save: InstanceData) {
    this.move(save.x, save.y);
    this.setGhost(save.recipe === "ghost");
    if(save.recipe !== "ghost") {
      this.setRecipe(save.recipe);
    }
    
    for(let [key, value] of Object.entries(save.resources)) {
      this.setResourceAmount(key, value)
    };

    this.recipeStart = typeof save.start === "number" ? save.start : null;
  }
  //#endregion json

  /**
   * Sets the current recipe the node processes
   * @param name Internal name of the recipe
   */
  public setRecipe(name: string | null) {
    if(name !== "ghost") {
      if(this.isGhost() && name !== null) {
        throw new ReferenceError(`${name} is not a valid recipe on a ghost ${this.type}`);
      }
      if(name !== null && !this.recipes.includes(name)) {
        throw new ReferenceError(`${name} is not a valid recipe on a ${this.type}`);
      }
    }

    this.recipeName = name;
    this.recipeStart = null;
    this.updateResources();
  }

  public equals(node: Node | null) {
    if(!(node instanceof Node)) return false;
    return this.uuid === node.uuid;
  }

  private updateResources() {
    let info = getMetadata(DataType.Node, this.type);
    let resources = {
      ...(this.isGhost() ? info.ingredients : info.resources),
      ...(this.recipe !== null ? this.recipe.resources : {})
    };

    for(let [name, maximum] of Object.entries(resources)) {
      let resource = this.getResource(name);
      if(resource !== null) {
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
      if(this.getResourceAmount(name) < amount) {
        return false;
      }
    }

    for(let [name, amount] of Object.entries(this.recipe.results)) {
      let resource = this.getResource(name);
      if(resource !== null && resource.amount + amount > resource.maximum) {
        return false;
      }
    }

    return true;
  }

  private processRecipe(time: number) {
    if(!this.recipeValid()) return;
    let smoothing = 0;
    
    if(this.recipeStart !== null && this.recipe !== null && time >= this.recipeEnd) {
      if(this.isGhost()) {
        this.setGhost(false);
      } else {
        let result = isChanceRecipe(this.recipe)
          ? pickRandom(this.recipe.results, this.recipe.chances)
          : this.recipe.results;

        for(let [name, amount] of Object.entries(result)) {
          this.setResourceAmount(name, this.getResourceAmount(name) + amount);
        }
      }

      this.recipeStart = null;
      smoothing = Math.max(0, time - this.recipeEnd);
    }

    // Should start a new recipe?
    if(this.recipeStart === null && this.recipeReady() && (this.isGhost() || !this.manual || (this.manual && this.poked))) {
      this.recipeStart = time - smoothing;
      this.poked = false;
      for(let [name, amount] of Object.entries(this.recipe.ingredients)) {
        let rounded = Math.round((this.getResourceAmount(name) - amount) / amount) * amount;
        this.setResourceAmount(name, rounded);
      }
    }
  }

  private * getPullResources(): IterableIterator<[string, number]> {
    for(let [name, resource] of this.resources) {
      yield [name, Math.max(0, resource.maximum - Math.ceil(resource.amount))];
    }
  }
}