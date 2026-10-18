import { describe, expect, it } from "vitest";
import {
  getDirectoryURL,
  isDefined,
  isDefinedAndHasContent,
  isUndefinedOrWhitespaceOrEmpty,
  isUrl,
  isWhitespaceOrEmpty,
} from "../src/util/ObjectUtils";

describe("ObjectUtils", () => {
  describe("isDefined", () => {
    it("should return true for defined values", () => {
      expect(isDefined("test")).toBe(true);
      expect(isDefined(123)).toBe(true);
      expect(isDefined({})).toBe(true);
      expect(isDefined([])).toBe(true);
    });
    it("should return false for undefined or null values", () => {
      expect(isDefined(undefined)).toBe(false);
      expect(isDefined(null)).toBe(false);
    });
  });

  describe("isWhitespaceOrEmpty", () => {
    it("should return true for empty or whitespace strings", () => {
      expect(isWhitespaceOrEmpty("")).toBe(true);
      expect(isWhitespaceOrEmpty("   ")).toBe(true);
      expect(isWhitespaceOrEmpty("\n\t")).toBe(true);
    });
    it("should return false for non-empty strings", () => {
      expect(isWhitespaceOrEmpty("test")).toBe(false);
      expect(isWhitespaceOrEmpty("  test  ")).toBe(false);
    });
  });

  describe("isUndefinedOrWhitespaceOrEmpty", () => {
    it("should return true for undefined, null, empty or whitespace strings", () => {
      expect(isUndefinedOrWhitespaceOrEmpty(undefined)).toBe(true);
      expect(isUndefinedOrWhitespaceOrEmpty(null)).toBe(true);
      expect(isUndefinedOrWhitespaceOrEmpty("")).toBe(true);
      expect(isUndefinedOrWhitespaceOrEmpty("   ")).toBe(true);
    });
    it("should return false for non-empty strings", () => {
      expect(isUndefinedOrWhitespaceOrEmpty("test")).toBe(false);
      expect(isUndefinedOrWhitespaceOrEmpty("  test  ")).toBe(false);
    });
  });

  describe("isDefinedAndHasContent", () => {
    it("should return true for defined, non-empty, non-whitespace strings", () => {
      expect(isDefinedAndHasContent("test")).toBe(true);
      expect(isDefinedAndHasContent("  test  ")).toBe(true);
    });
    it("should return false for undefined, null, empty or whitespace strings", () => {
      expect(isDefinedAndHasContent(undefined)).toBe(false);
      expect(isDefinedAndHasContent(null)).toBe(false);
      expect(isDefinedAndHasContent("")).toBe(false);
      expect(isDefinedAndHasContent("   ")).toBe(false);
    });
  });

  describe("isUrl", () => {
    it("should return true for valid protocols", () => {
      expect(isUrl("http://example.com")).toBe(true);
      expect(isUrl("https://example.com")).toBe(true);
    });
    it("should return false for invalid or absent protocols", () => {
      expect(isUrl("ftp://example.com")).toBe(false);
      expect(isUrl("not-a-url")).toBe(false);
      expect(isUrl("")).toBe(false);
      expect(isUrl("   ")).toBe(false);
      expect(isUrl(undefined)).toBe(false);
      expect(isUrl(null)).toBe(false);
    });
  });

  describe("getDirectoryURL", () => {
    it("should return the directory URL of a given file URL", () => {
      const fileURL = new URL("http://example.com/path/to/file.txt");
      const dirURL = getDirectoryURL(fileURL);
      expect(dirURL.toString()).toBe("http://example.com/path/to/");
    });
    it("should handle root directory correctly", () => {
      const fileURL = new URL("http://example.com/file.txt");
      const dirURL = getDirectoryURL(fileURL);
      expect(dirURL.toString()).toBe("http://example.com/");
    });
    it("should handle URLs with no path correctly", () => {
      const fileURL = new URL("http://example.com");
      const dirURL = getDirectoryURL(fileURL);
      expect(dirURL.toString()).toBe("http://example.com/");
    });
    it("should handle non-file URLs correctly", () => {
      const fileURL = new URL("http://example.com/path/to/resource/");
      const dirURL = getDirectoryURL(fileURL);
      expect(dirURL.toString()).toBe("http://example.com/path/to/resource/");
    });
  });
});
