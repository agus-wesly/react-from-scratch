const container = document.getElementById("root");
let wipRoot = null;
let nextUnitOfWork = null;
let currentRoot = null;
let deletions = null;

const Didact = {
  createElement,
  render,
  useState,
};

function createElement(type, props, ...children) {
  return {
    type,
    props: {
      ...props,
      children: children.map((child) => {
        if (typeof child === "object") return child;
        return createTextElement(child);
      }),
    },
  };
}
function render(element, container) {
  wipRoot = {
    props: {
      children: [element],
    },
    node: container,
    parent: null,
    alternate: currentRoot,
  };
  deletions = [];
  nextUnitOfWork = wipRoot;
}

function createTextElement(text) {
  return {
    type: "TEXT_ELEMENT",
    props: {
      nodeValue: text,
      children: [],
    },
  };
}

function Hello() {
  const [items, setItems] = Didact.useState([]);
  const [text, setText] = Didact.useState("");
  return (
    <div>
      <h1>Hello world, {text}</h1>
      <input
        type="text"
        oninput={(e) =>
          setText(() => {
            return e.target.value;
          })
        }
      />
      <p>{JSON.stringify(items)}</p>
      <button
        onclick={() => {
          setItems((prev) => {
            return [...prev, 69];
          });
        }}
      >
        Add
      </button>
    </div>
  );
}

rerender("Hello");
function rerender(value) {
  /** @jsx Didact.createElement */
  const element = (
    <div id="foo">
      <Hello />
    </div>
  );
  Didact.render(element, container);
}

function handleChange(e) {
  rerender(e.target.value);
}

function random() {
  return Math.floor(Math.random() * 3);
}

function workLoop(deadline) {
  let shouldYield = false;
  while (nextUnitOfWork && !shouldYield) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
    shouldYield = deadline.timeRemaining() < 1;
  }
  if (!nextUnitOfWork && wipRoot) {
    commitRoot();
  }
  requestIdleCallback(workLoop);
}

requestIdleCallback(workLoop);

function commitRoot() {
  deletions.forEach((fiber) => commitPhase(fiber));
  commitPhase(wipRoot.child);
  currentRoot = wipRoot;
  wipRoot = null;
}

function commitPhase(fiber) {
  if (!fiber) return;
  let parentFiber = fiber.parent;
  while (!parentFiber.node) {
    parentFiber = parentFiber.parent;
  }
  const parentNode = parentFiber.node;
  if (fiber.effectTag === "PLACEMENT" && fiber.node !== null) {
    parentNode.appendChild(fiber.node);
  } else if (fiber.effectTag === "UPDATE" && fiber.node !== null) {
    updateProps(fiber.node, fiber.alternate.props, fiber.props);
    updateEventListener(fiber.node, fiber.alternate.props, fiber.props);
  } else if (fiber.effectTag === "DELETION") {
    commitDeletion(fiber, parentNode);
  }
  commitPhase(fiber.child);
  commitPhase(fiber.sibling);
}

function commitDeletion(fiber, parentNode) {
  if (fiber.node) {
    try {
      parentNode.removeChild(fiber.node);
    } catch (error) {
      console.log("oops");
    }
  } else {
    commitDeletion(fiber.child, parentNode);
  }
}

const isNotInNewFiber = (newProps) => (k) => !(k in newProps);
const isNew = (prevProps, newProps) => (k) => prevProps[k] !== newProps[k];
const isEventListener = (k) => k.startsWith("on");

function updateProps(node, prevProps, newProps) {
  // Clear removed
  Object.keys(prevProps)
    .filter(isPropType)
    .filter((k) => !isEventListener(k))
    .filter(isNotInNewFiber(newProps))
    .forEach((k) => {
      node[k] = "";
    });
  // Update existing
  Object.keys(newProps)
    .filter(isPropType)
    .filter((k) => !isEventListener(k))
    .filter(isNew(prevProps, newProps))
    .forEach((k) => {
      node[k] = newProps[k];
    });
}

