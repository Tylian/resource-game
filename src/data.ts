export interface ResourceMap<T = number> {
  [resource: string]: T
}

export interface Key {
  key: string;
}

export interface ResourceMeta {
  key: string,
  color: string;
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

export interface UnknownMeta {
  key: string,
  [key: string]: any
}

export const enum DataType {
  Node,
  Recipe,
  Resource
}

const requireMap = {
  [DataType.Node]: require.context('./data/nodes/', true, /\.json$/),
  [DataType.Recipe]: require.context('./data/recipes/', true, /\.json$/),
  [DataType.Resource]: require.context('./data/resources/', true, /\.json$/),
};

type DefaultMap = {[DataType.Node]: NodeMeta, [DataType.Recipe]: RecipeMeta, [DataType.Resource]: ResourceMeta}
const defaultMap: DefaultMap = {
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
  [DataType.Resource]: { "key": "default", "color": "black" }
};

export function listData(type: DataType): string[] {
  if(requireMap[type] === undefined) {
    throw new ReferenceError(`Unknown data type ${type}`);
  }

  return requireMap[type].keys().map(key => key.slice(2, key.length - 5));
}

export function hasData(type: DataType, id: string | null | undefined): boolean {
  if(requireMap[type] === undefined) {
    throw new ReferenceError(`Unknown data type ${type}`);
  }

  return requireMap[type].keys().includes(`./${id}.json`);
}

export function getData(type: DataType.Node, id: string | null | undefined): NodeMeta | null;
export function getData(type: DataType.Recipe, id: string | null | undefined): RecipeMeta | null;
export function getData(type: DataType.Resource, id: string | null | undefined): ResourceMeta | null;
export function getData(type: DataType, id: string | null | undefined): UnknownMeta | null {
  if(!hasData(type, id)) {
    return null;
  }

  return {
    ...defaultMap[type],
    ...requireMap[type](`./${id}.json`),
    key: id
  };
}