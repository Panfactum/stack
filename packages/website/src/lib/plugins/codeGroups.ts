import type { Element, Root } from "hast";
import { toString as hastToString } from "hast-util-to-string";
import type { Plugin } from "unified";
import { SKIP, visit } from "unist-util-visit";

/**
 * Class names used for styling the code group elements.
 */
type ClassNames = {
  /**
   * The class name for the active tab.
   * This class will be applied to the currently active tab to highlight it.
   * Default: "active"
   */
  activeTabClass: string;

  /**
   * The class name for the active code block.
   * This class will be applied to the currently active code block to make it visible.
   * Default: "active"
   */
  activeBlockClass: string;

  /**
   * The class name for the tab elements.
   * This class will be applied to each tab button.
   * Default: "rcg-tab"
   */
  tabClass: string;

  /**
   * The class name for the container of the tabs.
   * This class will be applied to the container element that holds all the tab buttons.
   * Default: "rcg-tab-container"
   */
  tabContainerClass: string;

  /**
   * The class name for the container of the code blocks.
   * This class will be applied to the container element that holds all the code blocks.
   * Default: "rcg-blocks"
   */
  blockContainerClass: string;

  /**
   * The class name for the entire code group.
   * This class will be applied to the main container element that wraps the tabs and code blocks.
   * Default: "rehype-code-group"
   */
  codeGroupClass: string;
};

/**
 * Options to customize the Rehype Code Group plugin.
 */
type RehypeCodeGroupOptions = {
  /**
   * An object to override the default class names.
   * This allows you to provide custom class names for the various elements of the code group.
   * Example:
   * {
   *   activeTabClass: "my-active-tab",
   *   tabClass: "my-tab",
   *   tabContainerClass: "my-tab-container",
   *   blockContainerClass: "my-block-container",
   *   codeGroupClass: "my-code-group",
   * }
   */
  customClassNames?: Partial<ClassNames>;
};

export type CodeGroup = {
  parentNode: Element | Root;
  startIndex: number;
  tabLabels: string[];
};


export const defaultClassNames: ClassNames = {
  activeTabClass: "active",
  activeBlockClass: "active",
  tabClass: "rcg-tab",
  tabContainerClass: "rcg-tab-container",
  blockContainerClass: "rcg-block",
  codeGroupClass: "rehype-code-group",
};

const mergeClassNames = (defaultClass: string, customClass?: string) =>
  customClass ? `${defaultClass} ${customClass}` : defaultClass;

export const getClassNames = (
  customClassNames?: Partial<ClassNames>,
): ClassNames => {
  return {
    activeTabClass: mergeClassNames(
      defaultClassNames.activeTabClass,
      customClassNames?.activeTabClass,
    ),
    activeBlockClass: mergeClassNames(
      defaultClassNames.activeBlockClass,
      customClassNames?.activeBlockClass,
    ),
    tabClass: mergeClassNames(
      defaultClassNames.tabClass,
      customClassNames?.tabClass,
    ),
    tabContainerClass: mergeClassNames(
      defaultClassNames.tabContainerClass,
      customClassNames?.tabContainerClass,
    ),
    blockContainerClass: mergeClassNames(
      defaultClassNames.blockContainerClass,
      customClassNames?.blockContainerClass,
    ),
    codeGroupClass: mergeClassNames(
      defaultClassNames.codeGroupClass,
      customClassNames?.codeGroupClass,
    ),
  };
};

export const styles = `
.${defaultClassNames.codeGroupClass} {
  display: grid;
  gap: 0.6rem;
}
.${defaultClassNames.tabContainerClass} {
  display: flex;
  border-bottom: 1px solid #ddd;
}
.${defaultClassNames.tabClass} {
  padding: 0.5rem 1rem;
  cursor: pointer;
  border: none;
  background: none;
  &.${defaultClassNames.activeTabClass} {
    border-bottom: 2px solid;
    font-weight: bold;
  }
}
.${defaultClassNames.blockContainerClass} {
  display: none;
  overflow-x: auto;
  &.${defaultClassNames.activeBlockClass} {
    display: block;
  }
}
`;


