import matter from 'gray-matter';
import { valueToEstree } from 'estree-util-value-to-estree'

export default () => (tree, file) => {

    // Parse the frontmatter
    const { frontmatter } = matter(file.value)

    //  Remove frontmatter after converting it into JS object
    if(tree.children[0].type === 'thematicBreak') {
        const firstHeadingIndex = tree.children.findIndex(t => t.type === 'heading')
        if (firstHeadingIndex !== -1) {
            tree.children.splice(0, firstHeadingIndex + 1)
        }
    }

    // Extract a page title
    const titleNode = tree.children.find(t => t.type === 'heading' && t.depth === 1)
    const title = titleNode ? titleNode.children[0].value : undefined

    // // Step 3: Insert JSX to pass frontmatter to parent component
    // tree.children.unshift({
    //     type: 'import',
    //     value: `
    //   import Documentation from '../files/documentation'
    // `
    // },{
    //     type: 'jsx',
    //     value: `
    // <Documentation
    //   title={frontMatter.title}
    //   author={frontMatter.author}
    //   lastUpdated={frontMatter.lastUpdated}
    // >
    //
    // `
    // })
    //
    // // Step 4: Close JSX parent component
    // tree.children.push({
    //     type: 'jsx',
    //     value: `
    //
    // </Documentation>
    // `
    // })

    // This exports a metadata object that nextjs
    // will use to add page metadata such as the title
    // for SEO purposes
    tree.children.unshift({
        type: 'mdxjsEsm',
        value: '',
        data: {
            estree: {
                type: 'Program',
                sourceType: 'module',
                body: [
                    {
                        type: 'ExportNamedDeclaration',
                        specifiers: [],
                        declaration: {
                            type: 'VariableDeclaration',
                            kind: 'const',
                            declarations: [
                                {
                                    type: 'VariableDeclarator',
                                    id: { type: 'Identifier', name: 'metadata' },
                                    init: valueToEstree({
                                        title,
                                        ...frontmatter
                                    })
                                }
                            ]
                        }
                    }
                ]
            }
        }
    })
}