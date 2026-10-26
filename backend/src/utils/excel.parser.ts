import * as XLSX from "xlsx";
import { validateSalesRows } from "./dataset.validation";
import { SALES_CSV_HEADERS, type SalesCsvRow } from "./csv.parser";

export const EXCEL_PREVIEW_ROW_LIMIT = 5;

export class ExcelParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExcelParseError";
  }
}

export interface ExcelWorksheetPreview {
  name: string;
  headers: string[];
  rowCount: number;
  previewRows: string[][];
  supportedBySalesImporter: boolean;
  warnings: string[];
}

const TRANSACTION_PREVIEW_HEADERS = {
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

const CAMPAIGN_PREVIEW_HEADERS = {
  campaignId: ["campaignid"],
  campaignName: ["campaignname"],
  promotionType: ["promotiontype"],
  campaignChannel: ["marketingchannel", "campaignchannel", "channel"],
  startDate: ["startdate"],
  endDate: ["enddate"],
  marketingCost: ["marketingcost"],
} as const;

export interface ExcelWorkbookPreview {
  fileName: string;
  worksheetCount: number;
  worksheets: ExcelWorksheetPreview[];
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
    buffer
      .subarray(0, 8)
      .equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))
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

export function readExcelWorkbook(
  buffer: Buffer,
  fileName: string,
): XLSX.WorkBook {
  const extension = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();

  if (
    (extension !== ".xlsx" && extension !== ".xls") ||
    !hasExcelSignature(buffer, extension)
  ) {
    throw new ExcelParseError(
      "The file content does not match a supported Excel workbook.",
    );
  }

  try {
    return XLSX.read(buffer, {
      type: "buffer",
      cellDates: true,
      bookVBA: false,
      WTF: true,
    });
  } catch {
    throw new ExcelParseError("The Excel workbook is malformed or unreadable.");
  }
}

function getSheetGrid(
  worksheet: XLSX.WorkSheet,
  sheetName: string,
): unknown[][] {
  try {
    return XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      raw: true,
      defval: "",
      blankrows: false,
    });
  } catch {
    throw new ExcelParseError(`Worksheet "${sheetName}" could not be read.`);
  }
}

function getFormulaCells(worksheet: XLSX.WorkSheet): string[] {
  return Object.entries(worksheet)
    .filter(
      ([address, cell]) =>
        !address.startsWith("!") &&
        typeof cell === "object" &&
        cell !== null &&
        "f" in cell,
    )
    .map(([address]) => address);
}

function getErrorCells(worksheet: XLSX.WorkSheet): string[] {
  return Object.entries(worksheet)
    .filter(
      ([address, cell]) =>
        !address.startsWith("!") &&
        typeof cell === "object" &&
        cell !== null &&
        "t" in cell &&
        cell.t === "e",
    )
    .map(([address]) => address);
}

function nonEmptyRows(rows: unknown[][]): unknown[][] {
  return rows.filter((row) =>
    row.some((value) => cellToString(value).trim() !== ""),
  );
}

function rowsToSalesRecords(
  headers: string[],
  rows: unknown[][],
): SalesCsvRow[] {
  return rows.map(
    (values) =>
      Object.fromEntries(
        SALES_CSV_HEADERS.map((header) => [
          header,
          cellToString(values[headers.indexOf(header)]),
        ]),
      ) as SalesCsvRow,
  );
}

