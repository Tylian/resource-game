import { RedomComponent, list, el, place, Place, setChildren, text, setAttr } from "redom";
import Node, { Resource } from "../Node";
import { evt } from "./utils";

import translate from "../i18n";
const i18n = translate('en-US');

import "../style/info.scss";
import Engine from "../Engine";

class RecipeItem implements RedomComponent {
  public el = el('li');
  update([name, amount]: [string, number]) {
    this.el.textContent = `${name}: ${amount}`;
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
    el('b', 'Speed:'), this.speed, 
    el('h3', 'Inputs'),
    this.inputList,
    el('h3', 'Outputs'),
    this.outputList
  );
  update(node: Node) {
    this.inputList.update(Object.entries(node.recipe.ingredients));
    this.outputList.update(Object.entries(node.recipe.ingredients));
  }
}

export default class InfoComponent implements RedomComponent {
  public el: HTMLElement;

  private title: Text;
  private activate: Place;
  private recipe: Place;
  private recipes: HTMLElement;

  private recipeButtons = new Map<string, HTMLElement>();
  private resourceList = list('ul', ResourceItem, 'name');

  private node: Node = null;
  
  constructor(private engine: Engine) {
    this.el = el('div#infobox.hidden',
      el('h1', this.title = text('')),
      this.activate = place(ActivateButton),
      el('h2', 'Resources'),
      this.resourceList,
      el('h2', 'Recipes'),
      this.recipes = el('div.recipes'),
      this.recipe = place(RecipeContainer)
    );

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

      setChildren(this.recipes, [...this.recipeButtons.values()]);
    }

    if(node !== null)  {
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