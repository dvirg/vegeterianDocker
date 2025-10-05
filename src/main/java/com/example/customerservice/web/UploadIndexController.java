package com.example.customerservice.web;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class UploadIndexController {

    @GetMapping("/upload")
    public String index() {
        return "upload";
    }
}
