import Engine from "./Engine";
import { RedomElement } from "redom";

declare module "*.scss" {
  const value: any;
  export default value;
}

declare module "*.json" {
  const value: any;
  export default value;
}

declare module 'redom' {
  function mount(parent: RedomElement, child: RedomElement, before?: RedomElement, replace?: boolean): RedomElement;
}

interface Window {
  engine: Engine;
}