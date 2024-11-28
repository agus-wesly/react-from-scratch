function App(props) {
  return /*#__PURE__*/React.createElement(Child, props);
}
function Child(props) {
  return /*#__PURE__*/React.createElement("h1", null, "Hi ", props.name);
}
const element = /*#__PURE__*/React.createElement(App, {
  name: "foo"
}, "Hi");
const container = document.getElementById("root");
Didact.render(element, container);