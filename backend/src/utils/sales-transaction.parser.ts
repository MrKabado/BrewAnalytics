import * as XLSX from "xlsx";
import { ExcelParseError, readExcelWorkbook } from "./excel.parser";

export interface SalesTransactionImportRow {
  transactionId: string;
  saleDate: Date;
  saleDateTime: Date | null;
  productId: string;
  customerId: string | null;
  quantity: number;
  unitPrice: string;
  totalAmount: string;
  paymentMethod: string;
  sourceRow: number;
}

export interface SalesTransactionWorksheetErrors {
  worksheet: string;
  rejectedRows: number[];
  errors: string[];
}

export class SalesTransactionParseError extends Error {
  constructor(
    message: string,
    readonly worksheetErrors: SalesTransactionWorksheetErrors[] = [],
  ) {
    super(message);
    this.name = "SalesTransactionParseError";
  }
}

export interface ParsedSalesTransactionWorkbook {
  worksheetName: string;
  worksheetNames: string[];
  rows: SalesTransactionImportRow[];
}

const TRANSACTION_HEADERS = {
  transactionId: ["transactionid"],
  saleDate: [
    "saledate",
    "transactiondate",
    "transactiondatetime",
    "transactiondateandtime",
  ],
  productId: ["productid"],
  quantity: ["quantity", "quantitysold"],
  unitPrice: ["unitprice"],
  totalAmount: ["totalamount", "totalsales"],
  paymentMethod: ["paymentmethod"],
  customerId: ["customerid"],
} as const;

type TransactionField = keyof typeof TRANSACTION_HEADERS;

function normalizeName(value: string): string {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]/g, "");
}

function cellString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    return value.toISOString();
  }
  return String(value).trim();
}

function rowIsBlank(row: unknown[]): boolean {
  return row.every((value) => cellString(value) === "");
}

function issue(
  worksheet: string,
  errors: string[],
  rejectedRows: Set<number>,
  row: number,
  field: string,
  detail: string,
): void {
  rejectedRows.add(row);
  errors.push(`${worksheet} row ${row}: ${field} ${detail}.`);
}

function parseDate(
  value: unknown,
): { saleDate: Date; saleDateTime: Date | null } | undefined {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return undefined;
    const saleDate = new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
    );
    const hasTime =
      value.getUTCHours() !== 0 ||
      value.getUTCMinutes() !== 0 ||
      value.getUTCSeconds() !== 0 ||
      value.getUTCMilliseconds() !== 0;
    return { saleDate, saleDateTime: hasTime ? new Date(value) : null };
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return undefined;
    const saleDate = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
    if (Number.isNaN(saleDate.getTime())) return undefined;
    const milliseconds = Math.round((parsed.s % 1) * 1000);
    const hasTime =
      parsed.H !== 0 || parsed.M !== 0 || parsed.S !== 0 || milliseconds !== 0;
    return {
      saleDate,
      saleDateTime: hasTime
        ? new Date(
            Date.UTC(
              parsed.y,
              parsed.m - 1,
              parsed.d,
              parsed.H,
              parsed.M,
              Math.floor(parsed.S),
              milliseconds,
            ),
          )
        : null,
    };
  }

  const text = cellString(value);
  const match =
    /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})?)?$/.exec(
      text,
    );
  if (!match) return undefined;

  const [, year, month, day] = match;
  const saleDate = new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day)),
  );
  if (
    saleDate.getUTCFullYear() !== Number(year) ||
    saleDate.getUTCMonth() !== Number(month) - 1 ||
    saleDate.getUTCDate() !== Number(day)
  ) {
    return undefined;
  }
  const hour = match[4];
  const minute = match[5];
  const second = match[6] ?? "0";
  const fraction = match[7] ?? "0";
  const zone = match[8];
  if (hour === undefined) return { saleDate, saleDateTime: null };
  const hourNumber = Number(hour);
  const minuteNumber = Number(minute);
  const secondNumber = Number(second);
  if (hourNumber > 23 || minuteNumber > 59 || secondNumber > 59) {
    return undefined;
  }
  const timestampText =
    `${year}-${month}-${day}T${hour}:${minute}:${String(secondNumber).padStart(2, "0")}.` +
    `${fraction.padEnd(3, "0")}${zone ?? "Z"}`;
  const saleDateTime = new Date(timestampText);
  if (Number.isNaN(saleDateTime.getTime())) return undefined;
  return { saleDate, saleDateTime };
}

function parseMoney(value: unknown): string | undefined {
  const text = cellString(value);
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return undefined;
  const amount = Number(text);
  if (!Number.isFinite(amount) || amount > 9999999999.99) return undefined;
  return amount.toFixed(2);
}

function decimalCents(value: string): bigint {
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
}