function updateEventListener(node, prevProps, newProps) {
  Object.keys(prevProps)
    .filter(isEventListener)
    .filter((name) => !(name in newProps) || isNew(prevProps, newProps)(name))
    .forEach((name) => {
      const eventType = name.toLowerCase().substring(2);
      node.removeEventListener(eventType, prevProps[name]);
    });

  Object.keys(newProps)
    .filter(isEventListener)
    .filter(isNew(prevProps, newProps))
    .forEach((name) => {
      const eventType = name.toLowerCase().substring(2);
      node.addEventListener(eventType, newProps[name]);
    });
}

function performUnitOfWork(fiber) {
  if (fiber.type instanceof Function) {
    performFunction(fiber);
  } else {
    performElement(fiber);
  }
  if (fiber.child) return fiber.child;
  let nextFiber = fiber;
  while (nextFiber) {
    if (nextFiber.sibling) return nextFiber.sibling;
    nextFiber = nextFiber.parent;
  }
}

let wipFiber;
let hookIdx;
function performFunction(fiber) {
  wipFiber = fiber;
  wipFiber.hooks = [];
  hookIdx = 0;

  const childElements = [fiber.type(fiber.props)];
  reconcileChildren(fiber, childElements);
}

function useState(initial) {
  // Get state value from previous tree
  const prevState = wipFiber.alternate?.hooks[hookIdx];
  const state = {
    value: prevState?.value ?? initial,
    queue: [],
  };

  const prevActions = wipFiber.alternate?.hooks[hookIdx].queue ?? [];
  prevActions.forEach((act) => {
    state.value = act(state.value);
  });

  function setState(action) {
    // Skip rerender if same
    if (Object.is(state.value, action(state.value))) {
      return;
    }
    state.queue.push(action);
    wipRoot = {
      props: currentRoot.props,
      node: currentRoot.node,
      alternate: currentRoot,
    };
    nextUnitOfWork = wipRoot;
    deletions = [];
  }

  wipFiber.hooks.push(state);
  hookIdx++;
  return [state.value, setState];
}

function performElement(fiber) {
  if (!fiber.node) {
    fiber.node = createNode(fiber);
  }
  const childElements = fiber.props.children;
  reconcileChildren(fiber, childElements);
}

function reconcileChildren(wipFiber, childElements) {
  let idx = 0;
  let prevFiber = null;
  let oldFiber = wipFiber.alternate && wipFiber.alternate.child;
  while (idx < childElements.length || oldFiber != null) {
    const element = childElements[idx];
    let newFiber = null;
    const sameType = oldFiber && element && oldFiber.type === element.type;
    if (sameType) {
      newFiber = {
        node: oldFiber.node,
        type: oldFiber.type,
        props: element.props,
        parent: wipFiber,
        alternate: oldFiber,
        effectTag: "UPDATE",
      };
    }
    if (!sameType && element) {
      newFiber = {
        node: null,
        type: element.type,
        props: element.props,
        parent: wipFiber,
        alternate: null,
        effectTag: "PLACEMENT",
      };
    }
    if (!sameType && oldFiber) {
      oldFiber.effectTag = "DELETION";
      deletions.push(oldFiber);
    }
    if (oldFiber) {
      oldFiber = oldFiber.sibling;
    }
    if (idx === 0) {
      wipFiber.child = newFiber;
    } else if (newFiber) {
      prevFiber.sibling = newFiber;
    }
    ++idx;
    // TODO : fix this
    if (newFiber) {
      prevFiber = newFiber;
    }
  }
}

const isPropType = (propType) => propType !== "children";
function createNode(element) {
  const dom =
    element.type === "TEXT_ELEMENT"
      ? document.createTextNode("")
      : document.createElement(element.type);

  Object.keys(element.props)
    .filter(isPropType)
    .forEach((name) => {
      dom[name] = element.props[name];
    });

  return dom;
}
