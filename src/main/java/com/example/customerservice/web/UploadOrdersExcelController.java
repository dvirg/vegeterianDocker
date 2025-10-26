package com.example.customerservice.web;

import com.example.customerservice.model.Customer;
import com.example.customerservice.model.Item;
import com.example.customerservice.model.Item.ItemType;
import com.example.customerservice.model.Order;
import com.example.customerservice.model.OrderItem;
import com.example.customerservice.service.CustomerService;
import com.example.customerservice.service.ItemService;
import com.example.customerservice.service.OrderItemService;
import com.example.customerservice.service.OrderService;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

import java.io.InputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.time.LocalDate;
import java.time.Instant;
import java.time.ZoneId;
import java.util.Arrays;
import java.util.Comparator;
import java.util.Iterator;
import static com.example.customerservice.util.ExcelProcess.*;

@Controller
@RequestMapping("/upload-orders-excel")
public class UploadOrdersExcelController {
    private final ItemService itemService;
    private final CustomerService customerService;
    private final OrderService orderService;
    private final OrderItemService orderItemService;
    private final com.example.customerservice.service.ImportService importService;

    public UploadOrdersExcelController(ItemService itemService, CustomerService customerService,
            OrderService orderService, OrderItemService orderItemService,
            com.example.customerservice.service.ImportService importService) {
        this.itemService = itemService;
        this.customerService = customerService;
        this.orderService = orderService;
        this.orderItemService = orderItemService;
        this.importService = importService;
    }

    @GetMapping
    public String form() {
        return "upload-orders-excel";
    }

