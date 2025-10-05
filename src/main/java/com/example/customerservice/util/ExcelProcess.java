package com.example.customerservice.util;

import java.util.Arrays;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFColor;
import org.apache.poi.xssf.usermodel.XSSFFont;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

public class ExcelProcess {

    // formatting helpers/constants moved from UploadPackagesPayboxController
    public static final String ISUF_LOD = "איסוף: לוד";
    private static final java.util.List<String> BLANK_CUSTOMERS = Arrays.asList("זיוה סרי", "יוסף דיין", "דביר גילאור");
    private static final int[] COLUMN_SET_1 = { 0, 1, 2 };
    private static final int[] COLUMN_SET_2 = { 4, 5, 6 };
    private static final java.util.List<String> VALUES_TO_CLEAR_CONTENT = Arrays.asList("תוספות", "סך הכל");
    private static final java.util.List<Integer> COLUMNS_TO_CLEAR_VALUES = Arrays.asList(2, 6);
    private static final java.util.List<Integer> COLUMNS_TO_INVISIBLE = Arrays.asList(2, 6);
    private static final java.util.List<String> SUBS_TO_REMOVE = Arrays.asList("מעוטף עזה ", "(לא חסלט)",
            "נא לפתוח את ההערה",
            "כ1.5 ק\"ג בסלסלה",
            "מעולות", "גדול להשיג", " בשקית", "כשרות אפרתי", "(סלסלה קטנה)", "נקי מחרקים", "ישראלי ואיכותי", "מחיר ",
            "בחזקת ניקיון כמו");

    // reusable styles
    private static CellStyle whiteFontStyle;
    private static CellStyle bold13Font;
    private static XSSFFont boldFont;

    public static void initializeStyles(Workbook workbook) {
        if (whiteFontStyle == null) {
            XSSFFont whiteFont = ((XSSFWorkbook) workbook).createFont();
            whiteFont.setColor(new XSSFColor(new byte[] { (byte) 255, (byte) 255, (byte) 255 }, null));
            whiteFontStyle = workbook.createCellStyle();
            whiteFontStyle.setFont(whiteFont);

            boldFont = ((XSSFWorkbook) workbook).createFont();
            boldFont.setBold(true);
            boldFont.setFontHeightInPoints((short) 13);
            bold13Font = workbook.createCellStyle();
            bold13Font.setFont(boldFont);
        }
    }

    public static void blankCustomers(Sheet ordersSheet) {
        // apply formatting changes (moved from UploadPackagesPayboxController)
        for (int r = ordersSheet.getFirstRowNum(); r <= ordersSheet.getLastRowNum(); r++) {
            for (String blankCustomer : BLANK_CUSTOMERS) {
                blankColumn(ordersSheet, COLUMN_SET_1, blankCustomer, r);
                blankColumn(ordersSheet, COLUMN_SET_2, blankCustomer, r);
            }
        }
    }

    public static boolean blankColumn(Sheet sheet, int[] columnIndices, String blankCustomer, int startRow) {
        Row startRowObj = sheet.getRow(startRow);
        if (startRowObj == null)
            return false;
        Cell firstCell = startRowObj.getCell(columnIndices[0]);
        String cellValue = getCellValueAsString(firstCell);
        if (cellValue != null && cellValue.contains(blankCustomer)) {
            setFontColorToWhite(firstCell);
            for (int r = startRow + 1; r <= sheet.getLastRowNum(); r++) {
                Row currentRow = sheet.getRow(r);
                if (currentRow == null)
                    continue;
                Cell firstCellOfRow = currentRow.getCell(columnIndices[0]);
                String currentRowValue = getCellValueAsString(firstCellOfRow);
                if (currentRowValue != null && currentRowValue.contains(ISUF_LOD)) {
                    return true;
                }
                for (int colIndex : columnIndices) {
                    Cell cellToBlank = currentRow.getCell(colIndex);
                    if (cellToBlank == null)
                        cellToBlank = currentRow.createCell(colIndex, CellType.BLANK);
                    setFontColorToWhite(cellToBlank);
                }
            }
            return true;
        }
        return false;
    }

    public static void clearSpecificValues(Sheet sheet) {
        for (Row row : sheet) {
            for (Cell cell : row) {
                if (cell.getCellType() == CellType.STRING
                        && VALUES_TO_CLEAR_CONTENT.contains(cell.getStringCellValue())) {
                    setFontColorToWhite(cell);
                }
            }
        }
    }

    public static void clearNonMergedCellValuesInColumns(Sheet sheet) {
        java.util.List<CellRangeAddress> mergedRegions = sheet.getMergedRegions();
        for (int r = sheet.getFirstRowNum(); r <= sheet.getLastRowNum(); r++) {
            Row row = sheet.getRow(r);
            if (row == null)
                continue;
            for (int colIndex : COLUMNS_TO_CLEAR_VALUES) {
                Cell cell = row.getCell(colIndex);
                if (cell == null)
                    continue;
                boolean isMerged = false;
                for (CellRangeAddress range : mergedRegions) {
                    if (range.isInRange(r, colIndex)) {
                        isMerged = true;
                        break;
                    }
                }
                if (!isMerged) {
                    setFontColorToWhite(cell);
                }
            }
        }
    }

