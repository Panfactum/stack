// Converts a changelog URL param (release tag) to a display name.
// Release tags are identifiers and should be displayed as-is.

export function getNameFromId(id: string): string {
    if (id.startsWith('main')) {
        return 'Upcoming';
    }
    return id;
}
