package com.example.customerservice.web;

import com.example.customerservice.model.Item;
import com.example.customerservice.service.ItemService;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;

import java.util.Optional;

@Controller
@RequestMapping("/items")
public class ItemController {
    private final ItemService service;

    public ItemController(ItemService service) {
        this.service = service;
    }

    @GetMapping
    public String list(Model model) {
        model.addAttribute("items", service.findAll());
        return "items/list";
    }

    @GetMapping("/new")
    public String createForm(Model model) {
        model.addAttribute("item", new Item());
        model.addAttribute("types", Item.ItemType.values());
        return "items/form";
    }

    @PostMapping
    public String create(@ModelAttribute Item item) {
        service.save(item);
        return "redirect:/items";
    }

    @GetMapping("/edit/{id}")
    public String editForm(@PathVariable Long id, Model model) {
        Optional<Item> i = service.findById(id);
        if (i.isEmpty())
            return "redirect:/items";
        model.addAttribute("item", i.get());
        model.addAttribute("types", Item.ItemType.values());
        return "items/form";
    }

    @PostMapping("/delete/{id}")
    public String delete(@PathVariable Long id) {
        service.deleteById(id);
        return "redirect:/items";
    }
}
