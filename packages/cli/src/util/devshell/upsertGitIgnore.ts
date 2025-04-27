import { CLIError } from "../error/error";
import { fileExists } from "../fs/fileExists";
import { writeFile } from "../fs/writeFile";
import type { PanfactumContext } from "@/context/context";

/**
 * Updates a .gitignore file by adding the specified lines.
 * Creates the file if it doesn't exist and ensures there are no duplicate lines.
 * @param inputs - Object containing context, path to the .gitignore file, and lines to add
 */
export async function upsertGitIgnore(inputs: { context: PanfactumContext, lines: string[], path: string }) {
    const { context, lines, path } = inputs;

    let existingLines: string[] = [];

    // Check if the file exists and read it if it does
    if (await fileExists(path)) {
        const fileContent = await Bun.file(path).text();
        existingLines = fileContent.split('\n').map(line => line.trim()).filter(line => line !== '');
    }

    // Create a set of existing lines for quick lookup
    const existingLinesSet = new Set(existingLines);

    // Filter out lines that already exist
    const linesToAdd = lines.filter(line => !existingLinesSet.has(line));

    if (linesToAdd.length === 0) {
        context.logger.debug('No new lines to add to .gitignore file', { path });
        return;
    }

    // Create the new content by combining existing lines and new lines
    const allLines = [...existingLines, ...linesToAdd];
    const newContent = allLines.join('\n') + '\n';

    // Write the file
    context.logger.debug('Updating .gitignore file', { linesToAdd, path });
    
    try {
        await writeFile({
            contents: newContent,
            context,
            overwrite: true,
            path
        });
    } catch (e) {
        throw new CLIError("Failed to update .gitignore", e)
    }

    context.logger.debug('Updated .gitignore file', { path });
}