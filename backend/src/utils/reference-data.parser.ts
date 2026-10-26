import { ProductStatus } from "@/generated/prisma/client";
import * as XLSX from "xlsx";
import { ExcelParseError, readExcelWorkbook } from "./excel.parser";

export interface ProductImportRow {
  productId: string;
  productName: string;
  category: string;
  unitPrice: string;
  unitCost: string | null;
  status: ProductStatus;
  sourceRow: number;
}

export interface CustomerImportRow {
  customerId: string;
  customerType: string;
  ageGroup: string;
  gender: string | null;
  registrationDate: Date;
  sourceRow: number;
}

export interface ReferenceWorksheetErrors {
  worksheet: string;
  rejectedRows: number[];
  errors: string[];
}

export class ReferenceDataParseError extends Error {
  constructor(
    message: string,
    readonly worksheetErrors: ReferenceWorksheetErrors[] = [],
  ) {
    super(message);
    this.name = "ReferenceDataParseError";
  }
}

export interface ParsedReferenceWorkbook {
  products?: ProductImportRow[];
  customers?: CustomerImportRow[];
  worksheetNames: string[];
}

const PRODUCT_HEADERS = {
  productId: ["productid"],
  productName: ["productname"],
  category: ["category"],
  unitPrice: ["unitprice"],
  unitCost: ["unitcost"],
  status: ["productstatus", "status"],
} as const;

const CUSTOMER_HEADERS = {
  customerId: ["customerid"],
  customerType: ["customertype"],
  ageGroup: ["agegroup"],
  gender: ["gender"],
  registrationDate: ["registrationdate"],
} as const;

type HeaderDefinition = Record<string, readonly string[]>;

function normalizeName(value: string): string {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]/g, "");
}

function cellString(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? ""
      : value.toISOString().slice(0, 10);
  }
  return String(value).trim();
}

function getSheetRows(worksheet: XLSX.WorkSheet): unknown[][] {
  return XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    raw: true,
    defval: "",
    blankrows: true,
  });
}

function rowIsBlank(row: unknown[]): boolean {
  return row.every((value) => cellString(value) === "");
}

function rejectUnsupportedCells(
  worksheetName: string,
  worksheet: XLSX.WorkSheet,
): void {
  const invalidCells = Object.entries(worksheet).flatMap(([address, cell]) => {
    if (address.startsWith("!") || typeof cell !== "object" || cell === null) {
      return [];
    }

    const type =
      "f" in cell
        ? "formula cells are not supported"
        : "t" in cell && cell.t === "e"
          ? "Excel error cells are not supported"
          : undefined;
    if (!type) return [];

    const { r } = XLSX.utils.decode_cell(address);
    return [{ row: r + 1, message: `${address}: ${type}.` }];
  });

  if (invalidCells.length) {
    throw new ReferenceDataParseError(
      `Worksheet "${worksheetName}" contains unsupported formula or error cells.`,
      [
        {
          worksheet: worksheetName,
          rejectedRows: [...new Set(invalidCells.map(({ row }) => row))].sort(
            (a, b) => a - b,
          ),
          errors: invalidCells.map(
            ({ row, message }) => `${worksheetName} row ${row}: ${message}`,
          ),
        },
      ],
    );
  }
}

function resolveHeaders(
  worksheetName: string,
  rawHeaders: unknown[],
  definitions: HeaderDefinition,
  required: string[],
): { headers: string[]; indexes: Map<string, number> } {
  const headers = rawHeaders.map((value) => normalizeName(cellString(value)));
  if (headers.length === 0 || headers.every((header) => !header)) {
    throw new ReferenceDataParseError(
      `Worksheet "${worksheetName}" is missing its header row.`,
      [
        {
          worksheet: worksheetName,
          rejectedRows: [],
          errors: ["Missing header row."],
        },
      ],
    );
  }

  const seen = new Set<string>();
  const duplicateHeaders = new Set<string>();
  headers.forEach((header) => {
    if (header && seen.has(header)) duplicateHeaders.add(header);
    seen.add(header);
  });
  if (duplicateHeaders.size > 0) {
    throw new ReferenceDataParseError(
      `Worksheet "${worksheetName}" contains duplicate headers: ${[...duplicateHeaders].join(", ")}.`,
      [
        {
          worksheet: worksheetName,
          rejectedRows: [],
          errors: [`Duplicate headers: ${[...duplicateHeaders].join(", ")}.`],
        },
      ],
    );
  }

  const indexes = new Map<string, number>();
  for (const [field, aliases] of Object.entries(definitions)) {
    const index = headers.findIndex((header) => aliases.includes(header));
    if (index !== -1) indexes.set(field, index);
  }

  const missing = required.filter((field) => !indexes.has(field));
  if (missing.length > 0) {
    throw new ReferenceDataParseError(
      `Worksheet "${worksheetName}" is missing required headers: ${missing.join(", ")}.`,
      [
        {
          worksheet: worksheetName,
          rejectedRows: [],
          errors: [`Missing required headers: ${missing.join(", ")}.`],
        },
      ],
    );
  }

  return { headers, indexes };
}

