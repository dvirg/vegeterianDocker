package com.example.customerservice.web;

import com.example.customerservice.model.Customer;
import com.example.customerservice.model.CustomerSearchResult;
import com.example.customerservice.service.CustomerService;
import com.example.customerservice.service.OrderService;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Comparator;
import java.util.Optional;

@Controller
@RequestMapping("/customers")
public class CustomerController {
    private final CustomerService service;
    private final OrderService orderService;

    public CustomerController(CustomerService service, OrderService orderService) {
        this.service = service;
        this.orderService = orderService;
    }

    @GetMapping
    public String list(Model model) {
        List<Customer> customers = service.findAll();
        // sort by id descending (highest id first)
        customers.sort(Comparator.comparing(Customer::getId).reversed());
        model.addAttribute("customers", customers);
        model.addAttribute("customer", new Customer());
        model.addAttribute("types", Customer.PackageType.values());
        return "customers/list";
    }

    @GetMapping("/new")
    public String createForm(Model model) {
        model.addAttribute("customer", new Customer());
        model.addAttribute("types", Customer.PackageType.values());
        return "customers/form";
    }

    @PostMapping
    public String create(@ModelAttribute Customer customer, BindingResult br) {
        if (br.hasErrors())
            return "customers/form";
        service.save(customer);
        return "redirect:/customers";
    }

    @PostMapping("/delete-all")
    public String deleteAll() {
        service.deleteAll();
        return "redirect:/customers";
    }

    @GetMapping("/export")
    public org.springframework.http.ResponseEntity<org.springframework.core.io.InputStreamResource> exportCsv() {
        java.util.List<Customer> customers = service.findAll();
        StringBuilder csv = new StringBuilder();
        csv.append("name,phones,address\n");
        for (Customer c : customers) {
            String name = c.getName() == null ? "" : c.getName().replaceAll("[\\n\\r]", "").replace("\"", "\"\"");
            String phones = c.getPhones() == null ? "" : c.getPhones().replaceAll("[\\n\\r]", "").replace("\"", "\"\"");
            String address = c.getAddress() == null ? ""
                    : c.getAddress().replaceAll("[\\n\\r]", "").replace("\"", "\"\"");
            csv.append(String.format("%s,%s,%s\n", name, phones, address));
        }
        java.io.ByteArrayInputStream is = new java.io.ByteArrayInputStream(
                csv.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
        org.springframework.core.io.InputStreamResource resource = new org.springframework.core.io.InputStreamResource(
                is);
        return org.springframework.http.ResponseEntity.ok()
                .header(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=customers.csv")
                .contentType(org.springframework.http.MediaType.parseMediaType("text/csv"))
                .body(resource);
    }

    @GetMapping("/edit/{id}")
    public String editForm(@PathVariable Long id, Model model) {
        Optional<Customer> c = service.findById(id);
        if (c.isEmpty())
            return "redirect:/customers";
        model.addAttribute("customer", c.get());
        model.addAttribute("types", Customer.PackageType.values());
        return "customers/form";
    }

    @PostMapping("/delete/{id}")
    public String delete(@PathVariable Long id) {
        service.deleteById(id);
        return "redirect:/customers";
    }

    @GetMapping("/search-by-names")
    public String searchByNamesForm(Model model) {
        model.addAttribute("names", "");
        model.addAttribute("results", java.util.Collections.emptyList());
        return "customers/search-by-names";
    }

    @PostMapping("/search-by-names")
    public String searchByNamesSubmit(@RequestParam("names") String names, Model model) {
        // split by lines, trim and ignore empty
        String[] lines = names == null ? new String[0] : names.split("\\r?\\n");
        java.util.Set<com.example.customerservice.model.Customer> found = new java.util.LinkedHashSet<>();
        for (String line : lines) {
            String token = line == null ? "" : line.trim();
            if (token.isEmpty())
                continue;
            java.util.List<com.example.customerservice.model.Customer> part = orderService
                    .findDistinctCustomersByNameContaining(token);
            if (part != null)
                found.addAll(part);
        }

        java.util.List<CustomerSearchResult> results = new java.util.ArrayList<>();
        for (com.example.customerservice.model.Customer c : found) {
            java.time.LocalDateTime uploadedAt = null;
            if (c.getId() != null) {
                uploadedAt = orderService.findLatestUploadTimestampForCustomer(c.getId());
            }
            results.add(new CustomerSearchResult(c.getName(), c.getPhones(), uploadedAt));
        }

        model.addAttribute("names", names);
        model.addAttribute("results", results);
        return "customers/search-by-names";
    }
}
