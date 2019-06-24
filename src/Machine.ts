import uuidv4 from 'uuid/v4';

import translate from './i18n';
const i18n = translate('en-US');

const machineData: {[ name: string]: MachineMeta } = require('./data/machines.json');
const recipeData: {[ name: string]: RecipeMeta } = require('./data/recipes.json');
const resourceData: {[ name: string]: ResourceMeta } = require('./data/resources.json');

const PI2 = Math.PI * 2;
const nHalfPI = -Math.PI / 2;

import { el, RedomComponent, list } from 'redom';

export interface ResourceMap<T = number> {
  [resource: string]: T
}

export interface ResourceMeta {
  name: string;
  color: string;
}

export interface InstanceData {
  x: number;
  y: number;
  outputs: string[];
  recipe: string | null;
  resources?: ResourceMap;
  remaining?: number;
}

export interface Resource {
  amount: number;
  maximum: number;
}

export interface StandardRecipe {
  speed: number;
  ingredients: ResourceMap;
  resources: ResourceMap;
  results: ResourceMap;
}

export interface ChanceRecipe {
  speed: number;
  ingredients: ResourceMap;
  resources: ResourceMap;
  results: ResourceMap[];
  chances: number[];
}

type RecipeMeta = StandardRecipe | ChanceRecipe;

export interface MachineMeta {
  manual: boolean;
  radius: number;
  ingredients: ResourceMap;
  buildtime: number;
  resources: ResourceMap;
  recipes: string[];
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

class ResourceItem implements RedomComponent {
  public el = el('li');
  update(data: Resource & { name: string }) {
    this.el.textContent = `${data.name}: ${data.amount}/${data.maximum}`;
  }
}

export default class Machine implements RedomComponent {
  el: HTMLElement;

  public x = 0;
  public y = 0;

  public inputs = new Set<Machine>();
  public outputs = new Set<Machine>();

  // TODO make the resources a combination of machine + recipe?
  public resources = new Map<string, Resource>();

  private remaining: number | null = null;
  private recipeName = '';

  private recipeButtons = new Map<string, HTMLElement>();

  private resourceList = list('ul', ResourceItem);

  public ghost: boolean = false;
  public ghostTime: number = 0;
  public ghostResources = new Map<string, Resource>();

  //#region convenience getters
  public get manual() {
    return machineData[this.type].manual === true
  }

  public get radius() {
    return machineData[this.type].radius;
  }

  public get recipes() {
    return machineData[this.type].recipes;
  }

  public get ingredients() {
    return machineData[this.type].ingredients;
  }

  public get hasRecipes() {
    return machineData[this.type].recipes.length > 0;
  }

  public get buildTime() {
    return machineData[this.type].buildtime;
  }

  public get recipe() {
    return recipeData[this.recipeName] !== undefined 
      ? recipeData[this.recipeName] : null;
  }
  //#endregion

  constructor(public type: string, public uuid = uuidv4()) {
    if(machineData[type] as MachineMeta === undefined) {
      throw new ReferenceError(`${type} is not a valid machine type`);
    }

    this.setGhost(true);
    this.el = this.generateElement();
  }

  public setGhost(ghost: boolean) {
    this.ghost = ghost;
    this.ghostTime =  0;

    this.resources.clear();
    this.updateResources();

    for(let machine of this.outputs) {
      this.removeOutput(machine);
    }

    for(let machine of this.inputs) {
      this.removeInput(machine);
    }
  }

  public checkGhostIngredients() {
    for(let [name, amount] of Object.entries(this.ingredients)) {
      let resource = this.resources.get(name);
      if(resource.amount < amount) {
        return false;
      }
    }

    return true;
  }

