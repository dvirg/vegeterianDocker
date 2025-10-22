package com.example.customerservice.service;

import com.example.customerservice.model.Item;
import com.example.customerservice.repository.ItemRepository;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
public class ItemAvailabilityConsumer {

    private final ItemRepository itemRepository;

    public ItemAvailabilityConsumer(ItemRepository itemRepository) {
        this.itemRepository = itemRepository;
    }

    // Expect messages in the simple form: "<itemId>:<available>" e.g. "42:true"
    @KafkaListener(topics = "items-availability", groupId = "items-group")
    public void listen(String message) {
        try {
            String[] parts = message.split(":", 2);
            Long id = Long.parseLong(parts[0]);
            boolean available = Boolean.parseBoolean(parts[1]);
            Optional<Item> oi = itemRepository.findById(id);
            if (oi.isPresent()) {
                Item item = oi.get();
                item.setAvailable(available);
                itemRepository.save(item);
            }
        } catch (Exception e) {
            // log and ignore malformed messages
            System.err.println("Failed to process availability message: " + message + " -> " + e.getMessage());
        }
    }
}
