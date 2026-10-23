import * as XLSX from "xlsx";
import {
  SALES_CSV_HEADERS,
  type SalesCsvRow,
} from "./csv.parser";

export class ExcelParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExcelParseError";
  }
}

function hasExcelSignature(buffer: Buffer, extension: string): boolean {
  if (extension === ".xlsx") {
    return (
      buffer.length >= 4 &&
      buffer[0] === 0x50 &&
      buffer[1] === 0x4b &&
      [0x03, 0x05, 0x07].includes(buffer[2]) &&
      [0x04, 0x06, 0x08].includes(buffer[3])
    );
  }

  return (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(
      Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
    )
  );
}

function cellToString(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return "";
    }

    return [
      value.getUTCFullYear().toString().padStart(4, "0"),
      (value.getUTCMonth() + 1).toString().padStart(2, "0"),
      value.getUTCDate().toString().padStart(2, "0"),
    ].join("-");
  }

  return String(value);
}

export function parseSalesExcel(
  buffer: Buffer,
  fileName: string
): SalesCsvRow[] {
  const extension = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();

  if (
    (extension !== ".xlsx" && extension !== ".xls") ||
    !hasExcelSignature(buffer, extension)
  ) {
    throw new ExcelParseError(
      "The file content does not match a supported Excel workbook."
    );
  }

  let workbook: XLSX.WorkBook;

  try {
    workbook = XLSX.read(buffer, {
      type: "buffer",
      cellDates: true,
      bookVBA: false,
      WTF: true,
    });
  } catch {
    throw new ExcelParseError("The Excel workbook is malformed or unreadable.");
  }

  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new ExcelParseError("The Excel workbook contains no worksheets.");
  }

  const worksheet = workbook.Sheets[firstSheetName];

  if (!worksheet || !worksheet["!ref"]) {
    throw new ExcelParseError("The first worksheet is empty.");
  }

  if (
    Object.entries(worksheet).some(
      ([address, cell]) =>
        !address.startsWith("!") &&
        typeof cell === "object" &&
        cell !== null &&
        "f" in cell
    )
  ) {
    throw new ExcelParseError(
      "Formula cells are not supported. Replace formulas with their values."
    );
  }

  let grid: unknown[][];

  try {
    grid = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      raw: true,
      defval: "",
      blankrows: false,
    });
  } catch {
    throw new ExcelParseError("The first worksheet could not be read.");
  }

  const headers = (grid[0] ?? []).map((value) => cellToString(value).trim());

  if (headers.length === 0 || headers.every((header) => !header)) {
    throw new ExcelParseError("The first worksheet must include a header row.");
  }

  if (new Set(headers).size !== headers.length) {
    throw new ExcelParseError("The first worksheet contains duplicate headers.");
  }

  const missingHeaders = SALES_CSV_HEADERS.filter(
    (header) => !headers.includes(header)
  );

  if (missingHeaders.length > 0) {
    throw new ExcelParseError(
      `Missing required Excel headers: ${missingHeaders.join(", ")}.`
    );
  }

  const rows = grid.slice(1);

  return rows.map((values, index) => {
    if (values.slice(headers.length).some((value) => cellToString(value).trim())) {
      throw new ExcelParseError(
        `Row ${index + 2}: data was found outside the header columns.`
      );
    }

    return Object.fromEntries(
      SALES_CSV_HEADERS.map((header) => [
        header,
        cellToString(values[headers.indexOf(header)]),
      ])
    ) as SalesCsvRow;
  });
}
