import { HTMLElement, parse } from 'node-html-parser'

import { consts } from './const'
import type { ScrapedUrl } from '@/scrapeUrls'
import fs from 'node:fs'

interface Hierarchy {
  lvl1: string;
  lvl2: string;
  lvl3: string;
  lvl4: string;
  lvl5: string;
  lvl6: string;
}

interface Weight {
  position: number;
  level: number;
}

export interface Section {
  sectionAnchor: string;
  headingType: number;
  headingText: string;
  content: string[];
  tags: string[];
  breadCrumbs: string[];
  hierarchy: Hierarchy;
  weight: Weight;
  url: string;
  hasVersion: boolean;
  version: string | undefined;
}

type UrlContent = Omit<Section, 'version' | 'url' | 'hasVersion'>

const { tmpDir } = consts()

export function createParsedHtmlSections (urlContents: ScrapedUrl[]) {
  const result = urlContents
    .filter((url) => url.url.includes('/docs/'))
    .flatMap(parseScrapedUrl)

  if (tmpDir) {
    fs.writeFileSync(`${tmpDir}/sections.json`, JSON.stringify(result))
  }

  return result
}

export function parseScrapedUrl (scrapedUrl: ScrapedUrl): Section[] {
  const versionUrlBlacklist = ['/docs/index', '/docs/framework']
  const blacklisted = versionUrlBlacklist.some(blacklist => scrapedUrl.url.includes(blacklist))

  const version = scrapedUrl.url.includes('/docs/') && !blacklisted
    ? scrapedUrl.url.split('/docs/')[1]?.split('/')[0]
    : undefined

  const parsed = parseUrlContent(scrapedUrl.content)

  return parsed.map((section) => ({
    version,
    hasVersion: !!version,
    url: scrapedUrl.url + section.sectionAnchor,
    ...section
  }))
}

/**
 * Specific parser for Panfactum Documentation HTML for the purposes of indexing at algolia
 * Specifically this creates Sections from Headers tags and their content and hierarchy
 */
function parseUrlContent (content: string): UrlContent[] {
  const root = parse(content)

  const removeElements = [
    'script',
    'style'
  ]

  removeElements.forEach((element) => {
    root.querySelectorAll(element).forEach((el) => el.remove())
  })

  const breadCrumbs = [root.querySelector('nav [aria-label="secondary tab navigation"] a[aria-selected="true"]'), ...Array.from(root.querySelectorAll('aside .text-black'))].map(el => el?.textContent).filter(content => content !== undefined)
  const article = root.querySelector('article')

  const pageElement = article ?? root

  const sections: UrlContent[] = []
  const currentHierarchy: Hierarchy = {
    lvl1: '', lvl2: '', lvl3: '', lvl4: '', lvl5: '', lvl6: ''
  }

  const reference_tag = pageElement.querySelector('[data-reference]')?.textContent?.trim()

  let position = 0
  let currentSection: UrlContent | null = null

  pageElement.childNodes.forEach((node) => {
    if (node instanceof HTMLElement) {
      const tagName = node.tagName.toLowerCase()
      const isFootNotes = node.attributes['data-footnotes'] !== undefined

      if (tagName.startsWith('h') && tagName.length === 2) {
        if (currentSection) {
          sections.push(currentSection)
        }

        const headingNumber = parseInt(<string>tagName[1])
        const anchorElement = node.querySelector('a[id]')
        const sectionAnchor = anchorElement ? `#${anchorElement.getAttribute('id')}` : `#${node.getAttribute('id') ?? ''}`
        const headingText = node.textContent?.trim() ?? ''

        // Update the hierarchy
        currentHierarchy[`lvl${headingNumber}` as keyof Hierarchy] = headingText
        // Clear lower levels
        for (let i = headingNumber + 1; i <= 6; i++) {
          currentHierarchy[`lvl${i}` as keyof Hierarchy] = ''
        }

        // Increment position for each new section
        position++

        currentSection = {
          breadCrumbs,
          sectionAnchor,
          headingText,
          headingType: headingNumber,
          content: [],
          tags: reference_tag ? [reference_tag] : [],
          hierarchy: { ...currentHierarchy },
          weight: {
            position,
            level: 110 - (headingNumber * 10) // h1 = 100, h2 = 90, h3 = 80, etc.
          }
        }
      } else if (isFootNotes) {
        if (currentSection) {
          sections.push(currentSection)
        }

        const headingNumber = 2
        const anchorElement = node.querySelector('a[id]')
        const sectionAnchor = anchorElement ? `#${anchorElement.getAttribute('id')}` : node.getAttribute('id') ?? ''
        const headingText = 'Footnotes'

        // Update the hierarchy
        currentHierarchy[`lvl${headingNumber}` as keyof Hierarchy] = headingText
        // Clear lower levels
        for (let i = headingNumber + 1; i <= 6; i++) {
          currentHierarchy[`lvl${i}` as keyof Hierarchy] = ''
        }

        const content = Array.from(node.querySelectorAll('li')).map(li => li.textContent?.trim()).filter(content => content !== undefined)

        position++

        currentSection = {
          breadCrumbs,
          sectionAnchor,
          headingText,
          content,
          headingType: headingNumber,
          tags: [],
          hierarchy: { ...currentHierarchy },
          weight: {
            position,
            level: 0
          }
        }
      } else if (currentSection) {
        if (tagName === 'p') {
          currentSection.content.push(stripHtml(node.innerHTML))
        } else if (tagName === 'ul' || tagName === 'ol') {
          node.childNodes.forEach(child => {
            if (child instanceof HTMLElement && child.tagName.toLowerCase() === 'li') {
              currentSection?.content.push(stripHtml(child.innerHTML)
              )
            }
          })
        } else if (node.querySelector('[role="alert"]')) {
          currentSection.content.push(stripHtml(node.textContent))
        } else if (node.querySelector('[footnotes]')) {
          currentSection.content.push(stripHtml(node.textContent))
        } else if (node.querySelector('table')) {
          const records = node.querySelectorAll('table tbody tr')

          const content = Array.from(records).map(record => {
            const cells = record.querySelectorAll('td')
            return Array.from(cells).map(cell => stripHtml(cell.textContent)).join(' | ')
          })

          currentSection.content.push(...content)
        }
      }
    }
  })

  // Add the last section if it exists
  if (currentSection) {
    sections.push(currentSection)
  }

  return sections
}

function stripHtml (html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}