    @PostMapping
    public String handleUpload(@RequestParam("file") MultipartFile file, RedirectAttributes redirectAttrs) {
        if (file == null || file.isEmpty()) {
            redirectAttrs.addFlashAttribute("message", "Please select a file to upload.");
            return "redirect:/upload-orders-excel";
        }

        // Persist uploaded orders file to uploaded_excels folder with timestamped name
        File savedFile = null;
        try {
            String ordersFolder = "uploaded_excels";
            File folder = new File(ordersFolder);
            if (!folder.exists())
                folder.mkdirs();

            // Save uploaded file bytes directly to disk to avoid corrupting the ZIP stream
            String savedName = "items_orders_" + (new SimpleDateFormat("yyyyMMdd_HHmmss").format(new Date())) + ".xlsx";
            savedFile = new File(folder, savedName);
            try {
                // Use transferTo which is safe and writes the raw uploaded bytes
                file.transferTo(savedFile);

                // Open saved file for formatting
                try (XSSFWorkbook workbookForSave = new XSSFWorkbook(savedFile)) {
                    Sheet ordersSheet = workbookForSave.getSheetAt(0);

                    blankCustomers(ordersSheet);
                    clearSpecificValues(ordersSheet);
                    clearNonMergedCellValuesInColumns(ordersSheet);
                    makeColumnsInvisible(ordersSheet);
                    cleanupItemNames(ordersSheet);
                    boldQuantities(ordersSheet);
                    setColumnWidths(ordersSheet);
                    setPageSetup(ordersSheet);

                    // Overwrite saved file with formatted workbook
                    try (FileOutputStream fos = new FileOutputStream(savedFile)) {
                        workbookForSave.write(fos);
                    }
                }
            } catch (Exception e) {
                // If transfer fails, fall back to saving via stream copy (less preferred)
                try (InputStream fin = file.getInputStream(); FileOutputStream fos = new FileOutputStream(savedFile)) {
                    fin.transferTo(fos);
                }
            }

            // Keep only the 5 most recent items_orders_*.xlsx files
            File[] versions = folder
                    .listFiles((dir, name) -> name.startsWith("items_orders_") && name.endsWith(".xlsx"));
            if (versions != null && versions.length > 5) {
                Arrays.sort(versions, Comparator.comparingLong(File::lastModified).reversed());
                for (int i = 5; i < versions.length; i++) {
                    try {
                        versions[i].delete();
                    } catch (Exception ignored) {
                    }
                }
            }
        } catch (Exception ex) {
            // Non-fatal: log and continue processing the workbook
            ex.printStackTrace();
        }

        try (InputStream in = new java.io.FileInputStream(savedFile); XSSFWorkbook workbook = new XSSFWorkbook(in)) {
            Sheet sheet = workbook.getSheetAt(0);
            int[][] columns = new int[][] { { 0, 1, 2 }, { 4, 5, 6 } };

            java.util.List<OrderItem> orderItemsToSave = new java.util.ArrayList<>();
            java.util.List<Item> itemsToSave = new java.util.ArrayList<>();
            java.util.List<Order> ordersToSave = new java.util.ArrayList<>();
            java.util.List<Customer> customersToSave = new java.util.ArrayList<>();

            // determine upload timestamp from saved file metadata (fallback to now)
            java.time.LocalDateTime uploadDateTime = java.time.LocalDateTime.ofInstant(
                    Instant.ofEpochMilli(savedFile != null ? savedFile.lastModified() : System.currentTimeMillis()),
                    ZoneId.systemDefault());

            for (int[] colSet : columns) {
                Iterator<Row> rowIterator = sheet.iterator();
                Customer currentCustomerEntity = null;
                Order currentOrderEntity = null;

                while (rowIterator.hasNext()) {
                    Row row = rowIterator.next();
                    Cell firstCell = row.getCell(colSet[0]);

                    if (firstCell != null && firstCell.getCellType() == CellType.STRING &&
                            firstCell.getStringCellValue().contains("איסוף: לוד")) {

                        String[] parts = firstCell.getStringCellValue().split("איסוף: לוד");
                        String currentCustomerName = parts.length > 0 ? parts[0].trim() : null;
                        String phone = parts.length > 1 ? parts[1].trim() : "";

                        if (currentCustomerName != null && !currentCustomerName.isEmpty()) {
                            // find existing in parsed list first, then in DB
                            Customer existing = customersToSave.stream()
                                    .filter(c -> c.getName().equalsIgnoreCase(currentCustomerName))
                                    .findFirst().orElse(null);
                            if (existing == null) {
                                existing = customerService.findAll().stream()
                                        .filter(c -> c.getName().equalsIgnoreCase(currentCustomerName))
                                        .findFirst().orElse(null);
                            }
                            if (existing == null) {
                                Customer nc = new Customer();
                                nc.setName(currentCustomerName);
                                nc.setPhones(phone);
                                customersToSave.add(nc);
                                currentCustomerEntity = nc;
                            } else {
                                currentCustomerEntity = existing;
                            }

                            Order newOrder = new Order();
                            newOrder.setCustomer(currentCustomerEntity);
                            newOrder.setDate(LocalDate.now());
                            newOrder.setUploadedAt(uploadDateTime);
                            ordersToSave.add(newOrder);
                            currentOrderEntity = newOrder;
                        } else {
                            currentCustomerEntity = null;
                            currentOrderEntity = null;
                        }

                    } else if (currentCustomerEntity != null && currentOrderEntity != null) {
                        Cell productCell = row.getCell(colSet[0]);
                        Cell quantityCell = row.getCell(colSet[1]);
                        Cell priceCell = row.getCell(colSet[2]);

                        if (productCell != null && quantityCell != null && priceCell != null &&
                                productCell.getCellType() == CellType.STRING &&
                                !"מוצר".equals(productCell.getStringCellValue()) &&
                                !productCell.getStringCellValue().isEmpty()) {

                            String product = productCell.getStringCellValue().replace("\"", "");
                            String quantityStr = quantityCell.getCellType() == CellType.STRING
                                    ? quantityCell.getStringCellValue()
                                    : String.valueOf(quantityCell.getNumericCellValue());

                            float quantity = strToFloat(quantityStr.split(" ")[0].trim());
                            float totalValue = strToFloat(priceCell.getStringCellValue());
                            float pricePerUnitOrKg = quantity != 0 ? totalValue / quantity : 0f;
                            ItemType itemType = quantityStr.contains("יח") ? ItemType.unit : ItemType.kg;

                            Item item = itemsToSave.stream()
                                    .filter(i -> i.getName().equalsIgnoreCase(product))
                                    .findFirst().orElse(null);
                            if (item == null) {
                                Item ni = new Item();
                                ni.setName(product);
                                ni.setPrice(pricePerUnitOrKg);
                                ni.setType(itemType);
                                ni.setAvailable(false);
                                ni.setMetadata("Imported");
                                if (quantity != 0 && pricePerUnitOrKg > 0) {
                                    itemsToSave.add(ni);
                                    item = ni;
                                }
                            }

                            boolean valid = (quantity != 0 && pricePerUnitOrKg > 0) && item != null;
                            if (valid) {
                                OrderItem oi = new OrderItem();
                                oi.setOrder(currentOrderEntity);
                                oi.setItem(item);
                                oi.setAmount(quantity);
                                oi.setTotalPrice(totalValue);
                                orderItemsToSave.add(oi);
                            }
                        }
                    }
                }
            }

            // Now perform transactional replace
            importService.replaceAll(customersToSave, itemsToSave, ordersToSave, orderItemsToSave);

            redirectAttrs.addFlashAttribute("message", "Excel processed and data imported.");
        } catch (Exception ex) {
            redirectAttrs.addFlashAttribute("message", "Error processing file: " + ex.getMessage());
        }

        return "redirect:/upload-packages-paybox";
    }

    // --- end helpers ---
}
