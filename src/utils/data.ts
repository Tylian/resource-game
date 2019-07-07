import * as data from '../data/data.json';

export interface ResourceMap<T = number> {
  [resource: string]: T
}

export const enum DisplayType {
  Progress = "progress",
  Working = "working",
  None = "none"
}

export interface NodeMeta {
  key: string;
  name: string;
  category: string;
  display: DisplayType;
  manual: boolean;
  radius: number;
  ingredients: ResourceMap;
  buildtime: number;
  resources: ResourceMap;
  recipes: string[];
}

export interface RecipeMeta {
  key: string;
  name: string;
  speed: number;
  ingredients: ResourceMap;
  resources: ResourceMap;
  results: ResourceMap;
}

export interface ResourceMeta {
  key: string;
  name: string;
  color: string;
}

type NodeData = Partial<NodeMeta>;
type RecipeData = Partial<RecipeMeta>;
type ResourceData = Partial<ResourceMeta>;

export const enum DataType {
  Node = "nodes",
  Recipe = "recipes",
  Resource = "resources"
}

type MetaMap<T> = { [key: string]: T };
type DataMap = {
  [DataType.Node]: MetaMap<NodeData>,
  [DataType.Recipe]: MetaMap<RecipeData>,
  [DataType.Resource]: MetaMap<ResourceData>
}

export interface UnknownMeta {
  key: string;
  [key: string]: any;
}

type DefaultMap = { [DataType.Node]: NodeMeta, [DataType.Recipe]: RecipeMeta, [DataType.Resource]: ResourceMeta }
const defaultMap: DefaultMap = {
  [DataType.Node]: {
    "key": "default",
    "name": "Default",
    "display": DisplayType.Progress,
    "category": "basic",
    "radius": 30,
    "resources": {},
    "ingredients": {},
    "buildtime": 1,
    "manual": false,
    "recipes": []
  },
  [DataType.Recipe]: {
    "key": "default",
    "name": "Default",
    "speed": 0,
    "ingredients": {},
    "resources": {},
    "results": {}
  },
  [DataType.Resource]: {
    "key": "default",
    "name": "Default",
    "color": "black"
  }
};

export function listMetadata(type: DataType): string[] {
  if(data[type] === undefined) {
    throw new ReferenceError(`Unknown data type ${type}`);
  }

  return Object.keys(data[type]);
}

export function hasMetadata(type: DataType, id: string): boolean {
  if(data[type] === undefined) {
    throw new ReferenceError(`Unknown data type ${type}`);
  }

  let metadata = (data as DataMap)[type][id];
  return metadata !== null && typeof metadata === "object";
}

export function getMetadata(type: DataType.Node, id: string): NodeMeta | null;
export function getMetadata(type: DataType.Recipe, id: string): RecipeMeta | null;
export function getMetadata(type: DataType.Resource, id: string): ResourceMeta | null;
export function getMetadata(type: DataType, id: string): UnknownMeta | null {
  if(!hasMetadata(type, id)) {
    return null;
  }

  return {
    ...defaultMap[type],
    ...(data as DataMap)[type][id],
    key: id
  };
}