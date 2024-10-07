'use client'

import Image from 'next/image'
import Link from 'next/link'
import type { ChangeEvent } from 'react'
import { useCallback, useContext, useEffect, useState } from 'react'
import { useDebounceValue } from 'usehooks-ts'

import searchResetImg from '@/app/search-reset.svg'
import searchImg from '@/app/search.svg'
import { algoliaClient } from '@/lib/algolia-client'
import { algoliaEnv } from '@/lib/constants'
import { DocsVersionContext } from '@/lib/contexts/web/DocsVersion'

interface Snippet {
  value: string;
  matchLevel: string;
}

interface HitInterface {
  objectID: string;
  breadCrumbs: string[];
  headingText: string;
  content: string[];
  hierarchy: {
    lvl0: string;
    lvl1: string;
    lvl2: string;
    lvl3: string;
    lvl4: string;
  }
  url: string;
  _snippetResult: {
    content: Snippet[];
  };
  _highlightResult: {
    headingText: Snippet;
  };
}

interface SearchResponse {
  hits: HitInterface[];
}

const { ALGOLIA_APP_ID, ALGOLIA_SEARCH_API_KEY, ALGOLIA_INDEX_NAME } = algoliaEnv()

const client = algoliaClient(ALGOLIA_APP_ID, ALGOLIA_SEARCH_API_KEY)

type ClickedCallback = () => void;

export default function Search ({ clicked }: { clicked: ClickedCallback }) {
  const { version } = useContext(DocsVersionContext)
  const [inputValue, setInputValue] = useState('')
  const [debouncedInputValue] = useDebounceValue(inputValue, 250)
  const [hits, setHits] = useState<HitInterface[]>([])

  const searchQuery = useCallback(async (query: string) => {
    if (!query) {
      setHits([])
      return
    }

    const response = await client.post<SearchResponse>(`/1/indexes/${ALGOLIA_INDEX_NAME}/query`, {
      query,
      hitsPerPage: 5,
      attributesToSnippet: ['hierarchy.lvl1:5', 'content:20'],
      filters: `version:${version} OR hasVersion:false`,
      highlightPostTag: '</mark>',
      highlightPreTag: '<mark>'
    })

    setHits(response.hits)
  }, [version])

  useEffect(() => {
    searchQuery(debouncedInputValue).catch(console.error)
  }, [debouncedInputValue, searchQuery])

  const handleInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
  }, [])

  const handleClear = useCallback(() => {
    setInputValue('')
  }, [])

  const autoFocus = useCallback((inputElement: HTMLInputElement | null) => {
    if (inputElement) {
      inputElement.focus()
    }
  }, [])

  const selectDefaultSnippet = (snippets: Snippet[]) => {
    return snippets.find(c => c.matchLevel === 'full')?.value ||
      snippets.find(c => c.matchLevel === 'partial')?.value ||
      snippets[0]?.value || ''
  }

  const crumbs = (crumbs: string[]) => crumbs.join(' > ')

  const createHierarchy = (hierarchy: HitInterface['hierarchy']) => {
    // filter out the last index as that is the current page
    return Object.values(hierarchy).filter(Boolean).slice(0, -1).join(' > ')
  }

  return (
    <div
      className={'sm:absolute sm:top-16 sm:left-1/2 sm:-translate-x-1/2 sm:w-3/4 md:w-3/5 lg:w-1/2 h-fit z-[51] overflow-y-hidden'}
    >
      <div
        className="relative flex items-center w-full h-12 rounded-md focus-within:shadow-lg bg-white overflow-hidden"
      >
        <div className="grid place-items-center h-full w-12 text-gray-300">
          <Image
            height={24}
            width={24}
            src={searchImg as string}
            alt={'Join the discord server'}
            className="h-[16px] sm:h-[16px] w-[16px] sm:w-[16px]"
          />
        </div>

        <input
          ref={autoFocus}
          className="peer h-full w-full outline-none text-sm text-gray-700 pr-8"
          type="text"
          id="search"
          placeholder="Search Panfactum Docs ..."
          value={inputValue}
          autoComplete="off"
          onChange={handleInputChange}
        />

        {inputValue && (
          <button
            className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-white hover:bg-gray-dark rounded-full"
            onClick={handleClear}
          >
            <Image
              height={20}
              width={20}
              src={searchResetImg as string}
              alt={'Clear search'}

            />
          </button>
        )}

      </div>

      <div className={'bg-white rounded-sm px-8 py-4 mt-4 flex flex-col divide-dashed divide-y'}>
        {hits.map((hit) => (
          <Link
            key={hit.objectID}
            href={hit.url}
            onClick={clicked}
            className=" cursor-pointer text-black pt-4 pb-4"
          >
            <h4>
              {createHierarchy(hit.hierarchy)}
            </h4>
            <h2 dangerouslySetInnerHTML={{ __html: hit._highlightResult?.headingText?.value }} />

            <p
              dangerouslySetInnerHTML={{ __html: selectDefaultSnippet(hit._snippetResult?.content ?? []) }}
            />
            <h5>
              {crumbs(hit.breadCrumbs)}
            </h5>
          </Link>
        ))}

        {hits.length === 0 && (<h2>No Results</h2>)}
      </div>
    </div>
  )
}
