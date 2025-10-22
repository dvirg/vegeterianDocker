package com.example.customerservice.service;

import com.example.customerservice.model.Item;
import com.example.customerservice.repository.ItemRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
public class ItemCommandConsumer {

    private static final Logger logger = LoggerFactory.getLogger(ItemCommandConsumer.class);
    private final ItemRepository itemRepository;
    private final ObjectMapper mapper = new ObjectMapper();

    public ItemCommandConsumer(ItemRepository itemRepository) {
        this.itemRepository = itemRepository;
    }

    @KafkaListener(topics = "items-commands", groupId = "items-commands-group")
    public void onCommand(String message) {
        logger.info("Received items-commands message={}", message);
        try {
            JsonNode node = mapper.readTree(message);
            String action = node.path("action").asText();
            if ("update".equals(action)) {
                long id = node.path("id").asLong();
                boolean available = node.path("available").asBoolean();
                Optional<Item> oi = itemRepository.findById(id);
                if (oi.isPresent()) {
                    Item item = oi.get();
                    boolean before = item.isAvailable();
                    item.setAvailable(available);
                    itemRepository.save(item);
                    logger.info("Updated item id={} availability {}->{} in DB", id, before, available);
                } else {
                    logger.warn("Update action: item id={} not found", id);
                }
            } else if ("toggle".equals(action)) {
                long id = node.path("id").asLong();
                Optional<Item> oi = itemRepository.findById(id);
                if (oi.isPresent()) {
                    Item item = oi.get();
                    boolean before = item.isAvailable();
                    item.setAvailable(!item.isAvailable());
                    itemRepository.save(item);
                    logger.info("Toggled item id={} availability {}->{} in DB", id, before, item.isAvailable());
                } else {
                    logger.warn("Toggle action: item id={} not found", id);
                }
            }
            // additional actions (create, delete) can be added later
        } catch (Exception e) {
            logger.error("Failed to process command: {}", message, e);
        }
    }
}
