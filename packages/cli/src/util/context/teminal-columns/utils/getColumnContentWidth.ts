import { getLongestLineWidth } from './getLongestLineWidth';
import type { Row } from '../types';

export const getColumnContentWidths = (
    tableData: Row[],
) => {
    const columnContentWidths: number[] = [];

    for (const row of tableData) {
        const { length: rowLength } = row;
        const addColumns = rowLength - columnContentWidths.length;
        for (let i = 0; i < addColumns; i += 1) {
            columnContentWidths.push(0);
        }

        // Get column content width based on all rows
        for (let i = 0; i < rowLength; i += 1) {
            const width = getLongestLineWidth(row[i] ?? "");
            if (width > (columnContentWidths[i] ?? 80)) {
                columnContentWidths[i] = width;
            }
        }
    }

    return columnContentWidths;
};