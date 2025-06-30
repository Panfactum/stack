# Contribution Types

## Marketing Pages

Anything that isn't long-form content, we consider to be a "marketing page."

### General Guidance

- Pages are created under `src/pages`. The subpath under `pages` corresponds to the live URL. For example,
  content under `src/pages/about` will be available at `https://panfactum.com/about`.

- All one-off pages should be created as `index.astro` files. For example, `src/pages/about/index.astro` would
  define the content for `https://panfactum.com/about`.
  
- If you need to use components that are only used on a single page, you **MUST** store those files in a
  `_components` directory adjacent to the `index.astro` for that page.

- If you need to create a component that will be used on many pages, you **MUST** store those under 
  the `src/components` directory.

- If you need interactivity, you **MUST** use a SolidJS component, **NEVER** an Astro component.

- **ALWAYS** ensure that UI layouts work well on both mobile and desktop screen widths.

- **PREFER** adding subtle animations to components to add a little flair.

## UI Components

### General Guidance

- **STRONGLY PREFER** limiting components to a single component per file. 
  The file name **MUST** also be the name of the component.

- **ALWAYS** use Tailwind classes whenever possible instead of defining inline styles or new style sheets.
  The primary exception to this rule is if animations are required.

- **ALWAYS** store images that a component uses in an `images` directory adjacent to the component file. **NEVER** store them in `public`.


#### Astro Components

- **STRONGLY AVOID** using `<script>` blocks to add interactivity. Instead, prefer writing a SolidJS component if interactivity is needed.

- Every `index.astro` page component **MUST** have its content wrapped in a layout from `src/components/layouts`.

  - `src/component/layouts/docs/Layout.astro` - Use for documentation pages

  - `src/component/layouts/primary/Layout.astro` - Use for marketing pages