  public render(ctx: CanvasRenderingContext2D, focus: boolean) {
    ctx.save();

    let recipePercent = 0;

    if(this.ghost) {
      ctx.globalAlpha = 0.5;
      recipePercent = this.ghostTime / this.buildTime;
    } else {
      if(this.remaining !== null && this.recipeValid()) {
        recipePercent = 1 - (this.remaining / this.recipe.speed);
      }
    }

    if(recipePercent > 0) {
      ctx.fillStyle = "rgba(255, 0, 0, 0.5)";

      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x, this.y - this.radius);
      ctx.arc(this.x, this.y, this.radius, nHalfPI, nHalfPI + PI2 * recipePercent);
      ctx.fill();

      ctx.beginPath();
      ctx.fillStyle = "white";
      ctx.moveTo(this.x, this.y);
      ctx.arc(this.x, this.y, this.radius * 0.85, 0, PI2);
      ctx.fill();
    }

    ctx.fillStyle = "transparent";

    let r = this.recipeValid() ? (this.radius * 0.85) : this.radius;
    let slice = r / this.resources.size;

    ctx.lineWidth = 2;
    for(let [name, resource] of this.resources) {
      ctx.beginPath();
      ctx.fillStyle = `${resourceData[name].color}`;
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x, this.y - r);
      ctx.arc(this.x, this.y, r, nHalfPI, nHalfPI + PI2 * (resource.amount / resource.maximum));
      ctx.fill();
      
      r -= slice;
    }

    ctx.fillStyle = focus ? "red" : "black";
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.textAlign = "center";
    
    ctx.textBaseline = "middle";

    ctx.font = "bold 12px monospaced";
    ctx.strokeText(i18n(`machine.${this.type}`), this.x, this.y - 6);
    ctx.fillText(i18n(`machine.${this.type}`), this.x, this.y - 5);
    
    ctx.font = "12px monospaced";
    ctx.strokeText(i18n(`recipe.${this.ghost ? "ghost" : this.recipeName}`), this.x, this.y + 6);
    ctx.fillText(i18n(`recipe.${this.ghost ? "ghost" : this.recipeName}`), this.x, this.y + 7);

    ctx.lineWidth = 1;
    ctx.strokeStyle = focus ? "red" : "black";
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  public generateElement(): HTMLElement {
    for(let recipe of this.recipes) {
      this.recipeButtons.set(recipe, el('button', i18n(`recipe.${recipe}`), (el) => {
        el.addEventListener('click', e => {
          this.setRecipe(recipe);
        });
      }))
    }

    return el('div',
      el('h1', i18n(`machine.${this.type}`)),
      this.manual && el('button.manual', 'Activate', (el) => {
        el.addEventListener('click', e => {
          this.poke();
        });
      }),
      el('h2', 'Resources'),
      this.resourceList,
      el('h2', 'Recipes'),
      el('div.recipes', [...this.recipeButtons.values()])
    );
  }

  public update() {
    let update = [];
    for(let [key, resource] of this.resources) {
      update.push({
        name: i18n(`resource.${key}`),
        ...resource
      });
    }

    for(let [recipe, button] of this.recipeButtons) {
      button.classList.toggle('active', this.recipeName == recipe);
    }

    this.resourceList.update(update);
  }

