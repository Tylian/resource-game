import * as data from './data/data.json';

export interface ResourceMap<T = number> {
  [resource: string]: T
}

export interface I18nMeta {
  key: string;
  [key: string]: string;
}

export interface NodeMeta {
  key: string;
  category: string;
  manual: boolean;
  radius: number;
  ingredients: ResourceMap;
  buildtime: number;
  resources: ResourceMap;
  recipes: string[];
}

export interface BaseRecipe {
  key: string;
  speed: number;
  ingredients: ResourceMap;
  resources: ResourceMap;
}

export interface StandardRecipe extends BaseRecipe  {
  results: ResourceMap;
}

export interface ChanceRecipe extends BaseRecipe {
  results: ResourceMap[];
  chances: number[];
}

export type RecipeMeta = StandardRecipe | ChanceRecipe;

export interface ResourceMeta {
  key: string;
  color: string;
}

type MetaType = I18nMeta | NodeMeta | RecipeMeta | ResourceMeta;

type I18nData = Partial<I18nMeta>;
type NodeData = Partial<NodeMeta>;
type RecipeData = Partial<RecipeMeta>;
type ResourceData = Partial<ResourceMeta>;

export const enum DataType {
  I18n = "i18n",
  Node = "nodes",
  Recipe = "recipes",
  Resource = "resources"
}

type MetaMap<T> = { [key: string]: T };
type DataMap = {
  [DataType.I18n]: MetaMap<I18nData>,
  [DataType.Node]: MetaMap<NodeData>,
  [DataType.Recipe]: MetaMap<RecipeData>,
  [DataType.Resource]: MetaMap<ResourceData>
}

export interface UnknownMeta {
  key: string;
  [key: string]: any;
}

type DefaultMap = {[DataType.I18n]: I18nMeta, [DataType.Node]: NodeMeta, [DataType.Recipe]: RecipeMeta, [DataType.Resource]: ResourceMeta}
const defaultMap: DefaultMap = {
  [DataType.I18n]: {
    "key": "default",
  },
  [DataType.Node]: {
    "key": "default",
    "category": "basic",
    "radius": 30,
    "resources": {},
    "ingredients": {},
    "buildtime": 20,
    "manual": false,
    "recipes": []
  },
  [DataType.Recipe]: {
    "key": "default",
    "speed": 0,
    "ingredients": {},
    "resources": {},
    "results": {}
  },
  [DataType.Resource]: {
    "key": "default",
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

export function getMetadata(type: DataType.I18n, id: string): I18nMeta | null;
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