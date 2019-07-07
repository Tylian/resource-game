import { h, Component, RenderableProps } from "preact";

interface AccordianProps {
  title: string;
}

interface AccordianState {
  hidden: boolean;
}

export default class Accordian extends Component<AccordianProps, AccordianState> {
  constructor(props: AccordianProps) {
    super(props);
    this.state = {
      hidden: false
    };
  }

  render({ title, children }: RenderableProps<AccordianProps>, { hidden }: AccordianState) {
    return <div class="accordian">
      <h1 onClick={() => this.setState({ hidden: !this.state.hidden })}>{title} { hidden ? "⯈" : "⯆" }</h1>
      {!hidden && children}
    </div>
  }
}