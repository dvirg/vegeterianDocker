package com.example.customerservice.web;

import com.example.customerservice.model.Customer;
import com.example.customerservice.service.CustomerService;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.*;

import java.util.Optional;

@Controller
@RequestMapping("/customers")
public class CustomerController {
    private final CustomerService service;

    public CustomerController(CustomerService service) {
        this.service = service;
    }

    @GetMapping
    public String list(Model model) {
        model.addAttribute("customers", service.findAll());
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
        csv.append("id,name,phones,address,email,defaultPackage,metadata\n");
        for (Customer c : customers) {
            String name = c.getName() == null ? "" : c.getName().replaceAll("[\\n\\r]", "").replace("\"", "\"\"");
            String phones = c.getPhones() == null ? "" : c.getPhones().replaceAll("[\\n\\r]", "").replace("\"", "\"\"");
            String address = c.getAddress() == null ? ""
                    : c.getAddress().replaceAll("[\\n\\r]", "").replace("\"", "\"\"");
            String email = c.getEmail() == null ? "" : c.getEmail().replaceAll("[\\n\\r]", "").replace("\"", "\"\"");
            String def = c.getDefaultPackage() == null ? "" : c.getDefaultPackage().name();
            String metadata = c.getMetadata() == null ? ""
                    : c.getMetadata().replaceAll("[\\n\\r]", "").replace("\"", "\"\"");
            csv.append(String.format("%s,%s,%s,%s,%s,%s,%s\n", c.getId(), name, phones, address, email, def, metadata));
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
}
