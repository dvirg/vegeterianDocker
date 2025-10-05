package com.example.customerservice.web;

import com.example.customerservice.model.Customer;
import com.example.customerservice.model.Order;
import com.example.customerservice.service.CustomerService;
import com.example.customerservice.service.OrderService;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;

import java.util.Optional;
import java.util.UUID;

@Controller
@RequestMapping("/orders")
public class OrderController {
    private final OrderService orderService;
    private final CustomerService customerService;

    public OrderController(OrderService orderService, CustomerService customerService) {
        this.orderService = orderService;
        this.customerService = customerService;
    }

    @GetMapping
    public String list(Model model) {
        model.addAttribute("orders", orderService.findAll());
        return "orders/list";
    }

    @GetMapping("/new")
    public String createForm(Model model) {
        model.addAttribute("order", new Order());
        model.addAttribute("packages", Customer.PackageType.values());
        model.addAttribute("customers", customerService.findAll());
        return "orders/form";
    }

    @PostMapping
    public String create(@ModelAttribute Order order) {
        // resolve customer relation if provided as id in nested property
        if (order.getCustomer() != null && order.getCustomer().getId() != null) {
            customerService.findById(order.getCustomer().getId()).ifPresent(order::setCustomer);
        }
        orderService.save(order);
        return "redirect:/orders";
    }

    @GetMapping("/edit/{id}")
    public String editForm(@PathVariable Long id, Model model) {
        Optional<Order> o = orderService.findById(id);
        if (o.isEmpty())
            return "redirect:/orders";
        model.addAttribute("order", o.get());
        model.addAttribute("packages", Customer.PackageType.values());
        model.addAttribute("customers", customerService.findAll());
        return "orders/form";
    }

    @PostMapping("/delete/{id}")
    public String delete(@PathVariable Long id) {
        orderService.deleteById(id);
        return "redirect:/orders";
    }
}
