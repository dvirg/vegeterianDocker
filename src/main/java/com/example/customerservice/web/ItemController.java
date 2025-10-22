package com.example.customerservice.web;

import com.example.customerservice.model.Item;
import com.example.customerservice.service.ItemService;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;

import java.util.Optional;

@Controller
@RequestMapping("/items")
public class ItemController {
    private final ItemService service;
    private final com.example.customerservice.service.ItemAvailabilityProducer producer;

    public ItemController(ItemService service, com.example.customerservice.service.ItemAvailabilityProducer producer) {
        this.service = service;
        this.producer = producer;
    }

    @GetMapping
    public String list(Model model) {
        model.addAttribute("items", service.findAll());
        return "items/list";
    }

    @GetMapping("/ariel")
    public String arielView(Model model) {
        model.addAttribute("items", service.findAll());
        return "items/ariel";
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

    @PostMapping("/toggle/{id}")
    public String toggleAvailability(@PathVariable Long id) {
        var opt = service.findById(id);
        if (opt.isPresent()) {
            Item item = opt.get();
            boolean newVal = !item.isAvailable();
            String json = String.format("{\"action\":\"update\",\"id\":%d,\"available\":%s}", id, newVal);
            producer.sendCommand(json);
        }
        return "redirect:/items";
    }

    @PostMapping("/toggle-ajax/{id}")
    public ResponseEntity<Void> toggleAvailabilityAjax(@PathVariable Long id) {
        var opt = service.findById(id);
        if (opt.isPresent()) {
            Item item = opt.get();
            boolean newVal = !item.isAvailable();
            String json = String.format("{\"action\":\"update\",\"id\":%d,\"available\":%s}", id, newVal);
            producer.sendCommand(json);
            return ResponseEntity.ok().build();
        }
        return ResponseEntity.notFound().build();
    }

    @PostMapping("/set-all-unavailable")
    public String setAllUnavailable() {
        service.setAllAvailable(false);
        return "redirect:/items";
    }

    @PostMapping("/set-all-available")
    public String setAllAvailable() {
        service.setAllAvailable(true);
        return "redirect:/items";
    }

    @PostMapping("/set-all-kg-available")
    public String setAllKgAvailable() {
        service.setAllKgAvailable(true);
        return "redirect:/items";
    }
}
