import { Place, el, RedomComponent, place, RedomQuery, RedomQueryArgument, text } from "redom";
import { evt } from "./utils";

class Children implements RedomComponent {
  public el: HTMLElement;
  constructor(child: HTMLElement) {
    this.el = child;
  }
}

export default class Accordian implements RedomComponent {
  public el: HTMLElement;
  public placeholder: Place;
  public visible: boolean = true;

  constructor(title: string, child: HTMLElement) {
    this.placeholder = place(Children, child);

    let header = text(`${title} ⯆`);
    this.el = el('div.accordian', el('h1', header , evt({
      click: () => {
        this.visible = !this.visible;
        this.placeholder.update(this.visible);
        this.el.classList.toggle('open', this.visible);
        header.textContent = this.visible ? `${title} ⯆` : `${title} ⯈`;
      }
    })), this.placeholder);
    this.placeholder.update(this.visible);
  }
}