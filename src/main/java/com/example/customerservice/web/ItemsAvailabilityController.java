package com.example.customerservice.web;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class ItemsAvailabilityController {

    @GetMapping("/items-availability")
    public String getItemsAvailability() {
        return "items-availability";
    }
}
