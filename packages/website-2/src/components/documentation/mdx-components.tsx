import {
  discordServerLink,
  replaceVersionPlaceholders,
} from "@/lib/constants.ts";

export const mdxComponents = {
  code: ({ children, ...props }) => {
    const child = {
      ...children,
      props: {
        ...children.props,
        value: replaceVersionPlaceholders(children.props.value),
      },
    };

    return <code {...props}>{child}</code>;
  },

  a: ({ children, ...props }) => {
    const updatedProps = {
      ...props,
      href: replaceVersionPlaceholders(props.href).replaceAll(
        "__discordServerLink__",
        discordServerLink,
      ),
    };

    return <a {...updatedProps}>{children}</a>;
  },
};
