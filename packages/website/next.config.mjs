import remarkGfm from 'remark-gfm'
import remarkPrism from 'remark-prism'
import remarkMath from 'remark-math';
import createMDX from '@next/mdx'
import createBundleAnalyzer from '@next/bundle-analyzer'
import rehypeKatex from "rehype-katex";

const withBundleAnalyzer = createBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})
const withMDX = createMDX({
  // Add markdown plugins here, as desired
  options: {
    remarkPlugins: [remarkGfm, [remarkPrism, {transformInlineCode: false}], remarkMath],
    rehypePlugins: [rehypeKatex],
  },
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.NODE_ENV === 'production' ? 'standalone' : undefined, // https://nextjs.org/docs/app/api-reference/next-config-js/output#automatically-copying-traced-files
  pageExtensions: ['js', 'jsx', 'mdx', 'ts', 'tsx'],
  distDir: process.env.LINT === "true" ? '.lint' : 'build',
}

export default withBundleAnalyzer(withMDX(nextConfig))
