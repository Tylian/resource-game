import { RedomComponent, list, el, place, Place, setChildren, text, setAttr } from "redom";
import Machine, { Resource } from "../Machine";
import { evt } from "./utils";

import translate from "../i18n";
const i18n = translate('en-US');

import "../style/info.scss";
import Engine from "../Engine";

class ResourceItem implements RedomComponent {
  public el = el('li');
  update(data: Resource & { name: string }) {
    this.el.textContent = `${data.name}: ${data.amount} / ${data.maximum}`;
  }
}

class ActivateButton implements RedomComponent {
  public el = el('button.manual', 'Activate');
  private machine: Machine | null;
  
  constructor() {
    this.el.addEventListener('click', (e) => {
      if(this.machine !== null) {
        this.machine.poke();
      }
    });
  }
  update(machine: Machine) {
    this.machine = machine;
  }
}

export default class InfoComponent implements RedomComponent {
  public el: HTMLElement;

  private title: Text;
  private activate: Place;
  private recipes: HTMLElement;

  private recipeButtons = new Map<string, HTMLElement>();
  private resourceList = list('ul', ResourceItem);

  private machine: Machine = null;
  
  constructor(private engine: Engine) {
    this.el = el('div#infobox.hidden',
      el('h1', this.title = text('')),
      this.activate = place(ActivateButton),
      el('h2', 'Resources'),
      this.resourceList,
      el('h2', 'Recipes'),
      this.recipes = el('div.recipes')
    );

    this.update(this.machine);
  }

  public update(machine: Machine | null) {
    this.el.classList.toggle('hidden', machine == null);

    if(machine !== null && !machine.equals(this.machine)) {
      this.machine = machine;
      this.title.textContent = i18n(`machine.${machine.type}`)
      this.recipeButtons.clear();

      for(let recipe of machine.recipes) {
        this.recipeButtons.set(recipe, el(
          'button',
          i18n(`recipe.${recipe}`),
          evt({ 'click': e => { this.machine.setRecipe(recipe); }})
        ));
      }

      setChildren(this.recipes, [...this.recipeButtons.values()]);
    }

    if(machine !== null)  {
      for(let [recipe, button] of this.recipeButtons) {
        button.classList.toggle('active', this.machine.recipeName == recipe);
        setAttr(button, { 'disabled': !this.engine.recipeUnlocked(recipe) });
      }

      let update = [...this.machine.resources].map(([key, resource]) => ({
          name: i18n(`resource.${key}`),
          ...resource
        })
      );

      this.activate.update(machine.manual, machine);
      this.resourceList.update(update);
    }
  }
}