export const getScript = (classNames: ClassNames) => {
  const activeTabClassNames = classNames.activeTabClass.split(" ");
  const activeBlockClassNames = classNames.activeBlockClass.split(" ");

  return `
document.addEventListener("astro:page-load", function () {
  const codeGroups = document.querySelectorAll(".${defaultClassNames.codeGroupClass}");

  codeGroups.forEach((group) => {
    const tabs = group.querySelectorAll(".${defaultClassNames.tabClass}");
    const blocks = group.querySelectorAll(".${defaultClassNames.blockContainerClass}");
    let activeTab = group.querySelector(".${defaultClassNames.tabClass}.${activeTabClassNames.join(".")}");
    let activeBlock = group.querySelector(".${defaultClassNames.blockContainerClass}.${activeBlockClassNames.join(".")}");

    group.addEventListener("click", (event) => {
      const tab = event.target.closest(".${defaultClassNames.tabClass}");
      if (!tab) return;

      const index = Array.from(tabs).indexOf(tab);
      if (index === -1) return;

      if (activeTab) {
        activeTab.classList.remove(${activeTabClassNames
      .map((c) => `"${c}"`)
      .join(", ")});
        activeTab.setAttribute("aria-selected", "false");
      }
       if (activeBlock) {
        activeBlock.classList.remove(${activeBlockClassNames
      .map((c) => `"${c}"`)
      .join(", ")});
        activeBlock.setAttribute("hidden", "true");
      }

      tab.classList.add(${activeTabClassNames.map((c) => `"${c}"`).join(", ")});
      tab.setAttribute("aria-selected", "true");
      blocks[index].classList.add(${activeBlockClassNames
      .map((c) => `"${c}"`)
      .join(", ")});
      blocks[index].removeAttribute("hidden");

      activeTab = tab;
      activeBlock = blocks[index];
    });
  });
});
`;
};


let idCounter = 0;
const generateUniqueId = (): string => {
  return `rcg-${idCounter++}`;
};

const createRcgTabsElement = (
  tabLabels: string[],
  classNames: ClassNames,
  uniqueId: string,
): Element => {
  return {
    type: "element",
    tagName: "div",
    properties: { className: classNames.tabContainerClass, role: "tablist" },
    children: tabLabels.map((label, i) => ({
      type: "element",
      tagName: "button",
      properties: {
        className: `${classNames.tabClass}${i === 0 ? ` ${classNames.activeTabClass}` : ""}`,
        role: "tab",
        "aria-selected": i === 0 ? "true" : "false",
        "aria-controls": `${uniqueId}-block-${i}`,
        id: `${uniqueId}-tab-${i}`,
      },
      children: [{ type: "text", value: label }],
    })),
  };
};

const createCodeBlockWrapper = (
  codeBlock: Element,
  classNames: ClassNames,
  uniqueId: string,
  idx: number,
): Element => {
  const isActive = idx === 0;
  return {
    type: "element",
    tagName: "div",
    properties: {
      className: `${classNames.blockContainerClass}${isActive ? ` ${classNames.activeBlockClass}` : ""}`,
      role: "tabpanel",
      "aria-labelledby": `${uniqueId}-tab-${idx}`,
      id: `${uniqueId}-block-${idx}`,
      hidden: !isActive,
    },
    children: [codeBlock],
  };
};

