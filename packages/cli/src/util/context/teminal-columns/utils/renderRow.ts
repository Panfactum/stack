import stringWidth from 'string-width';

import wrapAnsi from 'wrap-ansi';
import { getLongestLineWidth } from './getLongestLineWidth';
import type { Row, InternalColumnMeta } from '../types';

const emptyLines = (length: number) => Array.from({ length }).fill('') as string[];

export const renderRow = (
    rowColumns: InternalColumnMeta<number>[][],
    rowData: Row,
) => {
    const subRows: string[] = [];

    let columnIndex = 0;
    for (const subRow of rowColumns) {
        let maxLines = 0;


        const subRowWithData = subRow.map((column) => {
            let cellText = rowData[columnIndex] ?? '';
            columnIndex += 1;

            if (column.preprocess) {
                cellText = column.preprocess(cellText);
            }

            if (getLongestLineWidth(cellText) > column.width) {
                cellText = wrapAnsi(cellText, column.width, {
                    hard: false,
                    trim: false
                });
            }

            let lines = cellText.split('\n');

            if (column.postprocess) {
                const { postprocess } = column;
                lines = lines.map(
                    (line, lineNumber) => postprocess.call(column, line, lineNumber),
                );
            }

            if (column.paddingTop) {
                lines.unshift(...emptyLines(column.paddingTop));
            }

            if (column.paddingBottom) {
                lines.push(...emptyLines(column.paddingBottom));
            }

            if (lines[0] === "") {
                lines = lines.slice(1)
            }

            if (lines.length > maxLines) {
                maxLines = lines.length;
            }

            return {
                ...column,
                lines,
            };
        });

        const rowLines: string[] = [];
        for (let i = 0; i < maxLines; i += 1) {
            const rowLine = subRowWithData
                .map((column) => {
                    const cellLine = column.lines[i] ?? '';

                    const lineFiller = Number.isFinite(column.width) ? ' '.repeat(Math.max(column.width - stringWidth(cellLine), 0)) : '';
                    let text = column.paddingLeftString;

                    if (column.align === 'right') {
                        text += lineFiller;
                    }

                    text += cellLine;

                    if (column.align === 'left') {
                        text += lineFiller;
                    }

                    return text + column.paddingRightString;
                })
                .join('');

            rowLines.push(rowLine);
        }

        subRows.push(rowLines.join('\n'));
    }

    return subRows.join('\n');
};