type Callback = (...args: any) => any;
interface EventList {
  [event: string]: Callback;
}

export function evt(events: EventList) {
  return (el: HTMLElement) => {
    for(let [event, callback] of Object.entries(events)) {
      el.addEventListener(event, callback);
    }
  };
}