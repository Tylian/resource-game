import { RedomComponent, list, el, place, Place, setChildren } from "redom";
import Machine, { Resource } from "../Machine";
import i18n from "../i18n";
import { evt } from "./utils";

class ResourceItem implements RedomComponent {
  public el = el('li');
  update(data: Resource & { name: string }) {
    this.el.textContent = `${data.name}: ${data.amount}/${data.maximum}`;
  }
}

class ActivateButton implements RedomComponent {
  public el = el('button.manual', 'Activate');
  constructor(private machine: Machine) {
    this.el.addEventListener('click', (e) => {
      this.machine.poke();
    });
  }
  update(machine: Machine) {
    this.machine = machine;
  }
}

export default class InfoComponent implements RedomComponent {
  public el: HTMLElement;
  

  private title: HTMLElement;
  private activate: Place;
  private recipes: HTMLElement;

  private recipeButtons = new Map<string, HTMLElement>();
  private resourceList = list('ul', ResourceItem);

  private machine: Machine;
  
  constructor(machine: Machine) {
    this.el = el('div',
      this.title = el('h1', i18n(`machine.${machine.type}`)),
      this.activate = place(ActivateButton, this.machine),
      el('h2', 'Resources'),
      this.resourceList,
      el('h2', 'Recipes'),
      this.recipes = el('div.recipes', )
    );

    this.update(machine);
  }

  public update(machine: Machine | null) {
    this.el.classList.toggle('hidden', machine == null);

    if(!this.machine.equals(machine)) {
      for(let recipe of machine.recipes) {
        this.recipeButtons.clear();
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