function parseWorksheet(
  worksheetName: string,
  worksheet: XLSX.WorkSheet | undefined,
): SalesTransactionImportRow[] {
  if (!worksheet || !worksheet["!ref"]) {
    throw new SalesTransactionParseError(
      `Worksheet "${worksheetName}" is empty.`,
      [
        {
          worksheet: worksheetName,
          rejectedRows: [],
          errors: ["Worksheet is empty."],
        },
      ],
    );
  }

  const invalidCells = Object.entries(worksheet).flatMap(([address, cell]) => {
    if (address.startsWith("!") || typeof cell !== "object" || cell === null) {
      return [];
    }
    const kind =
      "f" in cell
        ? "formula cells are not supported"
        : "t" in cell && cell.t === "e"
          ? "Excel error cells are not supported"
          : undefined;
    return kind
      ? [{ row: XLSX.utils.decode_cell(address).r + 1, address, kind }]
      : [];
  });
  if (invalidCells.length) {
    const rejectedRows = [...new Set(invalidCells.map(({ row }) => row))].sort(
      (a, b) => a - b,
    );
    throw new SalesTransactionParseError(
      `Worksheet "${worksheetName}" contains formula or Excel error cells.`,
      [
        {
          worksheet: worksheetName,
          rejectedRows,
          errors: invalidCells.map(
            ({ row, address, kind }) =>
              `${worksheetName} row ${row}: ${address}: ${kind}.`,
          ),
        },
      ],
    );
  }

  const grid = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    raw: true,
    defval: "",
    blankrows: true,
  });
  const rawHeaders = grid[0] ?? [];
  const headers = rawHeaders.map((value) => normalizeName(cellString(value)));
  if (headers.length === 0 || headers.every((header) => !header)) {
    throw new SalesTransactionParseError(
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

  const duplicateHeaders = new Set<string>();
  const seenHeaders = new Set<string>();
  for (const header of headers) {
    if (header && seenHeaders.has(header)) duplicateHeaders.add(header);
    seenHeaders.add(header);
  }
  if (duplicateHeaders.size) {
    throw new SalesTransactionParseError(
      `Worksheet "${worksheetName}" contains ambiguous duplicate headers: ${[...duplicateHeaders].join(", ")}.`,
      [
        {
          worksheet: worksheetName,
          rejectedRows: [],
          errors: [
            `Ambiguous duplicate headers: ${[...duplicateHeaders].join(", ")}.`,
          ],
        },
      ],
    );
  }

  const indexes = new Map<TransactionField, number>();
  for (const field of Object.keys(TRANSACTION_HEADERS) as TransactionField[]) {
    const aliases: readonly string[] = TRANSACTION_HEADERS[field];
    const matches = headers.flatMap((header, index) =>
      aliases.includes(header) ? [index] : [],
    );
    if (matches.length > 1) {
      throw new SalesTransactionParseError(
        `Worksheet "${worksheetName}" has more than one header for ${field}.`,
        [
          {
            worksheet: worksheetName,
            rejectedRows: [],
            errors: [`Ambiguous headers for ${field}.`],
          },
        ],
      );
    }
    if (matches.length === 1) indexes.set(field, matches[0]);
  }

  const requiredFields: TransactionField[] = [
    "transactionId",
    "saleDate",
    "productId",
    "quantity",
    "unitPrice",
    "totalAmount",
    "paymentMethod",
  ];
  const missing = requiredFields.filter((field) => !indexes.has(field));
  if (missing.length) {
    throw new SalesTransactionParseError(
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

  const errors: string[] = [];
  const rejectedRows = new Set<number>();
  const parsed = grid.slice(1).flatMap((row, index) => {
    if (rowIsBlank(row)) return [];
    const sourceRow = index + 2;
    const get = (field: TransactionField) =>
      indexes.has(field) ? row[indexes.get(field)!] : undefined;
    const transactionId = cellString(get("transactionId"));
    const productId = cellString(get("productId"));
    const paymentMethod = cellString(get("paymentMethod"));
    const customerText = cellString(get("customerId"));
    const parsedDate = parseDate(get("saleDate"));
    const rawQuantity = cellString(get("quantity"));
    const quantity = /^\d+$/.test(rawQuantity) ? Number(rawQuantity) : NaN;
    const unitPrice = parseMoney(get("unitPrice"));
    const totalAmount = parseMoney(get("totalAmount"));
    const rowErrorCount = errors.length;

    if (row.slice(rawHeaders.length).some((value) => cellString(value))) {
      issue(
        worksheetName,
        errors,
        rejectedRows,
        sourceRow,
        "row",
        "contains data outside the header columns",
      );
    }
    if (!transactionId)
      issue(
        worksheetName,
        errors,
        rejectedRows,
        sourceRow,
        "transactionId",
        "is required",
      );
    if (!parsedDate)
      issue(
        worksheetName,
        errors,
        rejectedRows,
        sourceRow,
        "saleDate",
        "must be a valid date",
      );
    if (!productId)
      issue(
        worksheetName,
        errors,
        rejectedRows,
        sourceRow,
        "productId",
        "is required",
      );
    if (
      !Number.isSafeInteger(quantity) ||
      quantity < 1 ||
      quantity > 2147483647
    ) {
      issue(
        worksheetName,
        errors,
        rejectedRows,
        sourceRow,
        "quantity",
        "must be a positive whole number",
      );
    }
    if (unitPrice === undefined) {
      issue(
        worksheetName,
        errors,
        rejectedRows,
        sourceRow,
        "unitPrice",
        "must be a nonnegative amount with at most two decimal places",
      );
    }
    if (totalAmount === undefined) {
      issue(
        worksheetName,
        errors,
        rejectedRows,
        sourceRow,
        "totalAmount",
        "must be a nonnegative amount with at most two decimal places",
      );
    }
    if (!paymentMethod) {
      issue(
        worksheetName,
        errors,
        rejectedRows,
        sourceRow,
        "paymentMethod",
        "is required",
      );
    }
    if (
      unitPrice !== undefined &&
      totalAmount !== undefined &&
      Number.isSafeInteger(quantity) &&
      quantity > 0 &&
      decimalCents(unitPrice) * BigInt(quantity) !== decimalCents(totalAmount)
    ) {
      issue(
        worksheetName,
        errors,
        rejectedRows,
        sourceRow,
        "totalAmount",
        "must equal quantity multiplied by unitPrice",
      );
    }

    if (errors.length !== rowErrorCount) return [];
    return [
      {
        transactionId,
        saleDate: parsedDate!.saleDate,
        saleDateTime: parsedDate!.saleDateTime,
        productId,
        customerId: customerText || null,
        quantity,
        unitPrice: unitPrice!,
        totalAmount: totalAmount!,
        paymentMethod,
        sourceRow,
      },
    ];
  });

  const firstBySignature = new Map<string, number>();
  for (const row of parsed) {
    const signature = [
      row.transactionId,
      row.saleDate.toISOString(),
      row.productId,
      row.customerId ?? "",
      row.quantity,
      row.unitPrice,
      row.totalAmount,
      row.paymentMethod.toLocaleLowerCase(),
    ].join("\u0000");
    const previousRow = firstBySignature.get(signature);
    if (previousRow !== undefined) {
      rejectedRows.add(previousRow);
      rejectedRows.add(row.sourceRow);
      errors.push(
        `${worksheetName} rows ${previousRow} and ${row.sourceRow}: duplicate sales lines are not allowed.`,
      );
    } else {
      firstBySignature.set(signature, row.sourceRow);
    }
  }

  if (errors.length) {
    throw new SalesTransactionParseError(
      `Sales Transactions worksheet contains ${rejectedRows.size} rejected row(s).`,
      [
        {
          worksheet: worksheetName,
          rejectedRows: [...rejectedRows].sort((a, b) => a - b),
          errors,
        },
      ],
    );
  }
  if (!parsed.length) {
    throw new SalesTransactionParseError(
      `Worksheet "${worksheetName}" contains no sales transaction rows.`,
      [
        {
          worksheet: worksheetName,
          rejectedRows: [],
          errors: ["No sales transaction rows found."],
        },
      ],
    );
  }
  return parsed;
}

export function parseSalesTransactionWorkbook(
  buffer: Buffer,
  fileName: string,
): ParsedSalesTransactionWorkbook {
  let workbook: XLSX.WorkBook;
  try {
    workbook = readExcelWorkbook(buffer, fileName);
  } catch (error) {
    if (error instanceof ExcelParseError) {
      throw new SalesTransactionParseError(error.message);
    }
    throw error;
  }
  const names = workbook.SheetNames;
  if (!names.length) {
    throw new SalesTransactionParseError(
      "The Excel workbook contains no worksheets.",
    );
  }

  const matches = names.filter(
    (name) => normalizeName(name) === "salestransactions",
  );
  if (matches.length > 1) {
    throw new SalesTransactionParseError(
      `The workbook contains multiple worksheets named Sales Transactions: ${matches.join(", ")}.`,
    );
  }
  if (!matches.length) {
    throw new SalesTransactionParseError(
      `The workbook must contain a Sales Transactions worksheet. Detected worksheets: ${names.join(", ")}.`,
    );
  }

  return {
    worksheetName: matches[0],
    worksheetNames: names,
    rows: parseWorksheet(matches[0], workbook.Sheets[matches[0]]),
  };
}
