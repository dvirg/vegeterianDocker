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
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

import java.io.InputStream;
import java.time.LocalDate;
import java.util.Iterator;

@Controller
@RequestMapping("/upload-orders-excel")
public class UploadOrdersExcelController {
    private final ItemService itemService;
    private final CustomerService customerService;
    private final OrderService orderService;
    private final OrderItemService orderItemService;

    public UploadOrdersExcelController(ItemService itemService, CustomerService customerService,
            OrderService orderService, OrderItemService orderItemService) {
        this.itemService = itemService;
        this.customerService = customerService;
        this.orderService = orderService;
        this.orderItemService = orderItemService;
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

        try (InputStream in = file.getInputStream(); XSSFWorkbook workbook = new XSSFWorkbook(in)) {
            // Clear existing data as the old Vaadin code did
            itemService.deleteAllItems();
            orderItemService.deleteAllOrderItems();
            orderService.deleteAllOrders();

            Sheet sheet = workbook.getSheetAt(0);
            int[][] columns = new int[][] { { 0, 1, 2 }, { 4, 5, 6 } };

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
                            // find existing
                            Customer existing = customerService.findAll().stream()
                                    .filter(c -> c.getName().equalsIgnoreCase(currentCustomerName))
                                    .findFirst().orElse(null);
                            if (existing == null) {
                                Customer nc = new Customer();
                                nc.setName(currentCustomerName);
                                nc.setPhones(phone);
                                customerService.save(nc);
                                currentCustomerEntity = nc;
                            } else {
                                currentCustomerEntity = existing;
                            }

                            Order newOrder = new Order();
                            newOrder.setCustomer(currentCustomerEntity);
                            newOrder.setDate(LocalDate.now());
                            currentOrderEntity = orderService.save(newOrder);
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

                            Item item = itemService.findAll().stream()
                                    .filter(i -> i.getName().equalsIgnoreCase(product))
                                    .findFirst().orElseGet(() -> {
                                        Item ni = new Item();
                                        ni.setName(product);
                                        ni.setPrice(pricePerUnitOrKg);
                                        ni.setType(itemType);
                                        ni.setAvailable(false);
                                        ni.setMetadata("Imported");
                                        return (quantity != 0 && pricePerUnitOrKg > 0) ? itemService.save(ni) : null;
                                    });

                            boolean valid = (quantity != 0 && pricePerUnitOrKg > 0) && item != null;
                            if (valid) {
                                OrderItem oi = new OrderItem();
                                oi.setOrder(currentOrderEntity);
                                oi.setItem(item);
                                oi.setAmount(quantity);
                                oi.setTotalPrice(totalValue);
                                orderItemService.save(oi);
                            }
                        }
                    }
                }
            }

            redirectAttrs.addFlashAttribute("message", "Excel processed and data imported.");
        } catch (Exception ex) {
            redirectAttrs.addFlashAttribute("message", "Error processing file: " + ex.getMessage());
        }

        return "redirect:/customers";
    }

    private float strToFloat(String s) {
        try {
            String cleaned = s.replaceAll("[^0-9.-]", "");
            return (float) Math.round(Double.parseDouble(cleaned) * 1000.0) / 1000;
        } catch (Exception e) {
            return 0f;
        }
    }
}
