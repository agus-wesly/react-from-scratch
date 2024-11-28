let wipRoot = null;
let nextUnitOfWork = null;
let currentWork = null;
let deletions = null;

const Didact = {
    createElement,
    render,
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
        alternate: currentWork,
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

rerender("Hello");
const container = document.getElementById("root");
function rerender(value) {
    /** @jsx Didact.createElement */
    const element = (
        <div id="foo">
            <input type="text" oninput={handleChange} value={value} />
            <h5>Hello world !</h5>
            <p>{value}</p>
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
    deletions.forEach(commitPhase);
    commitPhase(wipRoot.child);
    currentWork = wipRoot;
    wipRoot = null;
}

function commitPhase(fiber) {
    if (!fiber) return;
    const parentNode = fiber.parent.node;
    if (fiber.effectTag === "PLACEMENT") {
        parentNode.appendChild(fiber.node);
    } else if (fiber.effectTag === "UPDATE") {
        updateProps(fiber.node, fiber.alternate.props, fiber.props);
        updateEventListener(fiber.node, fiber.alternate.props, fiber.props);
    } else if (fiber.effectTag === "DELETION") {
        parentNode.removeChild(fiber.node);
    }
    commitPhase(fiber.child);
    commitPhase(fiber.sibling);
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
    if (!fiber.node) {
        fiber.node = createNode(fiber);
    }
    const childElements = fiber.props.children;

    reconcileChildren(fiber, childElements);

    if (fiber.child) return fiber.child;
    let nextFiber = fiber;
    while (nextFiber) {
        if (nextFiber.sibling) return nextFiber.sibling;
        nextFiber = nextFiber.parent;
    }
}

function reconcileChildren(wipFiber, childElements) {
    let idx = 0;
    let prevChildElement = null;
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
        } else {
            prevChildElement.sibling = newFiber;
        }
        ++idx;
        prevChildElement = newFiber;
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
