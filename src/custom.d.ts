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
  export function mount(parent: RedomElement, child: RedomElement, before?: RedomElement, replace?: boolean): RedomElement;
  
  export function place<T extends RedomComponent>(View: RedomComponentCtor<T>, initData?: any): Place;
  export interface RedomComponentCtor<T> {
    new (data?: any): T;
  }
}