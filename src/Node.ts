import uuidv4 from 'uuid/v4';

import { getData, DataType, hasData, RecipeMeta, ResourceMap, ChanceRecipe, NodeMeta } from './data';

import translate from './i18n';
const i18n = translate('en-US');

const PI2 = Math.PI * 2;
const nHalfPI = -Math.PI / 2;

export interface InstanceData {
  x: number;
  y: number;
  outputs: string[];
  recipe: string | null;
  resources: ResourceMap;
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

  public progress: number | null = null;
  public recipeName: string | null = '';

  //#region convenience getters
  public get data() {
    return getData(DataType.Node, this.type) as NodeMeta;
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
      return hasData(DataType.Recipe, this.recipeName) 
        ? getData(DataType.Recipe, this.recipeName) : null;
    }
  }
  //#endregion

  constructor(public type: string, public uuid = uuidv4()) {
    if(!hasData(DataType.Node, type)) {
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

  public render(ctx: CanvasRenderingContext2D, focus: boolean) {
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
    
    let recipePercent = this.progress !== null && this.recipeValid()
      ? this.progress / this.recipe.speed : 0;

    if(recipePercent > 0) {
      ctx.strokeStyle = "#ff8080";
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
      let resData = getData(DataType.Resource, name);
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

  public drawOutputLine(ctx: CanvasRenderingContext2D, output: Node, color: string) {
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
      let resource = <Resource>this.getResource(name);
      let inputs = [...this.inputs]
        .filter(node => node.getResource(name) !== null)
        .sort((a, b) => (<Resource>a.getResource(name)).amount - (<Resource>a.getResource(name)).amount);

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
    
    for(let [key, value] of Object.entries(save.resources)) {
      this.setResourceAmount(key, value)
    };

    this.progress = save.progress !== null && save.progress !== undefined
      ? save.progress
      : null;
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
    this.progress = null;
    this.updateResources();
  }

  public equals(node: Node | null) {
    if(!(node instanceof Node)) return false;
    return this.uuid === node.uuid;
  }

  private updateResources() {
    let info = <NodeMeta>getData(DataType.Node, this.type);
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

  private processRecipe() {
    if(!this.recipeValid()) return;
    
    // Should start a new recipe?
    if(this.progress === null && !(this.manual && !this.isGhost())) {
      if(!this.recipeReady()) {
        return;
      }

      this.progress = 0;
      for(let [name, amount] of Object.entries(this.recipe.ingredients)) {
        let newAmount = Math.round((this.getResourceAmount(name) - amount) / amount) * amount;
        this.setResourceAmount(name, newAmount);
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
            this.setResourceAmount(name, this.getResourceAmount(name) + amount);
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
        let resource = this.getResource(name);
        if(resource !== null) {
          yield [name, Math.max(0, Math.min(Math.ceil(amount * 2 - resource.amount), resource.maximum))];
        }
      }
    }
  }
}