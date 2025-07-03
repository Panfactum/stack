// This file provides the dedent utility function for removing common leading indentation
// from multi-line strings while preserving formatting structure

// Pre-compiled regex patterns for better performance
const LIST_ITEM_PATTERN = /^\s*[*\-+]\s/;
const INDENTATION_PATTERN = /^(\s*)/;
const NON_EMPTY_PATTERN = /\S/;
const ROOT_LIST_PATTERN = /^[*\-+]\s/;
const LOWERCASE_START_PATTERN = /^[a-z]/;

/**
 * Removes common leading indentation from multi-line strings
 * 
 * @remarks
 * This function allows using multiline JS template strings with proper
 * indentation in the source code while producing clean output. It:
 * - Removes common leading whitespace from all lines
 * - Trims surrounding newlines
 * - Joins single-newline separated lines into one line, except:
 *   - Before lines starting with list markers (* - +)
 *   - After lines starting with list markers when followed by text
 * - Preserves double newlines as paragraph breaks
 * 
 * @param text - The multi-line string to dedent
 * @returns The dedented string
 * 
 * @example
 * ```typescript
 * const result = dedent(`
 *   This is a multi-line string
 *   with proper indentation
 *   that will be dedented
 * `);
 * // Returns: "This is a multi-line string with proper indentation that will be dedented"
 * ```
 * 
 * @example
 * ```typescript
 * const result = dedent(`
 *   First paragraph
 *   continues here
 * 
 *   Second paragraph
 *   after double newline
 * `);
 * // Returns: "First paragraph continues here\n\nSecond paragraph after double newline"
 * ```
 * 
 * @example
 * ```typescript
 * const result = dedent(`
 *   Introduction text
 *   
 *   * List item one
 *     continues here
 *   
 *   * List item two
 * `);
 * // Returns: "Introduction text\n\n* List item one continues here\n\n* List item two"
 * ```
 */
export function dedent(text: string): string {
  // Early exit for empty strings
  if (!text || text.trim() === '') {
    return '';
  }

  const lines = text.split('\n');
  
  // Find minimum indentation in a single pass
  let minIndent = Number.MAX_VALUE;
  let hasNonEmptyLines = false;
  
  for (const line of lines) {
    if (NON_EMPTY_PATTERN.test(line)) {
      hasNonEmptyLines = true;
      const indent = line.length - line.trimStart().length;
      if (indent < minIndent) {
        minIndent = indent;
      }
    }
  }
  
  // Early exit if no non-empty lines
  if (!hasNonEmptyLines) {
    return '';
  }

  // Dedent and trim in a single pass
  const dedentedLines: string[] = [];
  for (const line of lines) {
    dedentedLines.push(line.slice(minIndent).trimEnd());
  }

  // Remove surrounding newlines
  let startIdx = 0;
  let endIdx = dedentedLines.length - 1;
  
  while (startIdx < dedentedLines.length && dedentedLines[startIdx] === '') {
    startIdx++;
  }
  
  while (endIdx > startIdx && dedentedLines[endIdx] === '') {
    endIdx--;
  }
  
  // Early exit for single line
  if (startIdx === endIdx) {
    return dedentedLines[startIdx] || '';
  }
  
  // Process paragraphs with optimized logic
  const paragraphs: string[][] = [];
  let currentParagraph: string[] = [];
  let inListContext = false;
  
  for (let i = startIdx; i <= endIdx; i++) {
    const line = dedentedLines[i];
    if (line === undefined) continue;
    const isListItem = LIST_ITEM_PATTERN.test(line);
    const isIndented = line.startsWith('  ');
    const isEmpty = line === '';
    
    if (isListItem) {
      inListContext = true;
    }
    
    // Check if we should start a new paragraph
    if (isEmpty && !inListContext && currentParagraph.length > 0) {
      paragraphs.push(currentParagraph);
      currentParagraph = [];
      // Skip consecutive empty lines
      while (i + 1 <= endIdx && dedentedLines[i + 1] === '') {
        i++;
      }
    } else if (!isEmpty && !isListItem && !isIndented && inListContext && currentParagraph.length > 0) {
      paragraphs.push(currentParagraph);
      currentParagraph = [line];
      inListContext = false;
    } else if (line !== undefined) {
      currentParagraph.push(line);
    }
  }
  
  // Don't forget the last paragraph
  if (currentParagraph.length > 0) {
    paragraphs.push(currentParagraph);
  }

  // Process each paragraph
  const processedParagraphs: string[] = [];
  
  for (const paragraphLines of paragraphs) {
    // Check if this paragraph contains any list items
    const hasListItems = paragraphLines.some(line => LIST_ITEM_PATTERN.test(line));

    if (hasListItems) {
      processedParagraphs.push(processListParagraph(paragraphLines));
    } else {
      // For non-list paragraphs, simply join all lines with spaces
      processedParagraphs.push(paragraphLines.join(' '));
    }
  }

  // Join paragraphs with double newlines
  return processedParagraphs.join('\n\n');
}

/**
 * Process a paragraph containing list items
 * @internal
 */
