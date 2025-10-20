package com.example.customerservice.web;

import com.example.customerservice.model.Order;
import com.example.customerservice.model.Item;
import com.example.customerservice.model.OrderItem;
import com.example.customerservice.service.OrderItemService;
import com.example.customerservice.service.OrderService;
import com.example.customerservice.service.ItemService;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;

import java.util.Optional;
import java.util.stream.Collectors;
import java.util.Map;
import java.util.List;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.Comparator;

@Controller
@RequestMapping("/order-items")
public class OrderItemController {
    private final OrderItemService service;
    private final OrderService orderService;
    private final ItemService itemService;

    public OrderItemController(OrderItemService service, OrderService orderService, ItemService itemService) {
        this.service = service;
        this.orderService = orderService;
        this.itemService = itemService;
    }

    @GetMapping
    public String list(Model model) {
        var all = service.findAll();
        // group by order id (null-safe -> use 'unknown' key or 0)
        Map<Long, List<com.example.customerservice.model.OrderItem>> grouped = all.stream()
                .collect(Collectors.groupingBy(oi -> oi.getOrder() != null ? oi.getOrder().getOrderId() : 0L));

        // Sort groups by the customer's last name (case-insensitive). If missing, sort
        // to end.
        List<Map.Entry<Long, List<com.example.customerservice.model.OrderItem>>> entries = new ArrayList<>(
                grouped.entrySet());

        entries.sort(Comparator.comparing(entry -> {
            List<com.example.customerservice.model.OrderItem> list = entry.getValue();
            if (list == null || list.isEmpty())
                return "~"; // push empty to end
            com.example.customerservice.model.OrderItem oi = list.get(0);
            if (oi == null || oi.getOrder() == null || oi.getOrder().getCustomer() == null)
                return "~";
            String fullName = oi.getOrder().getCustomer().getName();
            if (fullName == null || fullName.isBlank())
                return "~";
            String[] parts = fullName.trim().split("\\s+");
            String last = parts[parts.length - 1];
            return last.toLowerCase();
        }));

        LinkedHashMap<Long, List<com.example.customerservice.model.OrderItem>> ordered = new LinkedHashMap<>();
        for (Map.Entry<Long, List<com.example.customerservice.model.OrderItem>> e : entries) {
            ordered.put(e.getKey(), e.getValue());
        }

        model.addAttribute("orderItemsByOrder", ordered);
        model.addAttribute("orderItems", all);
        return "order_items/list";
    }

    @GetMapping("/new")
    public String createForm(Model model) {
        model.addAttribute("orderItem", new OrderItem());
        model.addAttribute("orders", orderService.findAll());
        model.addAttribute("items", itemService.findAll());
        return "order_items/form";
    }

    @PostMapping
    public String create(@ModelAttribute OrderItem orderItem) {
        // ensure relations are set (if submitted as ids in nested properties)
        if (orderItem.getOrder() != null && orderItem.getOrder().getOrderId() != null) {
            Order o = orderService.findById(orderItem.getOrder().getOrderId()).orElse(null);
            orderItem.setOrder(o);
        }
        if (orderItem.getItem() != null && orderItem.getItem().getId() != null) {
            Item it = itemService.findById(orderItem.getItem().getId()).orElse(null);
            orderItem.setItem(it);
            if (it != null) {
                orderItem.setTotalPrice(it.getPrice() * orderItem.getAmount());
            }
        }
        service.save(orderItem);
        return "redirect:/order-items";
    }

    @GetMapping("/edit/{id}")
    public String editForm(@PathVariable Long id, Model model) {
        Optional<OrderItem> o = service.findById(id);
        if (o.isEmpty())
            return "redirect:/order-items";
        model.addAttribute("orderItem", o.get());
        model.addAttribute("orders", orderService.findAll());
        model.addAttribute("items", itemService.findAll());
        return "order_items/form";
    }

    @PostMapping("/delete/{id}")
    public String delete(@PathVariable Long id) {
        service.deleteById(id);
        return "redirect:/order-items";
    }
}