  public move(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  public tick() {
    // resources
    for(let [name, amount] of this.getPullResources()) {
      let remaining = amount;
      let resource = this.resources.get(name);
      for(let input of this.inputs) {
        let pulled = input.pullResource(name, remaining);
        if(pulled > 0) {
          resource.amount += pulled;
          remaining -= pulled;
        }
        
        if(remaining == 0) {
          break;
        }
      }
    }

    // ghost
    if(this.ghost) {
      if(this.checkGhostIngredients()) {
        this.ghostTime++;
        if(this.ghostTime >= this.buildTime) {
          this.setGhost(false);
        }
      }
    } else {
      this.processRecipe();
    }
  }

  public poke() {
    if(!this.recipeReady() || this.remaining !== null) {
      return;
    }

    this.remaining = this.recipe.speed;
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
    let available = Math.min(resource.amount, amount);

    if(!simulate) {
      resource.amount -= available;
    }

    return available;
  }

  //#region node connections
  public hasOutput(machine: Machine) {
    for(let item of this.outputs) {
      if(item.uuid == machine.uuid) return true;
    }
    return false;
  }

  public addOutput(machine: Machine) {
    if(this.uuid == machine.uuid || this.ghost) return;
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
      recipe: this.ghost ? "ghost" : this.recipeName,
      outputs: [...this.outputs].map(node => node.uuid),
    };

    if(this.resources.size > 0) {
      save.resources = Array.from(this.resources).reduce<ResourceMap>((obj, [key, value]) => (obj[key] = value.amount, obj), {});
    }

    if(this.remaining !== null && this.remaining !== undefined) {
      save.remaining = this.remaining;
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

    this.remaining = save.remaining !== null && save.remaining !== undefined
      ? save.remaining
      : null;
  }
  //#endregion json

  /**
   * Sets the current recipe the machine processes
   * @param name Internal name of the recipe
   */
  public setRecipe(name: string | null) {
    if(this.ghost && name !== null) {
      throw new ReferenceError(`${name} is not a valid recipe on a ghost ${this.type}`);
    }
    if(name !== null && !this.recipes.includes(name)) {
      throw new ReferenceError(`${name} is not a valid recipe on a ${this.type}`);
    }

    this.recipeName = name;
    this.updateResources();
  }

  private updateResources() {
    let info = machineData[this.type];
    let resources = {
      ...(this.ghost ? info.ingredients : info.resources),
      ...(this.recipe !== null ? this.recipe.resources : {})
    };

    for(let [name, maximum] of Object.entries(resources)) {
      this.updateResource(name, maximum);
    }

    for(let name of this.resources.keys()) {
      if(typeof resources[name] === "undefined") {
        this.resources.delete(name);
      }
    }
  }

  private updateResource(name: string, maximum: number = 0) {
    if(this.resources.has(name)) {
      let resource = this.resources.get(name);
      resource.amount = Math.min(resource.amount, maximum);
      resource.maximum = maximum;
    } else {
      this.resources.set(name, { amount: 0, maximum: maximum });
    }
  }

  private recipeValid() {
    return this.recipe !== null && !Array.isArray(this.recipe.results) && Object.keys(this.recipe.results).length > 0;
  }

  /**6
   * Checks if a recipe has all required ingredient(s), and room for the resulting resource(s).
   * @param recipe The recipe to check for
   */
  private recipeReady(): boolean {
    if(!this.recipeValid()) return false;

    for(let [name, amount] of Object.entries(this.recipe.ingredients)) {
      if(!this.resources.has(name) || this.resources.get(name).amount < amount) {
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
    if(!this.recipeValid()) {
      return;
    }

    // Should start a new recipe?
    if(this.remaining == null && !this.manual) {
      if(!this.recipeReady()) {
        return;
      }

      this.remaining = this.recipe.speed;
      for(let [name, amount] of Object.entries(this.recipe.ingredients)) {
        this.resources.get(name).amount -= amount;
      }
    }
    
    if(this.remaining !== null && this.remaining > 0) {
      this.remaining--;

      if(this.remaining == 0) {
        let result = isChanceRecipe(this.recipe)
          ? pickRandom(this.recipe.results, this.recipe.chances)
          : this.recipe.results;

        for(let [name, amount] of Object.entries(result)) {
          this.resources.get(name).amount += amount;
        }
        
        this.remaining = null;
      }
    }
  }

  private * getPullResources(): IterableIterator<[string, number]> {
    if(this.ghost || !this.recipeValid()) {
      for(let [name, resource] of this.resources) {
        yield [name, Math.max(0, resource.maximum - resource.amount)];
      }
    } else {
      for(let [name, amount] of Object.entries(this.recipe.ingredients)) {
        let resource = this.resources.get(name);
        yield [name, Math.max(0, Math.min((amount * 2) - resource.amount, resource.maximum))];
      }
    }
  }
}