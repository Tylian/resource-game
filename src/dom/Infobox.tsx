import { FunctionalComponent, h } from 'preact';
import { ResourceMap, getMetadata, DataType } from '../utils/data';
import Engine from '../Engine';
import Node, { Resource } from '../Node';
import { default as cn } from 'classnames';

import '../style/infobox.scss';

export interface RecipeInfo {
  key: string;
  speed: number;
  inputs: ResourceMap;
  outputs: ResourceMap;
}

export interface NodeInfo {
  type: string;
  resources: ResourceMap<Resource>;
  recipe: RecipeInfo | null;
  recipes: string[];
  ghost: boolean;
}

interface InfoboxProps {
  engine: Engine;
  node: Node;
  info: NodeInfo;
}

function siPrefix(n: number) {
  if(n > 1000) {
    return `${n / 1000} M`;
  } else if(n > 1) {
    return `${n} k`
  }
  return (n * 1000).toString();
}

function RecipeItem(key: string, amount: number, speed: number) {
  const metadata = getMetadata(DataType.Resource, key);
  if(name == "energy") {
    return (<li key={key}><strong>{metadata.name}:</strong> {siPrefix(amount)}W ({siPrefix(speed)}J)</li>);
  } else {
    return (<li key={key}><strong>{metadata.name}:</strong> {amount} ({speed}/s)</li>);
  }
}

function RecipeInfo({ info }: { info: RecipeInfo }) {
  const perSec = 1 / info.speed;
  const inputs = [
    <h3>Inputs</h3>,
    <ul>{Object.entries(info.inputs).map(([key, amount]) => RecipeItem(key, amount, amount * perSec))}</ul>
  ];
  const outputs = [
    <h3>Outputs</h3>,
    <ul>{Object.entries(info.outputs).map(([key, amount]) => RecipeItem(key, amount, amount * perSec))}</ul>
  ];

  return (<div>
    <h2>Recipe</h2>
    <b>Speed:</b> {info.speed}s per ({perSec}/s)
    { Object.keys(info.inputs).length > 0 && inputs }
    { Object.keys(info.outputs).length > 0 && outputs }
  </div>);
}

const Infobox: FunctionalComponent<InfoboxProps> = ({ node, info }) => {
  const resourceList = Object.entries(info.resources).map(([key, resource]) => {
    const metadata = getMetadata(DataType.Resource, key);
    return <li key={key}><strong>{metadata.name}:</strong> {resource.amount} / {resource.maximum}</li>;
  });

  const metadata = getMetadata(DataType.Node, info.type);

  if(info.ghost) {
    return (<div class="infobox floating">
      <h1>{metadata.name}</h1>
      Direct resources to this node to build it.
      <h2>Resources</h2>
      <ul>{resourceList}</ul>
    </div>);
  } else {
    const recipeList = info.recipes.map(recipe => {
      let metadata = getMetadata(DataType.Recipe, recipe);
      return <button onClick={() => node.setRecipe(recipe)} class={cn({ active: info.recipe !== null && recipe == info.recipe.key })}>{metadata.name}</button>;
    });

    return (<div class="infobox floating">
      <h1>{metadata.name}</h1>
      { node.manual && <button onClick={() => node.poke()}>Activate</button>}
      <h2>Resources</h2>
      <ul>{resourceList}</ul>
      <h2>Recipes</h2>
      {recipeList}
      {info.recipe && info.recipe.speed > 0 && <RecipeInfo info={info.recipe} /> }
    </div>);
  }
};

export default Infobox;