- **ALWAYS** use Tailwind classes when possible.
  When not possible, **ALWAYS** use [Scoped Styles](https://docs.astro.build/en/guides/styling/#scoped-styles).

#### SolidJS Components

- **NEVER** export the component as the default export.

- **NEVER** import an Astro component into a SolidJS component.

- **ALWAYS** define the component as an anonymous function typed as either a `Component` or `ParentComponent`.

- **ALWAYS** provide a discrete interface for the props if the props are used.

- **ALWAYS** use `clsx` for class string concatenation. **NEVER** use the default export from the `clsx` module.

- **ALWAYS** use Tailwind classes when possible.
  When not possible, **ALWAYS** use [CSS modules](https://docs.solidjs.com/guides/styling-components/css-modules).

- When adding images to components, **ALWAYS** import the image file and use the `Image` component from `@unpic/solid` to
  render it. **NEVER** reference an image using a remote URL or absolute path.

- **PREFER** using CSS states such as `:hover` rather than implementing mouse handlers such as
`onMouseEnter` and `onMouseLeave` if possible. This significantly improves performance.


##### Good Examples

```tsx
import type { ParentComponent } from "solid-js";
import { clsx } from "clsx";

interface IMyComponentProps {
    text: string;
    hidden: boolean;
}

export const MyComponent: ParentComponent<IMyComponentProps> = (props) => {
    return (
        <div class={clsx(props.hidden && "hidden")}>
            {props.text}
            {props.children}
        </div>
    );
};
```

```tsx
import type { Component } from "solid-js";
import { Image } from "@unpic/solid";
import SomeImage from "./images/dummy.png";
 
export const MyComponent: Component = () => {
    return (
         <Image src={SomeImage.src} alt="Italian Trulli">
    );
};
```

##### Bad Examples

```tsx
import type { ParentComponent } from "solid-js";

// BAD: Don't use the default clsx export
import clsx from "clsx";

// BAD: Don't use an inline interface definition
const MyComponent: ParentComponent<{
    text: string;
    hidden: boolean;
}> = (props) => {
    return (
        <div class={clsx(props.hidden && "hidden")}>
            {props.text}
            {props.children}
        </div>
    );
};

// BAD: Never use a default export for a component.
export default MyComponent;
```

```tsx
// BAD: Don't use named functions
export function MyComponent(props){
    return (
        <div>
            {props.text}
        </div>
    );
};
```

```tsx
import type { ParentComponent } from "solid-js";

interface IMyComponentProps {
    text: string;
    hidden: boolean;
}

export const MyComponent: ParentComponent<IMyComponentProps> = (props) => {
    // BAD: Don't perform class string logic without `clsx`
    return (
        <div class={props.hidden ? "hidden" : ""}>
            {props.text}
            {props.children}
        </div>
    );
};
```

```tsx
import type { Component } from "solid-js";

export const MyComponent: Component = () => {
    // BAD: Don't use inline styles
    return (
        <div style={{color: "red"}} />
    );
};
```

```tsx
import type { Component } from "solid-js";

export const MyComponent: Component = () => {
    // BAD: Don't use `<img>. Use `Image` from `@unpic/solid`.
    return (
         <img src="/pic.jpg" alt="Italian Trulli">
    );
};
```

## Long-form Content

All long-form content is written in `.mdx` files which can be found in the `src/content/` directory.

### Audience

The audience for our long-form content is software engineers.
In general, you should assume they have basic familiarity
with tools like the terminal, cloud providers, general SDLC concepts, and general purpose programming languages.
However, you should **NOT** assume that they have strong familiarity with cloud tooling such as Kubernetes, Terraform, Nix, etc. All of our documentation is meant to inform and level up this audience.

### Voice

**When writing new content, imagine yourself as the following persona:**

Wise authority who has been there and is sharing the solution back to the team to solve the problem.

Core Voice Characteristics:

1. Confidently forward-looking without being hyperbolic
2. Technical authority balanced with conversational clarity
3. Solutions-oriented with a focus on business impact

Tone: Informed and authoritative, yet approachable and practical. This persona speaks with the confidence of deep technical expertise but translates complex concepts into business value.

Key Personality Traits:

1. Insightful: Offers unexpected perspectives that challenge conventional thinking
2. Pragmatic: Grounds innovation in real-world applications and measurable outcomes
3. Trusted advisor: Positions as a partner in digital transformation, not just a vendor

Example Statement: "While everyone's talking about AI integration, the real competitive advantage lies in designing systems that make AI truly operational at scale. Let's explore how your existing infrastructure can be optimized to deliver those capabilities without a complete rebuild."

### General Guidance 

- To create a new page, simply add a new `.mdx` file to the relevant collection under `src/content`. The following
  collections are available:

  - `src/content/docs`: Framework documentation
  
  - `src/content/changelog`: Change entries

  The path under the collection will be the rendered page path. For example, `src/content/docs/edge/guides/overview/index.mdx` will be rendered at `https://panfactum.com/docs/edge/guides/overview`.

- **ALWAYS** name MDX files `index.mdx`.

- **ALWAYS** provide a short summary of the page content under the `summary` MDX frontmatter field.


### Guidance for Specific Content Types

#### Framework Documentation

All framework documentation can be found in `src/content/docs`. Each subfolder of this directory (`edge`, `main`, etc.) represents a "release channel" -- we maintain discrete documentation for each active release channel.

A few rules to follow:

- The `main` folder represents unreleased documentation for the next edge release. In general, all documentation updates should be
  performed here.

- **NEVER** edit documentation in the `edge` directory. When a new edge release is created, 
  the documentation from `main` will automatically be transformed into the appropriate documentation for the `edge` channel.

- You can edit documentation in the stable directories (e.g., `stable-25-04`). While those release channels have their
  own branch in this repository (which contains its own website package code), you **MUST** edit the documentation on the `main` branch for the live documentation site to be updated. 
  
  Yes, this is a bit confusing, and we are looking to build some improved automations around this in the future. Fortunately, documentation updates for stable releases are relatively rare.

#### Changelog Entries

Every release gets it's own `.mdx` file under `src/content/changelog`. These entries have a very particular format:

```mdx
---
summary: This is a summary of the changes in this entry. Feel free to use AI to generate.
---

import ChangelogEntry from "./ChangelogEntry.astro"

<ChangelogEntry>
  <Fragment slot="breaking-changes">
    * Some breaking change
  </Fragment>

  <Fragment slot="additions">
    * Some new feature
  </Fragment>

  <Fragment slot="fixes">
    * Some bugfix
  </Fragment>
</ChangelogEntry>
```

A few rules to follow:

- Files **MUST** be named `<release_name>.mdx`, except for unreleased changes which should be added to `main.mdx`.

- Each entry should have a `summary` frontmatter which provides a single-sentence summary of the changes.

- All content should be wrapped in a `ChangelogEntry` component and contained within slotted fragments that have one of the following
  slot names:

  - `breaking-changes` - Everything that will break when a user upgrades to this version. **MUST** include step-by-step 
    instructions on how to resolve the breakages.
  
  - `additions` - New features that have been added.

  - `changes` - Behavior changes that the user should take not of but which don't necessarily break any public interfaces or
     contracts that the Panfactum framework provides (relatively rare).

  - `fixes` - Bugfixes.

- **NEVER** create links to pages in the unreleased docs (`src/content/docs/main/*`).

### Utilities

#### Math

LaTeX syntax via KaTeX is available for use in `.mdx` files. See [these docs](https://mdxjs.com/guides/math/) for more information.

#### Images

Images should be committed directly to the repository which uses [Git LFS](https://git-lfs.com/) for storage.

```mdx
import MarkdownImage from "@/components/markdown/MarkdownImage.astro";
import SomeImage from './image.jpg'

# Some Page

<MarkdownImage src={SomeImage} alt="Here is some image that is automatically optimized for web display" />
```

#### Alerts / Callouts

Sometimes you will want to draw attention to some critical information. To do that, you
can use the `MarkdownAlert` wrapper:

```mdx
import MarkdownAlert from "@/components/markdown/MarkdownAlert.astro";

<MarkdownAlert severity="info">
  Here is some important information!
</MarkdownAlert>
```

We have the following severity conventions:

- `info` - An aside that most users will likely find helpful.
- `warning` - An callout that if missed will likely result in user errors.

# Styles and CSS

We use Tailwind v4 for styling. Our Tailwind theme configuration can be found in @src/styles/global.css.

## Critical Rules

- **ALWAYS** use our Tailwind utility classes when applicable:

  - @src/styles/utilities/colors.css - Semantic colors of text, background, borders, etc.

  - @src/styles/utilities/textSizes.css - Responsive text sizes

- **PREFER** using our utility colors when possible. For example, `bg-primary` instead of `bg-gray-dark-mode-950`.

- We do **NOT** have a dark mode, so **NEVER** use the `dark:` variant.


# Miscellaneous Rules

- **ALWAYS** use relative imports with referencing files in the same directory, a child directory, or in the same
  `_component` directory (e.g., `./SomeComponent.tsx`, `./util/someFunc.ts`).
  Otherwise, **ALWAYS** use `@/` imports (e.g., `@/components/layouts/primary/Layout.astro`).image.png