    public static void makeColumnsInvisible(Sheet sheet) {
        for (int colIndex : COLUMNS_TO_INVISIBLE) {
            for (Row row : sheet) {
                Cell cell = row.getCell(colIndex);
                if (cell == null)
                    cell = row.createCell(colIndex, CellType.BLANK);
                setFontColorToWhite(cell);
            }
        }
    }

    @SuppressWarnings("deprecation")
    public static void setPageSetup(Sheet sheet) {
        sheet.getPrintSetup().setPaperSize(org.apache.poi.ss.usermodel.PrintSetup.A4_PAPERSIZE);
        sheet.getPrintSetup().setLandscape(false);
        sheet.setMargin(Sheet.LeftMargin, 0.1);
        sheet.setMargin(Sheet.RightMargin, 0.7);
        sheet.setMargin(Sheet.TopMargin, 0.75);
        sheet.setMargin(Sheet.BottomMargin, 0.75);
        sheet.setMargin(Sheet.HeaderMargin, 0.1);
        sheet.setMargin(Sheet.FooterMargin, 0.1);
    }

    public static void setColumnWidths(Sheet sheet) {
        sheet.setColumnWidth(1, 10 * 256);
        sheet.setColumnWidth(2, 1 * 256);
        sheet.setColumnWidth(3, 19 * 256);
        sheet.setColumnWidth(5, 10 * 256);
        sheet.setColumnWidth(6, 1 * 256);
    }

    public static void boldQuantities(Sheet sheet) {
        for (int r = 1; r <= sheet.getLastRowNum(); r++) {
            Row row = sheet.getRow(r);
            if (row == null)
                continue;
            Cell checkCellB = row.getCell(1);
            Cell adjCellA = row.getCell(0);
            Cell checkCellF = row.getCell(5);
            Cell adjCellE = row.getCell(4);
            if (checkCellB != null) {
                String cellValue = getCellValueAsString(checkCellB);
                if (cellValue.contains("יח'") && !cellValue.contains("1") && !cellValue.contains("0")) {
                    setBold13Font(checkCellB);
                    if (adjCellA != null)
                        setBold13Font(adjCellA);
                }
            }
            if (checkCellF != null) {
                String cellValue = getCellValueAsString(checkCellF);
                if (cellValue.contains("יח'") && !cellValue.contains("1") && !cellValue.contains("0")) {
                    setBold13Font(checkCellF);
                    if (adjCellE != null)
                        setBold13Font(adjCellE);
                }
            }
        }
    }

    public static void cleanupItemNames(Sheet sheet) {
        for (int r = 1; r <= sheet.getLastRowNum(); r++) {
            Row row = sheet.getRow(r);
            if (row == null)
                continue;
            for (int colIndex : new int[] { 0, 4 }) {
                Cell cell = row.getCell(colIndex);
                if (cell == null || cell.getCellType() != CellType.STRING)
                    continue;
                String value = cell.getStringCellValue();
                if (value == null)
                    continue;
                for (String sub : SUBS_TO_REMOVE)
                    value = value.replace(sub, "");
                if (value.contains("תפו\"א אדום") && !value.contains("(אדום)")) {
                    value = "(אדום) " + value;
                    setBold13Font(cell);
                }
                if (value.contains("חרמון"))
                    value = value.replace("חרמון", "(אדום) חרמון");
                cell.setCellValue(value.trim());
            }
        }
    }

    public static String getCellValueAsString(Cell cell) {
        if (cell == null)
            return "";
        switch (cell.getCellType()) {
            case STRING:
                return cell.getStringCellValue();
            case NUMERIC:
                return String.valueOf(cell.getNumericCellValue());
            case BOOLEAN:
                return String.valueOf(cell.getBooleanCellValue());
            case FORMULA:
                try {
                    return cell.getStringCellValue();
                } catch (IllegalStateException e) {
                    return cell.getCellFormula();
                }
            case BLANK:
                return "";
            default:
                return "";
        }
    }

    public static float strToFloat(String s) {
        try {
            String cleaned = s.replaceAll("[^0-9.-]", "");
            return (float) Math.round(Double.parseDouble(cleaned) * 1000.0) / 1000;
        } catch (Exception e) {
            return 0f;
        }
    }

    public static void setFontColorToWhite(Cell cell) {
        if (cell == null)
            return;
        // Not merged: clear this cell
        try {
            cell.setBlank();
        } catch (NoSuchMethodError | UnsupportedOperationException e) {
            cell.setCellType(CellType.BLANK);
        }
    }

    public static void setBold13Font(Cell cell) {
        if (cell != null) {
            Workbook wb = cell.getSheet().getWorkbook();
            CellStyle orig = cell.getCellStyle();
            CellStyle ns = wb.createCellStyle();
            ns.cloneStyleFrom(orig);
            ns.setFont(boldFont);
            cell.setCellStyle(ns);
        }
    }

}
