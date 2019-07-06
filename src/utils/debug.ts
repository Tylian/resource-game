/**
 * @author mrdoob / http://mrdoob.com/
 */

export default class Stats {
  public dom = document.createElement('div');
  
  private mode = 0;
  private beginTime = (performance || Date).now();
  private prevTime = this.beginTime;
  private frames = 0;

  private panels: Panel[] = [];

  constructor(private fpsPanel = new Panel('FPS', '#0ff', '#002'), private msPanel = new Panel( 'MS', '#0f0', '#020' )) {
    this.dom.style.cssText = 'position:fixed;top:0;left:0;cursor:pointer;opacity:0.9;z-index:10000';
    this.dom.addEventListener('click', (event) => {
      event.preventDefault();
      this.showPanel(++this.mode % this.dom.children.length);
    }, false);

	  this.addPanel(fpsPanel);
    this.addPanel(msPanel);

    this.showPanel(0);
  }

  addPanel(panel: Panel) {
    this.panels.push(panel);
		this.dom.appendChild(panel.dom);
		return panel;
  }
  
  showPanel(id: number) {
		for(let [i, panel] of this.panels.entries()) {
			panel.dom.style.display = i === id ? 'block' : 'none';
		}
		this.mode = id;
  }
  
  begin() {
    this.beginTime = (performance || Date).now();
  }

  end() {
    this.frames ++;

    let time = (performance || Date).now();
    this.msPanel.update(time - this.beginTime, 200);

    if(time >= this.prevTime + 1000) {
      this.fpsPanel.update((this.frames * 1000) / (time - this.prevTime), 100);

      this.prevTime = time;
      this.frames = 0;
    }

    return time;
  }

  update() {
    this.beginTime = this.end();
  }
}


const PR = Math.round(window.devicePixelRatio || 1);

const WIDTH = 80 * PR, HEIGHT = 48 * PR,
      TEXT_X = 3 * PR, TEXT_Y = 2 * PR,
      GRAPH_X = 3 * PR, GRAPH_Y = 15 * PR,
      GRAPH_WIDTH = 74 * PR, GRAPH_HEIGHT = 30 * PR;

export class Panel {
  public dom = document.createElement('canvas');

  private min = Infinity;
  private max = 0;
  private ctx = this.dom.getContext('2d') as CanvasRenderingContext2D;

  constructor(private name: string, private fg: string, private bg: string) {
    this.dom.width = WIDTH;
    this.dom.height = HEIGHT;
    this.dom.style.cssText = 'width:80px;height:48px';

    this.ctx.font = `bold ${9 * PR}px Helvetica,Arial,sans-serif`;
    this.ctx.textBaseline = 'top';

    this.ctx.fillStyle = bg;
    this.ctx.fillRect(0, 0, WIDTH, HEIGHT);

    this.ctx.fillStyle = fg;
    this.ctx.fillText( name, TEXT_X, TEXT_Y );
    this.ctx.fillRect(GRAPH_X, GRAPH_Y, GRAPH_WIDTH, GRAPH_HEIGHT);

    this.ctx.fillStyle = bg;
    this.ctx.globalAlpha = 0.9;
    this.ctx.fillRect(GRAPH_X, GRAPH_Y, GRAPH_WIDTH, GRAPH_HEIGHT);
	}

	update(value: number, maxValue: number) {
    this.min = Math.min(this.min, value);
    this.max = Math.max(this.max, value);

    this.ctx.fillStyle = this.bg;
    this.ctx.globalAlpha = 1;
    this.ctx.fillRect( 0, 0, WIDTH, GRAPH_Y );
    this.ctx.fillStyle = this.fg;
    this.ctx.fillText(`${Math.round(value)} ${this.name} (${Math.round(this.min)}-${Math.round(this.max)})`, TEXT_X, TEXT_Y);

    this.ctx.drawImage(this.dom, GRAPH_X + PR, GRAPH_Y, GRAPH_WIDTH - PR, GRAPH_HEIGHT, GRAPH_X, GRAPH_Y, GRAPH_WIDTH - PR, GRAPH_HEIGHT);

    this.ctx.fillRect(GRAPH_X + GRAPH_WIDTH - PR, GRAPH_Y, PR, GRAPH_HEIGHT);

    this.ctx.fillStyle = this.bg;
    this.ctx.globalAlpha = 0.9;
    this.ctx.fillRect(GRAPH_X + GRAPH_WIDTH - PR, GRAPH_Y, PR, Math.round((1 - (value / maxValue)) * GRAPH_HEIGHT));

  }
};