function processListParagraph(paragraphLines: string[]): string {
  // Check if we need to add base indentation for readability
  const hasRootListItems = paragraphLines.some(line => ROOT_LIST_PATTERN.test(line));
  
  // Build a map of original list item indentation levels
  const originalListItemLevels = new Set<number>();
  for (const line of paragraphLines) {
    if (line && LIST_ITEM_PATTERN.test(line)) {
      const match = INDENTATION_PATTERN.exec(line);
      originalListItemLevels.add(match?.[1]?.length || 0);
    }
  }
  
  // Add base indentation if needed
  const indentedParagraphLines = hasRootListItems 
    ? paragraphLines.map(line => line.length > 0 ? '  ' + line : line)
    : paragraphLines;
  
  // Process list with array builder for better performance
  const resultParts: string[] = [];
  let i = 0;
  let previousWasListItem = false;
  
  while (i < indentedParagraphLines.length) {
    const line = indentedParagraphLines[i];
    if (line === undefined) {
      i++;
      continue;
    }
    
    // Skip leading empty lines
    if (line === '' && resultParts.length === 0) {
      i++;
      continue;
    }
    
    const isListItem = LIST_ITEM_PATTERN.test(line);
    
    // Add separator if needed
    if (isListItem && previousWasListItem && resultParts.length > 0) {
      const lastPart = resultParts[resultParts.length - 1];
      if (lastPart && !lastPart.endsWith('\n\n')) {
        resultParts.push('\n');
      }
    }
    
    if (isListItem) {
      // Process list item and its continuations
      const processed = processListItem(indentedParagraphLines, i, line);
      resultParts.push(processed.content);
      i = processed.nextIndex;
      previousWasListItem = true;
    } else {
      // Process non-list line
      const processed = processNonListLine(
        line, 
        hasRootListItems, 
        previousWasListItem, 
        originalListItemLevels,
        resultParts.length > 0
      );
      
      if (processed.needsBlankLine && resultParts.length > 0) {
        const lastPart = resultParts[resultParts.length - 1];
        if (lastPart && !lastPart.endsWith('\n\n')) {
          resultParts.push('\n');
        }
      }
      
      resultParts.push(processed.content);
      i++;
      previousWasListItem = false;
    }
    
    // Handle next line
    if (i < indentedParagraphLines.length) {
      const nextLine = indentedParagraphLines[i];
      
      if (nextLine === undefined || nextLine === '') {
        resultParts.push('\n\n');
        i++;
        // Skip additional empty lines
        while (i < indentedParagraphLines.length && (indentedParagraphLines[i] === '' || indentedParagraphLines[i] === undefined)) {
          i++;
        }
        previousWasListItem = false;
      } else {
        resultParts.push('\n');
      }
    }
  }
  
  // Join and trim
  const result = resultParts.join('');
  return result.replace(/\n+$/, '');
}

/**
 * Process a list item and its continuations
 * @internal
 */
function processListItem(
  lines: string[], 
  startIndex: number, 
  listItemLine: string
): { content: string; nextIndex: number } {
  const parts: string[] = [listItemLine];
  const currentIndentMatch = INDENTATION_PATTERN.exec(listItemLine);
  const currentIndent = currentIndentMatch?.[1]?.length || 0;
  
  let j = startIndex + 1;
  
  // Collect immediate continuation lines
  while (j < lines.length) {
    const nextLine = lines[j];
    if (nextLine === undefined) {
      j++;
      continue;
    }
    
    if (nextLine === '') {
      break;
    }
    
    const isNextListItem = LIST_ITEM_PATTERN.test(nextLine);
    const nextIndentMatch = INDENTATION_PATTERN.exec(nextLine);
    const nextIndent = nextIndentMatch?.[1]?.length || 0;
    
    if (!isNextListItem && nextIndent >= currentIndent) {
      if (nextIndent === currentIndent) {
        const trimmedNext = nextLine.trim();
        const startsWithLowercase = LOWERCASE_START_PATTERN.test(trimmedNext);
        const looksLikeContinuation = startsWithLowercase || trimmedNext.startsWith(',') || trimmedNext.startsWith('.');
        
        if (looksLikeContinuation) {
          parts.push(' ');
          parts.push(trimmedNext);
          j++;
        } else {
          break;
        }
      } else {
        parts.push(' ');
        parts.push(nextLine.trim());
        j++;
      }
    } else {
      break;
    }
  }
  
  return {
    content: parts.join(''),
    nextIndex: j
  };
}

/**
 * Process a non-list line
 * @internal
 */
function processNonListLine(
  line: string,
  hasRootListItems: boolean,
  previousWasListItem: boolean,
  originalListItemLevels: Set<number>,
  hasContent: boolean
): { content: string; needsBlankLine: boolean } {
  const lineIndentMatch = INDENTATION_PATTERN.exec(line);
  const lineIndent = lineIndentMatch?.[1]?.length || 0;
  const originalIndent = hasRootListItems ? Math.max(0, lineIndent - 2) : lineIndent;
  
  let adjustedLine = line;
  let needsBlankLine = false;
  
  if (previousWasListItem && originalListItemLevels.has(originalIndent) && line.trim() !== '') {
    adjustedLine = '  ' + line;
    needsBlankLine = hasContent;
  }
  
  return { content: adjustedLine, needsBlankLine };
}