export const createRehypeCodeGroupElement = (
  codeGroup: CodeGroup,
  endIndex: number,
  classNames: ClassNames,
): Element => {
  const { parentNode, startIndex, tabLabels } = codeGroup;
  const codeBlocks: Element[] = [];
  const uniqueId = generateUniqueId();

  const rcgTabsElement: Element = createRcgTabsElement(
    tabLabels,
    classNames,
    uniqueId,
  );

  for (let i = startIndex + 1; i < endIndex; i++) {
    const codeBlock = parentNode.children[i] as Element;

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (codeBlock.type === "element") {
      codeBlocks.push(
        createCodeBlockWrapper(
          codeBlock,
          classNames,
          uniqueId,
          codeBlocks.length,
        ),
      );
    }
  }

  return {
    type: "element",
    tagName: "div",
    properties: { className: classNames.codeGroupClass },
    children: [rcgTabsElement, ...codeBlocks],
  };
};

export const createStyleElement = (): Element => {
  return {
    type: "element",
    tagName: "style",
    properties: {},
    children: [{ type: "text", value: styles }],
  };
};

export const createScriptElement = (classNames: ClassNames): Element => {
  return {
    type: "element",
    tagName: "script",
    properties: { type: "text/javascript" },
    children: [{ type: "text", value: getScript(classNames) }],
  };
};


const START_DELIMITER_REGEX = /::: code-group labels=\[([^\]]+)\]/;
const END_DELIMITER = ":::";

export const isStartDelimiterNode = (node: Element): boolean => {
  const match = hastToString(node).trim().match(START_DELIMITER_REGEX);
  return node.tagName === "p" && match !== null;
};

export const isEndDelimiterNode = (node: Element): boolean => {
  return node.tagName === "p" && hastToString(node).trim() === END_DELIMITER;
};



/**
 * Handle the start delimiter node.
 * If the node is a start delimiter,
 * - create a code group object
 * - push it to the code groups stack.
 *
 * @param {Element} node - The current node being visited.
 * @param {number} index - The index of the current node in its parent's children.
 * @param {Element | Root} parent - The parent of the current node.
 * @param {CodeGroup[]} codeGroups - The stack to keep track of the last found start delimiter.
 */
export const handleStartDelimiter = (
  node: Element,
  index: number,
  parent: Element | Root,
  codeGroups: CodeGroup[],
) => {
  const startMatch = hastToString(node).trim().match(START_DELIMITER_REGEX);

  if (startMatch) {
    const tabLabels = startMatch[1].split(",").map((label) => label.trim());
    codeGroups.push({ parentNode: parent, startIndex: index, tabLabels });
  }
};

/**
 * Handle the end delimiter node.
 * If the node is an end delimiter,
 * - pop the last code group from the stack
 * - create a rehype-code-group element
 * - replace the code group nodes with the rehype-code-group element.
 * - return the skip index to skip the replaced nodes.
 * - return the found status.
 * If the node is not an end delimiter, return the not found status.
 *
 * @param {number} index - The index of the current node in its parent's children.
 * @param {Element | Root} parent - The parent of the current node.
 * @param {CodeGroup[]} codeGroups - The stack to keep track of the last found start delimiter.
 * @param {ClassNames} classNames - The class names for styling code group elements.
 */
export const handleEndDelimiter = (
  index: number,
  parent: Element | Root,
  codeGroups: CodeGroup[],
  classNames: ClassNames,
) => {
  const codeGroup = codeGroups.pop();
  const endIndex = index;

  if (codeGroup && codeGroup.parentNode === parent) {
    const { parentNode, startIndex } = codeGroup;

    const rehypeCodeGroupElement: Element = createRehypeCodeGroupElement(
      codeGroup,
      endIndex,
      classNames,
    );

    parentNode.children.splice(
      startIndex,
      endIndex - startIndex + 1,
      rehypeCodeGroupElement,
    );
    return {
      found: true,
      skipIndex: startIndex + 1,
    };
  }
  return { found: false, skipIndex: -1 };
};


