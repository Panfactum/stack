# Edge Changelog Pagination

This implementation groups edge changelog entries into pages of two entries per page.

## How it works

1. **Content Collections Configuration**: In `src/content.config.ts`, we define an `edgeChanges` collection that uses the standard glob loader to collect all edge changelog entries.

2. **Pagination Utility**: In `src/utils/changelogPagination.ts`, we've created a utility function that:
   - Takes an array of changelog entries
   - Sorts them by date (extracted from the filename)
   - Groups them into pages of two entries per page
   - Returns an array of page objects, each containing up to two entries

3. **Dynamic Routes**: In `src/pages/changelog/[page].astro`, we use Astro's dynamic routing to:
   - Generate a route for each page using `getStaticPaths()`
   - Display the entries for the current page
   - Provide pagination links to navigate between pages

4. **Index Redirect**: In `src/pages/changelog/index.astro`, we redirect from `/changelog` to `/changelog/0` to ensure users start at the first page.

## Usage

To view the paginated changelog, visit:
- `/changelog` (redirects to first page)
- `/changelog/0` (first page)
- `/changelog/1` (second page)
- etc.

## Customization

You can customize:
- The number of entries per page by modifying the `paginateChangelog` function
- The layout and styling in the page template
- The sorting order by changing the comparison function in the sort operation 