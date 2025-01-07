'use client'

/*import Image from "next/image";
import Link from "next/link";*/
import { faMagnifyingGlass, faXmark } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useStore } from '@nanostores/react'
import type { ChangeEvent } from 'react'
import { useCallback, useContext, useEffect, useState } from 'react'
import { useDebounceValue } from 'usehooks-ts'

/*import searchResetImg from "@/app/search-reset.svg";
import searchImg from "@/app/search.svg";*/
import { algoliaClient } from '@/lib/algolia-client.ts'
import { algoliaEnv } from '@/lib/constants.ts'
import { documentationStore } from '@/stores/documentation-store.ts'

// import { DocsVersionContext } from "@/lib/contexts/web/DocsVersion";

interface Snippet {
  value: string
  matchLevel: string
}

interface HitInterface {
  objectID: string
  breadCrumbs: string[]
  headingText: string
  content: string[]
  hierarchy: {
    lvl0: string
    lvl1: string
    lvl2: string
    lvl3: string
    lvl4: string
  }
  url: string
  _snippetResult: {
    content: Snippet[]
  }
  _highlightResult: {
    headingText: Snippet
  }
}

interface SearchResponse {
  hits: HitInterface[]
}

const { ALGOLIA_APP_ID, ALGOLIA_SEARCH_API_KEY, ALGOLIA_INDEX_NAME } =
  algoliaEnv()

const client = algoliaClient(ALGOLIA_APP_ID, ALGOLIA_SEARCH_API_KEY)

type ClickedCallback = () => void

export default function Search({ clicked }: { clicked: ClickedCallback }) {
  const $docStore = useStore(documentationStore)
  const [inputValue, setInputValue] = useState('')
  const [debouncedInputValue] = useDebounceValue(inputValue, 250)
  const [hits, setHits] = useState<HitInterface[]>([])

  const version = $docStore.version

  const searchQuery = useCallback(
    async (query: string) => {
      if (!query) {
        setHits([])
        return
      }

      const response = await client.post<SearchResponse>(
        `/1/indexes/${ALGOLIA_INDEX_NAME}/query`,
        {
          query,
          hitsPerPage: 5,
          attributesToSnippet: ['hierarchy.lvl1:5', 'content:20'],
          filters: `version:${version} OR hasVersion:false`,
          highlightPostTag: '</mark>',
          highlightPreTag: '<mark>',
        },
      )

      setHits(response.hits)
    },
    [version],
  )

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
    return (
      snippets.find((c) => c.matchLevel === 'full')?.value ||
      snippets.find((c) => c.matchLevel === 'partial')?.value ||
      snippets[0]?.value ||
      ''
    )
  }

  const crumbs = (crumbs: string[]) => {
    const joinedCrumbs = crumbs.map((crumb, index) => {
      const crumbsLength = crumbs.length;
      if (index === crumbsLength - 1) {
        return <span className="text-primary font-bold">{crumb}</span>;
      }
      return <span>{crumb}{` > `}</span>;
    });
    return joinedCrumbs;
  }

  const createHierarchy = (hierarchy: HitInterface['hierarchy']) => {
    // filter out the last index as that is the current page
    return Object.values(hierarchy).filter(Boolean).slice(0, -1).join(' > ')
  }

  return (
    <div
      className={
        'fixed top-0 left-0 w-full sm:absolute sm:top-16 sm:left-1/2 sm:-translate-x-1/2 sm:w-3/4 md:w-3/5 lg:w-1/2 h-fit z-[51] overflow-y-hidden'
      }
    >
      <div className="relative flex items-center w-full h-12 rounded-md focus-within:shadow-lg bg-[#1f2428] overflow-hidden">
        <div className="grid place-items-center h-full w-12 text-gray-300">
          <FontAwesomeIcon icon={faMagnifyingGlass} />
        </div>

        <input
          ref={autoFocus}
          className="peer h-full w-full outline-none bg-[#1f2428] text-sm text-gray-700 pr-8"
          type="text"
          id="search"
          placeholder="Search Panfactum Docs ..."
          value={inputValue}
          autoComplete="off"
          onChange={handleInputChange}
        />

        {inputValue && (
          <button
            className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-[#1f2428] hover:bg-gray-dark rounded-full"
            onClick={handleClear}
          >
            <FontAwesomeIcon icon={faXmark} />
          </button>
        )}
      </div>

      <div
        className={
          'bg-[#1f2428] rounded-sm px-8 py-4 mt-4 flex flex-col'
        }
      >
        {hits.map((hit) => (
          <a
            key={hit.objectID}
            href={hit.url}
            onClick={clicked}
            className=" cursor-pointer text-primary pt-4 pb-4"
          >
            <h4 className="text-md font-bold">{createHierarchy(hit.hierarchy)}</h4>
            <h2
              className="text-md font-bold mb-3"
              dangerouslySetInnerHTML={{
                __html: hit._highlightResult?.headingText?.value,
              }}
            />

            <p
              className="text-sm mb-3"
              dangerouslySetInnerHTML={{
                __html: selectDefaultSnippet(hit._snippetResult?.content ?? []),
              }}
            />
            <h5 className="text-xs">{crumbs(hit.breadCrumbs)}</h5>
          </a>
        ))}

        {hits.length === 0 && <h2>No Results</h2>}
      </div>
    </div>
  )
}
