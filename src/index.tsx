import { render, h } from 'preact';
import Engine from "./Engine";
import App from './dom/App';
import Stats, { Panel } from "./utils/debug";

import "./style/style.scss";

let engine: Engine = null;
render(<App ref={el => engine = el.engine} />, document.body, document.querySelector('#app'));

if(process.env.NODE_ENV === 'development') {
  const fpsStats = new Stats();
  const tpsStats = new Stats(
    new Panel('TPS', '#ff8', '#221'),
    new Panel('tick', '#f8f', '#212')
  );

  fpsStats.dom.style.left = "145px";
  tpsStats.dom.style.left = "230px";
  document.body.appendChild(fpsStats.dom);
  document.body.appendChild(tpsStats.dom);

  setInterval(() => {
    engine.update(); tpsStats.update();
  }, 1000 / 20);
  
  const render = () => {
    engine.render(); fpsStats.update();
    requestAnimationFrame(render);
  };
  render();

  // debug exports
  let exports = {
    engine: engine,
  }

  for(let [key, value] of Object.entries(exports)) {
    (window as any)[key] = value;
  }
}