function valueAt(
  row: unknown[],
  indexes: Map<string, number>,
  field: string,
): unknown {
  const index = indexes.get(field);
  return index === undefined ? undefined : row[index];
}

function requiredText(
  raw: unknown,
  field: string,
  worksheet: string,
  rowNumber: number,
  errors: string[],
): string {
  const value = cellString(raw);
  if (!value)
    errors.push(`${worksheet} row ${rowNumber}: ${field} is required.`);
  return value;
}

function parseMoney(
  raw: unknown,
  field: string,
  worksheet: string,
  rowNumber: number,
  errors: string[],
  optional = false,
): string | null {
  const value = cellString(raw);
  if (!value && optional) return null;
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) {
    errors.push(
      `${worksheet} row ${rowNumber}: ${field} must be a nonnegative amount with at most two decimal places.`,
    );
    return optional ? null : "";
  }
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount > 9999999999.99) {
    errors.push(
      `${worksheet} row ${rowNumber}: ${field} exceeds the supported amount range.`,
    );
    return optional ? null : "";
  }
  return amount.toFixed(2);
}

function parseDateValue(
  raw: unknown,
  worksheet: string,
  rowNumber: number,
  errors: string[],
): Date {
  let value: string;
  if (raw instanceof Date) {
    value = cellString(raw);
  } else if (typeof raw === "number" && Number.isFinite(raw)) {
    const parsed = XLSX.SSF.parse_date_code(raw);
    value = parsed
      ? `${String(parsed.y).padStart(4, "0")}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`
      : "";
  } else {
    value = cellString(raw);
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    errors.push(
      `${worksheet} row ${rowNumber}: registrationDate must be a valid Excel date or use YYYY-MM-DD format.`,
    );
    return new Date(0);
  }

  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  ) {
    errors.push(
      `${worksheet} row ${rowNumber}: registrationDate is not a valid calendar date.`,
    );
    return new Date(0);
  }
  return date;
}

function rejectDuplicateIds<T extends { sourceRow: number }>(
  worksheet: string,
  rows: T[],
  getId: (row: T) => string,
  errors: string[],
  rejectedRows: Set<number>,
): void {
  const firstRows = new Map<string, number>();
  for (const row of rows) {
    const id = getId(row);
    if (!id) continue;
    const firstRow = firstRows.get(id);
    if (firstRow !== undefined) {
      rejectedRows.add(row.sourceRow);
      rejectedRows.add(firstRow);
      errors.push(
        `${worksheet} rows ${firstRow} and ${row.sourceRow}: duplicate ID "${id}".`,
      );
    } else {
      firstRows.set(id, row.sourceRow);
    }
  }
}

function parseProducts(
  worksheetName: string,
  worksheet: XLSX.WorkSheet,
): ProductImportRow[] {
  rejectUnsupportedCells(worksheetName, worksheet);
  const rows = getSheetRows(worksheet);
  if (!rows.length || rowIsBlank(rows[0])) {
    throw new ReferenceDataParseError(
      `Worksheet "${worksheetName}" is empty or has no header row.`,
      [
        {
          worksheet: worksheetName,
          rejectedRows: [],
          errors: ["Empty worksheet or missing header row."],
        },
      ],
    );
  }

  const { indexes } = resolveHeaders(worksheetName, rows[0], PRODUCT_HEADERS, [
    "productId",
    "productName",
    "category",
    "unitPrice",
  ]);
  const errors: string[] = [];
  const rejectedRows = new Set<number>();
  const parsed = rows.slice(1).flatMap((row, index) => {
    if (rowIsBlank(row)) return [];
    const sourceRow = index + 2;
    const rowErrors: string[] = [];
    const productId = requiredText(
      valueAt(row, indexes, "productId"),
      "productId",
      worksheetName,
      sourceRow,
      rowErrors,
    );
    const productName = requiredText(
      valueAt(row, indexes, "productName"),
      "productName",
      worksheetName,
      sourceRow,
      rowErrors,
    );
    const category = requiredText(
      valueAt(row, indexes, "category"),
      "category",
      worksheetName,
      sourceRow,
      rowErrors,
    );
    const unitPrice = parseMoney(
      valueAt(row, indexes, "unitPrice"),
      "unitPrice",
      worksheetName,
      sourceRow,
      rowErrors,
    );
    const unitCost = parseMoney(
      valueAt(row, indexes, "unitCost"),
      "unitCost",
      worksheetName,
      sourceRow,
      rowErrors,
      true,
    );
    const rawStatus = cellString(valueAt(row, indexes, "status")).toUpperCase();
    const status = rawStatus || ProductStatus.ACTIVE;
    if (!Object.values(ProductStatus).includes(status as ProductStatus)) {
      rowErrors.push(
        `${worksheetName} row ${sourceRow}: productStatus must be ACTIVE, INACTIVE, or DISCONTINUED.`,
      );
    }
    if (rowErrors.length) {
      rejectedRows.add(sourceRow);
      errors.push(...rowErrors);
    }
    return [
      {
        productId,
        productName,
        category,
        unitPrice: unitPrice ?? "",
        unitCost,
        status: status as ProductStatus,
        sourceRow,
      },
    ];
  });

  rejectDuplicateIds(
    worksheetName,
    parsed,
    (row) => row.productId,
    errors,
    rejectedRows,
  );
  if (errors.length) {
    throw new ReferenceDataParseError(
      `Products worksheet contains ${rejectedRows.size} rejected row(s).`,
      [
        {
          worksheet: worksheetName,
          rejectedRows: [...rejectedRows].sort((a, b) => a - b),
          errors,
        },
      ],
    );
  }
  if (parsed.length === 0) {
    throw new ReferenceDataParseError(
      `Worksheet "${worksheetName}" contains no product records.`,
      [
        {
          worksheet: worksheetName,
          rejectedRows: [],
          errors: ["No product records found."],
        },
      ],
    );
  }
  return parsed;
}

