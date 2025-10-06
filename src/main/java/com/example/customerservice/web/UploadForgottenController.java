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

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Controller
@RequestMapping("/upload-forgotten-orders-csv")
public class UploadForgottenController {
    private final CustomerService customerService;

    public UploadForgottenController(CustomerService customerService) {
        this.customerService = customerService;
    }

    @GetMapping
    public String form(Model model) {
        return "upload-forgotten-orders-csv";
    }

    @PostMapping("/process")
    public String process(@RequestParam("file") MultipartFile file, RedirectAttributes redirectAttrs, Model model) {
        if (file == null || file.isEmpty()) {
            redirectAttrs.addFlashAttribute("message", "Please select a file to upload.");
            return "redirect:/upload-forgotten-orders-csv";
        }

        Set<String> forgottenNames = new HashSet<>();
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
                String fullName = parts[1].trim() + " " + parts[2].trim();
                forgottenNames.add(fullName);
            }

            List<Customer> forgottenCustomers = customerService.findAll().stream()
                    .filter(c -> c.getName() != null && forgottenNames.contains(c.getName()))
                    .collect(Collectors.toList());

            model.addAttribute("results", forgottenCustomers);
            model.addAttribute("count", forgottenCustomers.size());
            return "upload-forgotten-orders-csv";

        } catch (Exception ex) {
            redirectAttrs.addFlashAttribute("message", "Error processing file: " + ex.getMessage());
            return "redirect:/upload-forgotten-orders-csv";
        }
    }
}