function inspectWorksheet(
  name: string,
  worksheet: XLSX.WorkSheet | undefined,
): ExcelWorksheetPreview {
  const warnings: string[] = [];

  if (!worksheet || !worksheet["!ref"]) {
    return {
      name,
      headers: [],
      rowCount: 0,
      previewRows: [],
      supportedBySalesImporter: false,
      warnings: ["Worksheet is empty."],
    };
  }

  const formulaCells = getFormulaCells(worksheet);
  const errorCells = getErrorCells(worksheet);
  if (formulaCells.length > 0) {
    warnings.push(
      `Formula cells are not supported (${formulaCells.slice(0, 5).join(", ")}${formulaCells.length > 5 ? ", …" : ""}).`,
    );
  }
  if (errorCells.length > 0) {
    warnings.push(
      `Excel error cells were found (${errorCells.slice(0, 5).join(", ")}${errorCells.length > 5 ? ", …" : ""}).`,
    );
  }

  let grid: unknown[][];
  try {
    grid = getSheetGrid(worksheet, name);
  } catch (error) {
    warnings.push(
      error instanceof Error ? error.message : "Worksheet could not be read.",
    );
    return {
      name,
      headers: [],
      rowCount: 0,
      previewRows: [],
      supportedBySalesImporter: false,
      warnings,
    };
  }

  const headers = (grid[0] ?? []).map((value) => cellToString(value).trim());
  const normalizedHeaders = headers.map((header) =>
    header.toLocaleLowerCase().replace(/[^a-z0-9]/g, ""),
  );
  const normalizedName = name.toLocaleLowerCase().replace(/[^a-z0-9]/g, "");
  const transactionWorksheet = normalizedName === "salestransactions";
  const namedCampaignWorksheet = ["marketingcampaigns", "campaigns"].includes(
    normalizedName,
  );
  const legacyMissingHeaders = SALES_CSV_HEADERS.filter(
    (header) => !headers.includes(header),
  );
  const transactionMissingHeaders = Object.entries(TRANSACTION_PREVIEW_HEADERS)
    .filter(([field]) => field !== "customerId")
    .filter(
      ([, aliases]) =>
        !aliases.some((alias) => normalizedHeaders.includes(alias)),
    )
    .map(([field]) => field);
  const ambiguousTransactionHeaders = Object.entries(
    TRANSACTION_PREVIEW_HEADERS,
  )
    .filter(
      ([, aliases]) =>
        aliases.reduce(
          (count, alias) =>
            count +
            normalizedHeaders.filter((header) => header === alias).length,
          0,
        ) > 1,
    )
    .map(([field]) => field);
  const campaignMissingHeaders = Object.entries(CAMPAIGN_PREVIEW_HEADERS)
    .filter(
      ([, aliases]) =>
        !aliases.some((alias) => normalizedHeaders.includes(alias)),
    )
    .map(([field]) => field);
  const campaignWorksheet =
    namedCampaignWorksheet || campaignMissingHeaders.length === 0;
  const ambiguousCampaignHeaders = Object.entries(CAMPAIGN_PREVIEW_HEADERS)
    .filter(
      ([, aliases]) =>
        aliases.reduce(
          (count, alias) =>
            count +
            normalizedHeaders.filter((header) => header === alias).length,
          0,
        ) > 1,
    )
    .map(([field]) => field);
  const usesLegacyHeaders = legacyMissingHeaders.length === 0;
  const usesTransactionHeaders =
    transactionWorksheet &&
    transactionMissingHeaders.length === 0 &&
    ambiguousTransactionHeaders.length === 0;
  const requiredMissingHeaders = usesTransactionHeaders
    ? []
    : transactionWorksheet && !usesLegacyHeaders
      ? transactionMissingHeaders
      : legacyMissingHeaders;
  const hasHeader = headers.length > 0 && headers.some(Boolean);
  if (!hasHeader) {
    warnings.push("Worksheet does not contain a header row.");
  }
  if (transactionWorksheet && ambiguousTransactionHeaders.length > 0) {
    warnings.push(
      `Ambiguous Sales Transactions headers found for: ${ambiguousTransactionHeaders.join(", ")}.`,
    );
  }
  const campaignFormatRecognized =
    campaignWorksheet &&
    campaignMissingHeaders.length === 0 &&
    ambiguousCampaignHeaders.length === 0;
  if (campaignWorksheet && ambiguousCampaignHeaders.length > 0) {
    warnings.push(
      `Ambiguous Marketing Campaigns headers found for: ${ambiguousCampaignHeaders.join(", ")}.`,
    );
  }
  if (campaignWorksheet && campaignMissingHeaders.length > 0) {
    warnings.push(
      `Required campaign headers missing: ${campaignMissingHeaders.join(", ")}.`,
    );
  }
  if (campaignFormatRecognized) {
    warnings.push(
      "Marketing Campaigns worksheet structure recognized; campaign values are validated during import.",
    );
  }

  const duplicateHeaders = headers.filter(
    (header, index) => header && headers.indexOf(header) !== index,
  );
  if (duplicateHeaders.length > 0) {
    warnings.push(
      `Duplicate headers were found: ${[...new Set(duplicateHeaders)].join(", ")}.`,
    );
  }

  if (hasHeader && requiredMissingHeaders.length > 0) {
    warnings.push(
      `Required sales headers missing: ${requiredMissingHeaders.join(", ")}.`,
    );
  }
  if (usesTransactionHeaders) {
    warnings.push(
      "Sales Transactions worksheet structure recognized; row values and Product/Customer references are validated during import.",
    );
  }

  const dataRows = nonEmptyRows(grid.slice(1));
  if (hasHeader && dataRows.length === 0) {
    warnings.push("Worksheet contains no data rows.");
  }

  const hasDataOutsideHeaders = dataRows.some((row) =>
    row.slice(headers.length).some((value) => cellToString(value).trim()),
  );
  if (hasDataOutsideHeaders) {
    warnings.push("Data was found in columns beyond the header row.");
  }

  let rowsAreValid = false;
  if (
    hasHeader &&
    requiredMissingHeaders.length === 0 &&
    duplicateHeaders.length === 0 &&
    dataRows.length > 0 &&
    !hasDataOutsideHeaders
  ) {
    if (usesTransactionHeaders) {
      rowsAreValid = true;
    } else {
      try {
        validateSalesRows(rowsToSalesRecords(headers, dataRows));
        rowsAreValid = true;
      } catch (error) {
        warnings.push(
          error instanceof Error
            ? `Sales validation failed: ${error.message}`
            : "Sales validation failed.",
        );
      }
    }
  }

  const salesHeaders = new Set<string>(
    usesTransactionHeaders
      ? Object.values(TRANSACTION_PREVIEW_HEADERS).flat()
      : SALES_CSV_HEADERS,
  );
  const extraHeaders = (
    usesTransactionHeaders ? normalizedHeaders : headers
  ).filter((header) => header && !salesHeaders.has(header));
  if (extraHeaders.length > 0) {
    warnings.push(
      `Additional columns are ignored by the sales importer: ${extraHeaders.join(", ")}.`,
    );
  }

  return {
    name,
    headers,
    rowCount: dataRows.length,
    previewRows: dataRows
      .slice(0, EXCEL_PREVIEW_ROW_LIMIT)
      .map((row) => headers.map((_header, index) => cellToString(row[index]))),
    supportedBySalesImporter:
      rowsAreValid && formulaCells.length === 0 && errorCells.length === 0,
    warnings,
  };
}

