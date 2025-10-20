package com.example.customerservice.web;

import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class LoginController {

    @GetMapping("/login")
    public String login(Authentication authentication, Model model) {
        if (authentication != null && authentication.isAuthenticated()) {
            // already authenticated -> redirect to customers
            return "redirect:/items/ariel";
        }
        return "login";
    }
}