const addStylesAndScript = (
  tree: Root,
  classNames: ClassNames,
  headElement?: Element,
  htmlElement?: Element,
  firstStyleIndex = -1,
) => {
  let head = headElement;
  const html = htmlElement;

  const styleElement: Element = createStyleElement();
  const scriptElement: Element = createScriptElement(classNames);

  if (head) {
    if (firstStyleIndex !== -1) {
      head.children.splice(firstStyleIndex, 0, styleElement);
    } else {
      head.children.push(styleElement);
    }
    head.children.push(scriptElement);
  } else if (html) {
    head = {
      type: "element",
      tagName: "head",
      properties: {},
      children: [styleElement, scriptElement],
    };
    html.children.unshift(head);
  } else {
    tree.children.unshift({
      type: "element",
      tagName: "head",
      properties: {},
      children: [styleElement, scriptElement],
    });
  }
};

/**
 * ## Rehype Code Group
 * A Rehype plugin for grouping code blocks with tabs,
 * allowing you to switch between different code snippets easily.
 * Perfect for documentation and tutorials where you want to show
 * the same code in different languages or configurations.
 *
 * Works with all Code Syntax Highlighters
 *
 * @param options {@link RehypeCodeGroupOptions} - Options to customize the plugin.
 * @returns Transformer function to process the AST.
 *
 * @example
 * // With rehype
 * import fs from "node:fs/promises";
 * import { rehype } from "rehype";
 * import rehypeCodeGroup from "rehype-code-group";
 *
 * const document = await fs.readFile("example/input.html", "utf8");
 *
 * const file = await rehype()
 *   .use(rehypeCodeGroup, {
 *     customClassNames: {
 *       activeTabClass: "my-active-tab",
 *     },
 *   })
 *   .process(document);
 *
 * await fs.writeFile("example/output.html", String(file));
 *
 * @example
 * // With Astro (https://astro.build)
 * import { defineConfig } from 'astro/config';
 * import rehypeCodeGroup from 'rehype-code-group';
 *
 * // https://docs.astro.build/en/reference/configuration-reference/
 * export default defineConfig({
 *   // ...
 *   markdown: {
 *     // ...
 *     rehypePlugins: [
 *       // ...
 *       rehypeCodeGroup,
 *     ],
 *   },
 *   // ...
 * });
 */
const rehypeCodeGroup: Plugin<[RehypeCodeGroupOptions], Root> = (
  options = {},
) => {
  const { customClassNames } = options;
  const classNames = getClassNames(customClassNames);

  return (tree: Root) => {
    let headElement: Element | undefined;
    let htmlElement: Element | undefined;
    let firstStyleIndex = -1;
    const codeGroups: CodeGroup[] = [];
    let codeGroupFound = false;

    /**
     * Visit each element node in the tree to
     * - find code groups and wrap them in a rehype-code-group element.
     * - find the head and html elements to add styles and script.
     *
     * @param {Element} node - The current node being visited.
     * @param {number} index - The index of the current node in its parent's children.
     * @param {Element} parent - The parent of the current node.
     */
    visit(tree, "element", (node, index, parent) => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (node.type !== "element" || index === undefined) {
        return;
      }

      if (node.tagName === "head") {
        headElement = node;
      }

      if (node.tagName === "html") {
        htmlElement = node;
      }

      // Identify the first style element index
      if (node.tagName === "style" && firstStyleIndex === -1) {
        firstStyleIndex = -1;
      }

      if (!parent) {
        return;
      }

      if (isStartDelimiterNode(node)) {
        handleStartDelimiter(node, index, parent, codeGroups);
        return [SKIP];
      }

      if (isEndDelimiterNode(node)) {
        const { found, skipIndex } = handleEndDelimiter(
          index,
          parent,
          codeGroups,
          classNames,
        );

        if (found) {
          codeGroupFound = found;
          return [SKIP, skipIndex];
        }
      }
    });

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (codeGroupFound) {
      addStylesAndScript(
        tree,
        classNames,
        headElement,
        htmlElement,
        firstStyleIndex,
      );
    }
  };
};

export default rehypeCodeGroup;