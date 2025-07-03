// This file contains unit tests for the dedent utility function
// It verifies text dedentation functionality and edge cases

import { describe, test, expect } from "bun:test";
import { dedent } from "./dedent";

describe("dedent", () => {
  test("removes common leading indentation from multi-line strings", () => {
    const input = `
      This is a test
      with multiple lines
      and consistent indentation
    `;

    const result = dedent(input);

    expect(result).toMatchInlineSnapshot(`"This is a test with multiple lines and consistent indentation"`);
  });

  test("preserves double newlines as paragraph breaks", () => {
    const input = `
      First paragraph
      continues here

      Second paragraph
      after double newline
    `;

    const result = dedent(input);

    expect(result).toMatchInlineSnapshot(`
      "First paragraph continues here

      Second paragraph after double newline"
    `);
  });

  test("handles empty string", () => {
    const result = dedent("");

    expect(result).toMatchInlineSnapshot(`""`);
  });

  test("handles single line string", () => {
    const input = "    Single line with indentation    ";

    const result = dedent(input);

    expect(result).toMatchInlineSnapshot(`"Single line with indentation"`);
  });

  test("handles string with no indentation", () => {
    const input = `First line
Second line
Third line`;

    const result = dedent(input);

    expect(result).toMatchInlineSnapshot(`"First line Second line Third line"`);
  });

  test("handles mixed indentation levels", () => {
    const input = `
      First level
        Second level
      Back to first
    `;

    const result = dedent(input);

    expect(result).toMatchInlineSnapshot(`"First level   Second level Back to first"`);
  });

  test("handles lines with only whitespace", () => {
    const input = `
      Content line
      
      Another content line
    `;

    const result = dedent(input);

    expect(result).toMatchInlineSnapshot(`
      "Content line

      Another content line"
    `);
  });

  test("handles tabs and spaces mixed", () => {
    const input = `
\t\tTab indented
    Space indented
\t\tMore tabs
    `;

    const result = dedent(input);

    expect(result).toMatchInlineSnapshot(`"Tab indented   Space indented More tabs"`);
  });

  test("preserves trailing spaces within content", () => {
    const input = `
      Line with trailing spaces   
      Another line  
    `;

    const result = dedent(input);

    expect(result).toMatchInlineSnapshot(`"Line with trailing spaces Another line"`);
  });

  test("handles string with only newlines and whitespace", () => {
    const input = `
      
      
    `;

    const result = dedent(input);

    expect(result).toMatchInlineSnapshot(`""`);
  });

  test("handles template literal usage pattern", () => {
    const input = `
      This is how dedent is typically used
      in template literals where you want
      clean output without source indentation
    `;

    const result = dedent(input);

    expect(result).toMatchInlineSnapshot(`"This is how dedent is typically used in template literals where you want clean output without source indentation"`);
  });

  test("handles lists", () => {
    const input = `
      This is how dedent is typically used
      in template literals where you want
      
      * Hey
        I am a list

        No really

      * Hey2

        * I am a sublist. A
        very good sublist.
        * Yes, I am a very good
          sublist

      * Hey3

      Now I am done with my list.

        * Hey4
          I am a list
        No really

        * Hey5

          * I am a sublist. A
          very good sublist.

          * Yes, I am a very good
            sublist

        * Hey6
    `;

    const result = dedent(input);

    expect(result).toMatchInlineSnapshot(`
      "This is how dedent is typically used in template literals where you want
      
        * Hey I am a list

          No really

        * Hey2

          * I am a sublist. A very good sublist.

          * Yes, I am a very good sublist

        * Hey3

      Now I am done with my list.
      
        * Hey4 I am a list

          No really

        * Hey5

          * I am a sublist. A very good sublist.

          * Yes, I am a very good sublist

        * Hey6"
    `);
  });


  test("handles second paragraph indented", () => {
    const input = `
      First paragraph
      
        Second paragraph

      Third paragraph
    `;

    const result = dedent(input);

    expect(result).toMatchInlineSnapshot(`
      "First paragraph
      
        Second paragraph

      Third paragraph"
    `);
  });

  test("performs well with very large strings", () => {
    // Generate a very large string with various patterns
    const sections: string[] = [];
    
    // Add regular paragraphs
    for (let i = 0; i < 50; i++) {
      sections.push(`
        This is paragraph ${i} with some text that spans
        multiple lines and needs to be dedented properly
        to ensure the function works well at scale.
      `);
    }
    
    // Add large lists
    for (let i = 0; i < 30; i++) {
      sections.push(`
        * List section ${i}
          with multiple continuation lines
          that need to be properly formatted
          
          * Nested item ${i}.1
            with its own content
            
          * Nested item ${i}.2
            and more content here
      `);
    }
    
    // Add mixed content
    for (let i = 0; i < 20; i++) {
      sections.push(`
        Mixed content section ${i}
        
        * A list item
          with continuation
          
        Regular text after list
        
        * Another list item
        
        More regular text
      `);
    }
    
    const largeInput = sections.join('\n\n');
    
    // Measure performance
    const iterations = 10;
    const startTime = Bun.nanoseconds();
    
    let result = '';
    for (let i = 0; i < iterations; i++) {
      result = dedent(largeInput);
    }
    
    const totalTime = (Bun.nanoseconds() - startTime) / 1_000_000; // Convert to ms
    const avgTime = totalTime / iterations;
    
    // Performance assertions
    expect(avgTime).toBeLessThan(50); // Should process in under 50ms average
    
    // Verify correctness on large input
    expect(result).toContain('This is paragraph 0');
    expect(result).toContain('List section 0');
    expect(result).toContain('Mixed content section 0');
    
    // Check that the output is properly formatted
    const lines = result.split('\n');
    expect(lines.length).toBeGreaterThan(100); // Should have many lines
    
    // Verify list formatting is preserved - lists should be indented with 2 spaces
    expect(result).toMatch(/^\s{2}\* List section \d+/m);
    // Nested lists should have 4 spaces (2 base + 2 for nesting)
    expect(result).toMatch(/^\s{4}\* Nested item/m);
    
    // Verify no paragraph has excessive indentation (more than 4 spaces at start)
    const nonListParagraphs = result.split('\n\n').filter(p => !p.includes('*'));
    nonListParagraphs.forEach(paragraph => {
      const firstLine = paragraph.split('\n')[0];
      if (firstLine) {
        const leadingSpaces = firstLine.match(/^(\s*)/)?.[1]?.length || 0;
        expect(leadingSpaces).toBeLessThan(4);
      }
    });
  });
});