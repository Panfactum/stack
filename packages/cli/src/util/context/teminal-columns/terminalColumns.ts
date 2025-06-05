import { CLIError } from '@/util/error/error';
import { computeColumnWidths } from './utils/computeColumnWidths';
import { getColumnContentWidths } from './utils/getColumnContentWidth';
import { getOptions } from './utils/getOptions';
import { renderRow } from './utils/renderRow';
import type {
    Row,
    Options,
    OptionsFunction,
} from './types';

export const terminalColumns = (
    tableData: Row[],
    options?: Options | OptionsFunction,
) => {
    if (!tableData || tableData.length === 0) {
        return '';
    }

    const columnContentWidths = getColumnContentWidths(tableData);
    const columnCount = columnContentWidths.length;
    if (columnCount === 0) {
        return '';
    }

    const { stdoutColumns, columns } = getOptions(options);

    if (columns.length > columnCount) {
        throw new CLIError(`${columns.length} columns defined, but only ${columnCount} columns found`);
    }

    const computedColumns = computeColumnWidths(
        stdoutColumns,
        columns,
        columnContentWidths,
    );

    return tableData
        .map(
            row => renderRow(
                computedColumns,
                row,
            ),
        )
        .join('\n');
};