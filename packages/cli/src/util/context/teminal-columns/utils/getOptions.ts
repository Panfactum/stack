import type {
	Options,
	OptionsFunction,
	ColumnMetasArray,
} from '../types';

/**
 * Interface for getOptions function output
 */
interface IGetOptionsOutput {
	/** Column metadata array for terminal display */
	columns: ColumnMetasArray;
	/** Number of columns available in stdout */
	stdoutColumns: number;
}

export const getOptions = (
	options?: Options | OptionsFunction,
): IGetOptionsOutput => {
	const stdoutColumns = process.stdout.columns ?? Number.POSITIVE_INFINITY;

	if (typeof options === 'function') {
		options = options(stdoutColumns);
	}

	if (!options) {
		options = {};
	}

	if (Array.isArray(options)) {
		return {
			columns: options,
			stdoutColumns,
		};
	}

	return {
		columns: options.columns ?? [],
		stdoutColumns: options.stdoutColumns ?? stdoutColumns,
	};
};