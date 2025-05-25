export function getNameFromId(id: string): string {
    if (id.startsWith('main')) {
        return 'Unreleased';
    }

    const match = id.match(/\d/);
    if (!match) return id;

    const index = match.index;
    let result = id.slice(0, index) + '.' + id.slice(index);

    // Add additional dot after second number in sequences of 3+ numbers
    const numberSequence = result.match(/\d{3,}/);
    if (numberSequence) {
        const seqIndex = numberSequence.index;
        if (seqIndex) {
            result = result.slice(0, seqIndex + 2) + '.' + result.slice(seqIndex + 2);
        }
    }

    return result;
}
