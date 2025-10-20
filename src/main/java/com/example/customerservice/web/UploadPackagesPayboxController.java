package com.example.customerservice.web;

import com.example.customerservice.model.Customer;
import com.example.customerservice.service.CustomerService;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

import java.io.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import static com.example.customerservice.util.ExcelProcess.*;

@Controller
@RequestMapping("/upload-packages-paybox")
public class UploadPackagesPayboxController {

    private final CustomerService customerService;
    private final String ordersFolder = "uploaded_excels";

    public UploadPackagesPayboxController(CustomerService customerService) {
        this.customerService = customerService;
    }

    @GetMapping
    public String form(org.springframework.ui.Model model) {
        File latest = getLatestOrdersFile();
        model.addAttribute("hasLatestOrders", latest != null);
        return "upload-packages-paybox";
    }

    @GetMapping("/download-orders-file")
    public ResponseEntity<InputStreamResource> downloadLatestOrders() throws IOException {
        File latest = getLatestOrdersFile();
        if (latest == null) {
            return ResponseEntity.notFound().build();
        }
        InputStreamResource resource = new InputStreamResource(new FileInputStream(latest));
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + latest.getName() + "\"")
                .contentLength(latest.length())
                .contentType(
                        MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(resource);
    }

    @PostMapping
    public String handleUpload(@RequestParam("file") MultipartFile file, RedirectAttributes redirectAttrs) {
        if (file == null || file.isEmpty()) {
            redirectAttrs.addFlashAttribute("alerts", "Please select a file to upload.");
            return "redirect:/upload-packages-paybox";
        }

        try (InputStream in = file.getInputStream()) {
            String alerts = processPackagesExcel(in);
            redirectAttrs.addFlashAttribute("alerts", alerts == null ? "" : alerts);
        } catch (Exception e) {
            redirectAttrs.addFlashAttribute("alerts", "Failed to process packages Excel: " + e.getMessage());
        }

        return "redirect:/upload-packages-paybox";
    }

    private File getLatestOrdersFile() {
        File folder = new File(ordersFolder);
        File[] files = folder.listFiles((dir, name) -> name.startsWith("items_orders_") && name.endsWith(".xlsx"));
        if (files == null || files.length == 0)
            return null;
        return Arrays.stream(files).max(Comparator.comparingLong(File::lastModified)).orElse(null);
    }

    private String processPackagesExcel(InputStream packagesInput) throws Exception {
        File ordersFile = getLatestOrdersFile();
        if (ordersFile == null)
            return "No orders file found to update.";
        StringBuilder alerts = new StringBuilder();

        try (Workbook ordersWorkbook = new XSSFWorkbook(new FileInputStream(ordersFile))) {
            try (Workbook packagesWorkbook = new XSSFWorkbook(packagesInput)) {
                initializeStyles(ordersWorkbook);
                Sheet packagesSheet = packagesWorkbook.getSheetAt(0);
                Sheet ordersSheet = ordersWorkbook.getSheetAt(0);

                List<Customer> allCustomers = customerService.findAll();

                for (int r = packagesSheet.getLastRowNum(); r >= 0; r--) {
                    Row row = packagesSheet.getRow(r);
                    if (row == null)
                        continue;
                    Cell nameCell = row.getCell(0);
                    Cell phoneCell = row.getCell(1);
                    Cell typeCell = row.getCell(6);
                    Cell paymentCell = row.getCell(2);
                    Cell dateCell = row.getCell(4);
                    if (nameCell == null || phoneCell == null || typeCell == null || paymentCell == null
                            || dateCell == null)
                        continue;
                    if (!"payment".equalsIgnoreCase(paymentCell.getStringCellValue().trim()))
                        continue;
                    String dateStr = getCellValueAsString(dateCell).trim();
                    LocalDateTime paymentDate;
                    try {
                        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
                        paymentDate = LocalDateTime.parse(dateStr, formatter);
                    } catch (Exception ex) {
                        continue;
                    }
                    LocalDate today = LocalDate.now().minusDays(8);
                    LocalDate lastThursday = today.with(java.time.DayOfWeek.THURSDAY);
                    if (!lastThursday.isBefore(today))
                        lastThursday = lastThursday.minusWeeks(1);
                    if (paymentDate.toLocalDate().isBefore(lastThursday))
                        break;
                    String phone = phoneCell.getStringCellValue().replace("972-", "0").trim();
                    String customerName = nameCell.getStringCellValue().trim();
                    String packageType = typeCell.getStringCellValue().trim();

                    Customer matchedCustomer = allCustomers.stream()
                            .filter(c -> c.getPhones() != null && c.getPhones().contains(phone))
                            .findFirst().orElse(null);

                    if (matchedCustomer == null) {
                        alerts.append("Customer ").append(customerName).append(" with phone ").append(phone)
                                .append(" was not found\n");
                        continue;
                    }

                    boolean updated = false;
                    for (Row orderRow : ordersSheet) {
                        for (Cell cell : orderRow) {
                            if (cell.getCellType() == CellType.STRING
                                    && cell.getStringCellValue().contains(matchedCustomer.getName())) {
                                String updatedValue = cell.getStringCellValue();
                                if ("אריזה".equalsIgnoreCase(packageType)) {
                                    updatedValue = updatedValue.replace(ISUF_LOD, "אריזה");
                                } else if ("משלוח".equalsIgnoreCase(packageType)) {
                                    String address = matchedCustomer.getAddress();
                                    if (address == null || address.isEmpty()) {
                                        alerts.append("Customer ").append(matchedCustomer.getName())
                                                .append(" has no address\n");
                                    }
                                    updatedValue = updatedValue.replace(ISUF_LOD,
                                            "משלוח ל" + (address != null ? address : ""));
                                }
                                cell.setCellValue(updatedValue);
                                updated = true;
                                break;
                            }
                        }
                        if (updated)
                            break;
                    }
                    if (!updated)
                        alerts.append("Order for customer ").append(matchedCustomer.getName())
                                .append(" was not found\n");
                }

                blankCustomers(ordersSheet);
                clearSpecificValues(ordersSheet);
                clearNonMergedCellValuesInColumns(ordersSheet);
                makeColumnsInvisible(ordersSheet);
                cleanupItemNames(ordersSheet);
                boldQuantities(ordersSheet);
                setColumnWidths(ordersSheet);
                setPageSetup(ordersSheet);

                String timestamp = new java.text.SimpleDateFormat("yyyyMMdd_HHmmss").format(new Date());
                String newFileName = "items_orders_" + timestamp + ".xlsx";
                File updatedFile = new File(ordersFolder, newFileName);
                try (FileOutputStream fos = new FileOutputStream(updatedFile)) {
                    ordersWorkbook.write(fos);
                }
            }
        }

        return "";
    }

    private static String getCellValueAsString(Cell cell) {
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
}
