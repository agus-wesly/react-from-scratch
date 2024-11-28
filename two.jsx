function App(props) {
    return <Child {...props} />;
}

function Child(props) {
    return <h1>Hi {props.name}</h1>;
}
const element = <App name="foo">Hi</App>;
const container = document.getElementById("root");
Didact.render(element, container);
