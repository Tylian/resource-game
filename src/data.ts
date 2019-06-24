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

export interface MachineMeta {
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
  Machine,
  Recipe,
  Resource
}

const requireMap = {
  [DataType.Machine]: require.context('./data/machines/', false, /\.json$/),
  [DataType.Recipe]: require.context('./data/recipes/', false, /\.json$/),
  [DataType.Resource]: require.context('./data/resources/', false, /\.json$/),
};

export function listData(type: DataType) {
  if(requireMap[type] === undefined) {
    throw new ReferenceError(`Unknown data type ${type}`);
  }

  return requireMap[type].keys().map(key => key.slice(2, key.length - 5));
}

export function hasData(type: DataType, id: string): boolean {
  if(requireMap[type] === undefined) {
    throw new ReferenceError(`Unknown data type ${type}`);
  }

  return requireMap[type].keys().includes(`./${id}.json`);
}

export function getData(type: DataType.Machine, id: string): MachineMeta;
export function getData(type: DataType.Recipe, id: string): RecipeMeta;
export function getData(type: DataType.Resource, id: string): ResourceMeta;
export function getData(type: DataType, id: string): UnknownMeta {
  if(!hasData(type, id)) {
    throw new ReferenceError(`Unknown data type ${type} ${id}`);
  }

  return {
    key: id,
    ...requireMap[type](`./${id}.json`)
  };
}