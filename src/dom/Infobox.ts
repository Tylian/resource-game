import { RedomComponent, list, el, place, Place, setChildren, text, setAttr } from "redom";
import Engine from "../Engine";
import Node, { Resource } from "../Node";
import { evt } from "./utils";

import translate from "../utils/i18n";
const i18n = translate('en-US');

import "../style/infobox.scss";

function siPrefix(n: number) {
  if(n > 1000) {
    return `${n / 1000} M`;
  } else if(n > 1) {
    return `${n} k`
  }
  return (n * 1000).toString();
}

class RecipeItem implements RedomComponent {
  public el = el('li');
  update({ name, amount, speed }: { name: string, amount: number, speed: number }) {
    if(name == "energy") {
      this.el.textContent = `${i18n(`resource.${name}`)}: ${siPrefix(amount)}W (${siPrefix(speed)}J)`;
    } else {
      this.el.textContent = `${i18n(`resource.${name}`)}: ${amount} (${speed}/s)`;
    }
  }
}

class ResourceItem implements RedomComponent {
  public el = el('li');
  update({name, amount, maximum}: Resource & { name: string }) {
    this.el.textContent = `${name}: ${amount} / ${maximum}`;
  }
}

class ActivateButton implements RedomComponent {
  public el = el('button.manual', 'Activate');
  private node: Node | null;
  
  constructor() {
    this.el.addEventListener('click', (e) => {
      if(this.node !== null) {
        this.node.poke();
      }
    });
  }
  update(node: Node) {
    this.node = node;
  }
}

class RecipeContainer implements RedomComponent {
  public inputList = list('ul', RecipeItem);
  public outputList = list('ul', RecipeItem);
  public speed = text('');

  public el = el('div',
    el('h2', 'Recipe'),
    el('b', 'Speed: '), this.speed, 
    el('h3', 'Inputs'),
    this.inputList,
    el('h3', 'Outputs'),
    this.outputList
  );
  update(node: Node) {
    let perSec = 1 / node.recipe.speed;
    this.speed.textContent = ` ${node.recipe.speed}s per (${perSec}/s)`
    this.inputList.update(Object.entries(node.recipe.ingredients)
      .map(([name, amount]) => ({ name, amount, speed: amount * perSec })));
    this.outputList.update(Object.entries(node.recipe.results)
      .map(([name, amount]) => ({ name, amount, speed: amount * perSec })));
  }
}

export default class InfoboxComponent implements RedomComponent {
  private title: Text;
  private activate: Place;
  private recipe: Place;
  private recipes: HTMLElement;

  private recipeButtons = new Map<string, HTMLElement>();
  private resourceList = list('ul', ResourceItem, 'name');

  public el = el('div#infobox.hidden.floating',
    el('h1', this.title = text('')),
    this.activate = place(ActivateButton),
    el('h2', 'Resources'),
    this.resourceList,
    this.recipes = el('div.recipes'),
    this.recipe = place(RecipeContainer)
  );

  private node: Node = null;
  
  constructor(private engine: Engine) {
    this.update(this.node);
  }

  public update(node: Node | null) {
    this.el.classList.toggle('hidden', node == null);

    if(node !== null && !node.equals(this.node)) {
      this.node = node;
      this.title.textContent = i18n(`node.${node.type}`)
      this.recipeButtons.clear();

      for(let recipe of node.recipes) {
        this.recipeButtons.set(recipe, el(
          'button',
          i18n(`recipe.${recipe}`),
          evt({ 'click': e => { this.node.setRecipe(recipe); }})
        ));
      }

      setChildren(this.recipes, [
        el('h2', 'Recipes'),
        ...this.recipeButtons.values()
      ]);
    }

    if(node !== null)  {
      this.recipes.classList.toggle('hidden', node.isGhost());
      for(let [recipe, button] of this.recipeButtons) {
        button.classList.toggle('active', this.node.recipeName == recipe);
        setAttr(button, { 'disabled': !this.engine.recipeUnlocked(recipe) });
      }

      let update = [...this.node.resources].map(([key, resource]) => ({
          name: i18n(`resource.${key}`),
          ...resource
        })
      );

      this.recipe.update(node.recipeName !== null && node.recipeName !== "ghost", node);

      this.activate.update(node.manual, node);
      this.resourceList.update(update);
    }
  }
}