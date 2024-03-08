import { clsx } from 'clsx'
import type { MDXComponents } from 'mdx/types'

import { roboto } from './app/font'
import {currentPanfactumVersion} from "@/app/vars";

const defaultTextSize = ['text-xs', 'sm:text-base']

export function useMDXComponents (components: MDXComponents): MDXComponents {
  return {
    ...components,
    strong: ({ children }) => (
      <strong className="font-semibold">
        {children}
      </strong>
    ),
    ul: ({ children }) => (
      <ul className={'py-0.5 m-0 pl-4'}>
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className={'py-0.5 m-0 pl-4'}>
        {children}
      </ol>
    ),
    li: ({ children }) => (
      <li className={clsx('py-0.5', defaultTextSize)}>
        {children}
      </li>
    ),
    p: ({ children }) => (
      <p className={clsx('py-1', defaultTextSize)}>
        {children}
      </p>
    ),
    h1: ({ children }) => (
      <h1 className={'pt-3 text-2xl sm:text-3xl'}>
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className={'pt-4 flex gap-x-2 items-baseline text-xl sm:text-2xl'}>
        {children}
        <div className="h-[2px] grow bg-neutral"/>
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className={'pt-3 text-base font-semibold sm:text-lg'}>
        {children}
      </h3>
    ),
    h4: ({ children }) => (
      <h4 className={'pt-1 text-sm sm:text-base'}>
        {children}
      </h4>
    ),
    a: ({ children, href }) => (
      <a
        href={href}
        className="text-primary markdown"
      >
        {children}
      </a>
    ),
    code: ({ children }) => (
      <code className={`${roboto.className} rounded-sm text-xs sm:text-sm`}>
        {children}
      </code>
    ),
    table: ({ children }) => (
      <div className="overflow-x-scroll">
        <table className="py-2 bg-neutral rounded-md">
          {children}
        </table>
      </div>
    ),
    td: ({ children }) => (
      <td className={clsx('p-1 pb-3 align-top', defaultTextSize)}>
        {children}
      </td>
    ),
    th: ({ children }) => (
      <th className={clsx('p-1 border-solid border-b-2 border-gray-dark', defaultTextSize)}>
        {children}
      </th>
    ),
    span: ({children, className}) => {

      let actualChildren = children;

      // This allows string replacement in the code blocks we add to our documentation
      // to ensure that we can easily maintain consistency across all docs
      if(className && className.includes('token') && typeof children === "string" ){
        actualChildren = children
          .replaceAll("__currentPanfactumVersion__", currentPanfactumVersion)
      }

      return (
        <span className={className}>
          {actualChildren}
        </span>
      )
    }
  }
}