function getWorkbookSheetNames(workbook: XLSX.WorkBook): string[] {
  if (workbook.SheetNames.length === 0) {
    throw new ExcelParseError("The Excel workbook contains no worksheets.");
  }

  return workbook.SheetNames;
}

export function inspectSalesExcel(
  buffer: Buffer,
  fileName: string,
): ExcelWorkbookPreview {
  const workbook = readExcelWorkbook(buffer, fileName);
  const sheetNames = getWorkbookSheetNames(workbook);

  return {
    fileName,
    worksheetCount: sheetNames.length,
    worksheets: sheetNames.map((name) =>
      inspectWorksheet(name, workbook.Sheets[name]),
    ),
  };
}

export function parseSalesExcel(
  buffer: Buffer,
  fileName: string,
): SalesCsvRow[] {
  const workbook = readExcelWorkbook(buffer, fileName);
  const sheetNames = getWorkbookSheetNames(workbook);
  const inspectedWorksheets = sheetNames.map((name) =>
    inspectWorksheet(name, workbook.Sheets[name]),
  );

  if (sheetNames.length > 1) {
    const supportedSheets = inspectedWorksheets
      .filter((sheet) => sheet.supportedBySalesImporter)
      .map((sheet) => sheet.name);
    const supportedMessage = supportedSheets.length
      ? ` Sales-compatible worksheets: ${supportedSheets.join(", ")}.`
      : " No worksheets match the sales import format.";

    throw new ExcelParseError(
      `Multi-worksheet import is not supported. Detected worksheets: ${sheetNames.join(", ")}.${supportedMessage} Use the workbook preview endpoint to inspect the sheets.`,
    );
  }

  const firstSheetName = sheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  if (!worksheet || !worksheet["!ref"]) {
    throw new ExcelParseError("The first worksheet is empty.");
  }

  const grid = getSheetGrid(worksheet, firstSheetName);
  const headers = (grid[0] ?? []).map((value) => cellToString(value).trim());

  if (headers.length === 0 || headers.every((header) => !header)) {
    throw new ExcelParseError("The first worksheet must include a header row.");
  }

  if (new Set(headers).size !== headers.length) {
    throw new ExcelParseError(
      "The first worksheet contains duplicate headers.",
    );
  }

  const missingHeaders = SALES_CSV_HEADERS.filter(
    (header) => !headers.includes(header),
  );
  if (missingHeaders.length > 0) {
    throw new ExcelParseError(
      `Missing required Excel headers: ${missingHeaders.join(", ")}.`,
    );
  }

  const rows = nonEmptyRows(grid.slice(1));
  if (getFormulaCells(worksheet).length > 0) {
    throw new ExcelParseError(
      "Formula cells are not supported. Replace formulas with their values.",
    );
  }
  if (getErrorCells(worksheet).length > 0) {
    throw new ExcelParseError(
      "Excel error cells are not supported. Correct the worksheet values and retry.",
    );
  }

  return rows.map((values, index) => {
    if (
      values.slice(headers.length).some((value) => cellToString(value).trim())
    ) {
      throw new ExcelParseError(
        `Row ${index + 2}: data was found outside the header columns.`,
      );
    }

    return rowsToSalesRecords(headers, [values])[0];
  });
}
