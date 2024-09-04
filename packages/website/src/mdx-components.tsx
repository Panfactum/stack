import { clsx } from 'clsx'
import type { MDXComponents } from 'mdx/types'
import Link from 'next/link'
import type { ReactNode, Ref } from 'react'

import CopyHeader from '@/components/markdown/CopyHeader'
import PrettyBalancer from '@/components/ui/PrettyBalancer'
import {
  discordServerLink,
  replaceVersionPlaceholders
} from '@/lib/constants'

import { roboto } from './app/font'

const defaultTextSize = ['text-sm', 'sm:text-[1.03rem]', 'sm:leading-[1.55rem]']

const replaceCodeVariables = (str: string) => {
  return replaceVersionPlaceholders(str)
    .replaceAll('__discordServerLink__', discordServerLink)
}

const makeIdFromChildren = (children: ReactNode) => {
  return typeof children === 'string'
    ? children.replaceAll(/[ _`"']/g, '-').toLowerCase()
    : 'unknown'
}

export function useMDXComponents (components: MDXComponents): MDXComponents {
  return {
    ...components,
    strong: ({ children, className, ...props }) => (
      <strong
        className={clsx('font-semibold inline', className)}
        {...props}
      >
        {children}
      </strong>
    ),
    ul: ({ children, className, ...props }) => (
      <ul
        className={clsx('py-0.5 m-0 pl-8', className)}
        {...props}
      >
        {children}
      </ul>
    ),
    ol: ({ children, className, ...props }) => (
      <ol
        className={clsx('py-0.5 m-0 pl-8', className)}
        {...props}
      >
        {children}
      </ol>
    ),
    li: ({ children, className, ...props }) => (
      <li
        className={clsx('py-0.5', defaultTextSize, className)}
        {...props}
      >
        {children}
      </li>
    ),
    p: ({ children, className, ...props }) => (

      <p
        className={clsx('py-[0.4rem]', defaultTextSize, className)}
        {...props}
      >
        <PrettyBalancer>
          {children}
        </PrettyBalancer>
      </p>

    ),
    h1: ({ children, className, ...props }) => (
      <h1
        className={clsx('pt-3 font-semibold text-3xl sm:text-4xl', className)}
        {...props}
      >
        {children}
      </h1>
    ),
    h2: ({ children, className, ...props }) => {
      return (
        <h2
          className={clsx('pt-4 flex gap-x-2 items-baseline font-semibold text-2xl sm:text-3xl', className)}
          {...props}
        >
          {children}
          <CopyHeader id={makeIdFromChildren(children)}/>
          <div className="h-[2px] grow bg-neutral"/>
        </h2>
      )
    },
    h3: ({ children, className, ...props }) => (
      <h3
        className={clsx('pt-3 flex gap-x-2 items-baseline font-semibold text-xl  sm:text-2xl', className)}
        {...props}
      >
        {children}
        <CopyHeader
          id={makeIdFromChildren(children)}
          size={'small'}
        />
      </h3>
    ),
    h4: ({ children, className, ...props }) => (
      <h4
        className={clsx('pt-1 font-semibold text-lg sm:text-xl', className)}
        {...props}
      >
        {children}
      </h4>
    ),
    a: ({ children, href, className, ref, ...props }) => {
      // Inline scrolling to scroll anchors does not work properly with the Next Link component
      if (typeof href === 'string' && href.startsWith('#')) {
        return (
          <a
            href={replaceCodeVariables(href || '')}
            className={clsx('inline markdown', className)}
            ref={ref as Ref<HTMLAnchorElement> | undefined}
            {...props}
          >
            {children}
          </a>
        )
      } else {
        return (
          <Link
            href={replaceCodeVariables(href || '')}
            className={clsx('inline markdown', className)}
            ref={ref as Ref<HTMLAnchorElement> | undefined}
            {...props}
          >
            {children}
          </Link>
        )
      }
    },
    code: ({ children, ...props }) => {
      let actualChildren = children

      // This allows string replacement in the code blocks we add to our documentation
      // to ensure that we can easily maintain consistency across all docs
      if (typeof children === 'string') {
        actualChildren = replaceCodeVariables(children)
      }

      return (
        <code
          className={`${roboto.className} rounded-sm text-xs sm:text-sm`}
          {...props}
        >
          {actualChildren}
        </code>
      )
    },
    table: ({ children, className, ...props }) => (
      <div className="overflow-x-scroll">
        <table
          className={clsx('py-1 my-4 w-full bg-neutral rounded-md', className)}
          {...props}
        >
          {children}
        </table>
      </div>
    ),
    td: ({ children, className, ...props }) => (
      <td
        className={clsx('p-1 pb-3 align-top', defaultTextSize, className)}
        {...props}
      >
        {children}
      </td>
    ),
    th: ({ children, className, ...props }) => (
      <th
        className={clsx('p-1 border-solid border-b-2 border-gray-dark', defaultTextSize, className)}
        {...props}
      >
        {children}
      </th>
    ),
    span: ({ children, className, ...props }) => {
      let actualChildren = children

      // This allows string replacement in the code blocks we add to our documentation
      // to ensure that we can easily maintain consistency across all docs
      if (className && className.includes('token') && typeof children === 'string') {
        actualChildren = replaceCodeVariables(children)
      }

      return (
        <span
          className={className}
          {...props}
        >
          {actualChildren}
        </span>
      )
    },
    sup: ({ children, ...props }) => {
      return (
        <span
          className="footnote inline-flex align-top"
          {...props}
        >
          {children}
        </span>
      )
    },
    section: ({ children, className, ...props }) => {
      if (className?.includes('footnotes')) {
        return (
          <section
            className={clsx(className, ['bg-neutral mt-[2rem] mb-[-2rem] mx-[-1rem] px-[1rem] pb-[2rem]'])}
            {...props}
          >
            {children}
          </section>
        )
      } else {
        return (
          <section {...props}>
            {children}
          </section>
        )
      }
    }
  }
}