function parseCustomers(
  worksheetName: string,
  worksheet: XLSX.WorkSheet,
): CustomerImportRow[] {
  rejectUnsupportedCells(worksheetName, worksheet);
  const rows = getSheetRows(worksheet);
  if (!rows.length || rowIsBlank(rows[0])) {
    throw new ReferenceDataParseError(
      `Worksheet "${worksheetName}" is empty or has no header row.`,
      [
        {
          worksheet: worksheetName,
          rejectedRows: [],
          errors: ["Empty worksheet or missing header row."],
        },
      ],
    );
  }

  const { indexes } = resolveHeaders(worksheetName, rows[0], CUSTOMER_HEADERS, [
    "customerId",
    "customerType",
    "ageGroup",
    "registrationDate",
  ]);
  const errors: string[] = [];
  const rejectedRows = new Set<number>();
  const parsed = rows.slice(1).flatMap((row, index) => {
    if (rowIsBlank(row)) return [];
    const sourceRow = index + 2;
    const rowErrors: string[] = [];
    const customerId = requiredText(
      valueAt(row, indexes, "customerId"),
      "customerId",
      worksheetName,
      sourceRow,
      rowErrors,
    );
    const customerType = requiredText(
      valueAt(row, indexes, "customerType"),
      "customerType",
      worksheetName,
      sourceRow,
      rowErrors,
    );
    const ageGroup = requiredText(
      valueAt(row, indexes, "ageGroup"),
      "ageGroup",
      worksheetName,
      sourceRow,
      rowErrors,
    );
    const genderValue = cellString(valueAt(row, indexes, "gender"));
    const registrationDate = parseDateValue(
      valueAt(row, indexes, "registrationDate"),
      worksheetName,
      sourceRow,
      rowErrors,
    );
    if (rowErrors.length) {
      rejectedRows.add(sourceRow);
      errors.push(...rowErrors);
    }
    return [
      {
        customerId,
        customerType,
        ageGroup,
        gender: genderValue || null,
        registrationDate,
        sourceRow,
      },
    ];
  });

  rejectDuplicateIds(
    worksheetName,
    parsed,
    (row) => row.customerId,
    errors,
    rejectedRows,
  );
  if (errors.length) {
    throw new ReferenceDataParseError(
      `Customers worksheet contains ${rejectedRows.size} rejected row(s).`,
      [
        {
          worksheet: worksheetName,
          rejectedRows: [...rejectedRows].sort((a, b) => a - b),
          errors,
        },
      ],
    );
  }
  if (parsed.length === 0) {
    throw new ReferenceDataParseError(
      `Worksheet "${worksheetName}" contains no customer records.`,
      [
        {
          worksheet: worksheetName,
          rejectedRows: [],
          errors: ["No customer records found."],
        },
      ],
    );
  }
  return parsed;
}

export function parseReferenceWorkbook(
  buffer: Buffer,
  fileName: string,
): ParsedReferenceWorkbook {
  const workbook = readExcelWorkbook(buffer, fileName);
  if (workbook.SheetNames.length === 0) {
    throw new ReferenceDataParseError(
      "The Excel workbook contains no worksheets.",
    );
  }

  const sheetsByNormalizedName = new Map<string, string>();
  for (const name of workbook.SheetNames) {
    const normalized = normalizeName(name);
    if (["products", "customers"].includes(normalized)) {
      const previous = sheetsByNormalizedName.get(normalized);
      if (previous) {
        throw new ReferenceDataParseError(
          `Worksheets "${previous}" and "${name}" both identify as ${normalized}.`,
        );
      }
      sheetsByNormalizedName.set(normalized, name);
    }
  }

  const productsName = sheetsByNormalizedName.get("products");
  const customersName = sheetsByNormalizedName.get("customers");
  if (!productsName && !customersName) {
    throw new ReferenceDataParseError(
      "The workbook must contain a Products worksheet, a Customers worksheet, or both.",
    );
  }

  const products = productsName
    ? parseProducts(productsName, workbook.Sheets[productsName])
    : undefined;
  const customers = customersName
    ? parseCustomers(customersName, workbook.Sheets[customersName])
    : undefined;

  return {
    ...(products ? { products } : {}),
    ...(customers ? { customers } : {}),
    worksheetNames: [
      ...(productsName ? [productsName] : []),
      ...(customersName ? [customersName] : []),
    ],
  };
}
