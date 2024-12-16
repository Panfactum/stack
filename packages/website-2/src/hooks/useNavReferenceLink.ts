import {useEffect, useState} from 'react'
import {lastDocumentationPath} from "@/stores/documentation-store.ts";
import {useStore} from "@nanostores/react";

export function useLastDocumentationPath() {
    const [link, setLink] = useState<string | null>()
    const $lastDocumentationPath = useStore(lastDocumentationPath)

    useEffect(() => {
        let shouldUpdate = true

        if ($lastDocumentationPath) {
            void fetch(`/docs/${$lastDocumentationPath}`, { method: 'HEAD' })
                .then(res => res.ok)
                .catch(_ => false)
                .then(res => {
                    if (shouldUpdate && res) {
                        console.log('wtf' , res, $lastDocumentationPath)
                        setLink($lastDocumentationPath)
                    }
                })


        }

        return () => {
            shouldUpdate = false
        }
    }, [$lastDocumentationPath])

    return {
        link
    }
}