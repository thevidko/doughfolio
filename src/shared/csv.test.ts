import { describe, expect, it } from "bun:test";
import { parseCsv, serializeCsv } from "./csv.ts";

describe("parseCsv", () => {
  it("parses a plain comma file with CRLF", () => {
    const table = parseCsv("a,b,c\r\n1,2,3\r\n4,5,6\r\n");
    expect(table.headers).toEqual(["a", "b", "c"]);
    expect(table.rows).toEqual([
      ["1", "2", "3"],
      ["4", "5", "6"],
    ]);
  });

  it("handles quoted fields with embedded delimiters, quotes and newlines", () => {
    const table = parseCsv('name,note\nbtc,"hello, ""world""\nsecond line"\n');
    expect(table.rows[0]?.[1]).toBe('hello, "world"\nsecond line');
  });

  it("auto-detects semicolon files (Czech exports)", () => {
    const table = parseCsv("Datum;Množství;Cena\n2026-01-01;0,5;1000000\n");
    expect(table.delimiter).toBe(";");
    expect(table.rows[0]).toEqual(["2026-01-01", "0,5", "1000000"]);
  });

  it("pads short rows and drops empty trailing lines, strips BOM", () => {
    const table = parseCsv("﻿a,b,c\n1,2\n\n");
    expect(table.headers).toEqual(["a", "b", "c"]);
    expect(table.rows).toEqual([["1", "2", ""]]);
  });
});

describe("serializeCsv", () => {
  it("round-trips through parseCsv", () => {
    const headers = ["type", "note"];
    const rows = [
      ["buy", 'has "quotes", commas'],
      ["sell", "line\nbreak"],
    ];
    const parsed = parseCsv(serializeCsv(headers, rows));
    expect(parsed.headers).toEqual(headers);
    expect(parsed.rows).toEqual(rows);
  });
});
