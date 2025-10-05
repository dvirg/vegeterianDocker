package com.example.customerservice.web;

import com.example.customerservice.model.Customer;
import com.example.customerservice.service.CustomerService;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;
import jakarta.servlet.http.HttpSession;
import java.util.ArrayList;
import java.util.List;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;

@Controller
@RequestMapping("/upload-customers-csv")
public class UploadController {
    private final CustomerService customerService;

    public UploadController(CustomerService customerService) {
        this.customerService = customerService;
    }

    @GetMapping
    public String form(Model model) {
        return "upload-customers-csv";
    }

    @PostMapping("/preview")
    public String handleUploadPreview(@RequestParam("file") MultipartFile file, RedirectAttributes redirectAttrs,
            HttpSession session) {
        if (file == null || file.isEmpty()) {
            redirectAttrs.addFlashAttribute("message", "Please select a file to upload.");
            return "redirect:/upload-customers-csv";
        }
        List<Customer> parsed = new ArrayList<>();
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            boolean first = true;
            while ((line = reader.readLine()) != null) {
                if (first) {
                    first = false;
                    continue;
                }
                String[] parts = line.split(",");
                if (parts.length < 3)
                    continue;
                String name = parts[0].trim();
                if (parts.length > 1 && !parts[1].trim().isEmpty())
                    name = name + " " + parts[1].trim();
                String phone = parts[2].trim();
                if (!phone.startsWith("0"))
                    phone = "0" + phone;
                String address = parts.length > 3 ? parts[3].trim() : "";
                Customer customer = new Customer();
                customer.setName(name);
                customer.setPhones(phone);
                customer.setAddress(address);
                parsed.add(customer);
            }
            // store parsed list in session for preview
            session.setAttribute("csv_preview", parsed);
            redirectAttrs.addFlashAttribute("message", parsed.size() + " rows parsed. Preview and confirm to save.");
        } catch (Exception ex) {
            redirectAttrs.addFlashAttribute("message", "Error processing file: " + ex.getMessage());
            return "redirect:/upload-customers-csv";
        }
        return "redirect:/upload-customers-csv/preview";
    }

    @GetMapping("/preview")
    public String preview(HttpSession session, Model model) {
        List<Customer> parsed = (List<Customer>) session.getAttribute("csv_preview");
        if (parsed == null) {
            model.addAttribute("message", "No uploaded data to preview.");
            return "upload-customers-csv";
        }
        model.addAttribute("parsed", parsed);
        return "upload-customers-csv-preview";
    }

    @PostMapping("/confirm")
    public String confirm(HttpSession session, RedirectAttributes redirectAttrs) {
        List<Customer> parsed = (List<Customer>) session.getAttribute("csv_preview");
        if (parsed == null) {
            redirectAttrs.addFlashAttribute("message", "No data to save.");
            return "redirect:/upload-customers-csv";
        }
        int count = 0;
        for (Customer c : parsed) {
            customerService.save(c);
            count++;
        }
        session.removeAttribute("csv_preview");
        redirectAttrs.addFlashAttribute("message", count + " customers added.");
        return "redirect:/customers";
    }
}
