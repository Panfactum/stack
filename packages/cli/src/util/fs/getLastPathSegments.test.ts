import { test, expect } from "bun:test";
import { getLastPathSegments } from "./getLastPathSegments";

test("extracts single segment (filename)", () => {
    const result = getLastPathSegments({
        path: "/home/user/documents/report.pdf",
        lastSegments: 1
    });

    expect(result).toBe("report.pdf");
});

test("extracts multiple segments", () => {
    const result = getLastPathSegments({
        path: "/home/user/documents/report.pdf",
        lastSegments: 2
    });

    expect(result).toBe("documents/report.pdf");
});

test("extracts three segments", () => {
    const result = getLastPathSegments({
        path: "/home/user/projects/panfactum/config.yaml",
        lastSegments: 3
    });

    expect(result).toBe("projects/panfactum/config.yaml");
});

test("handles entire path when segments exceed path length", () => {
    const result = getLastPathSegments({
        path: "/short/path.txt",
        lastSegments: 5
    });

    expect(result).toBe("/short/path.txt");
});

test("handles relative paths", () => {
    const result = getLastPathSegments({
        path: "./src/utils/helper.js",
        lastSegments: 2
    });

    expect(result).toBe("utils/helper.js");
});

test("handles paths with trailing slashes", () => {
    const result = getLastPathSegments({
        path: "/home/user/documents/",
        lastSegments: 2
    });

    expect(result).toBe("documents/");
});

test("handles zero segments", () => {
    const result = getLastPathSegments({
        path: "/home/user/documents/file.txt",
        lastSegments: 0
    });

    // slice(-0) returns the entire array, so this returns the full path
    expect(result).toBe("/home/user/documents/file.txt");
});

test("handles single character segments", () => {
    const result = getLastPathSegments({
        path: "/a/b/c/d",
        lastSegments: 2
    });

    expect(result).toBe("c/d");
});

test("handles paths with spaces", () => {
    const result = getLastPathSegments({
        path: "/home/user/My Documents/important file.pdf",
        lastSegments: 2
    });

    expect(result).toBe("My Documents/important file.pdf");
});

test("handles paths with special characters", () => {
    const result = getLastPathSegments({
        path: "/home/user/files/@special-file!.txt",
        lastSegments: 1
    });

    expect(result).toBe("@special-file!.txt");
});

test("handles empty path", () => {
    const result = getLastPathSegments({
        path: "",
        lastSegments: 1
    });

    expect(result).toBe("");
});

test("handles Windows-style paths (though function expects forward slashes)", () => {
    const result = getLastPathSegments({
        path: "C:/Users/user/Documents/file.txt",
        lastSegments: 2
    });

    expect(result).toBe("Documents/file.txt");
});

test("handles single slash", () => {
    const result = getLastPathSegments({
        path: "/",
        lastSegments: 1
    });

    expect(result).toBe("");
});

test("handles path with only filename", () => {
    const result = getLastPathSegments({
        path: "filename.txt",
        lastSegments: 1
    });

    expect(result).toBe("filename.txt");
});