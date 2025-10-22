package com.example.customerservice.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;
import org.springframework.stereotype.Service;

@Service
public class ItemAvailabilityProducer {
    private static final Logger logger = LoggerFactory.getLogger(ItemAvailabilityProducer.class);
    private final KafkaTemplate<String, String> kafkaTemplate;

    public ItemAvailabilityProducer(KafkaTemplate<String, String> kafkaTemplate) {
        this.kafkaTemplate = kafkaTemplate;
    }

    public void sendAvailabilityUpdate(String message) {
        logger.info("Sending availability update to topic=items-availability message={}", message);
        kafkaTemplate.send("items-availability", message)
                .whenComplete((result, ex) -> {
                    if (ex != null) {
                        logger.error("Failed to send availability message: {}", message, ex);
                    } else if (result != null) {
                        logger.debug("Sent availability message successfully, topicPartition={} offset={}",
                                result.getRecordMetadata().topic() + ":" + result.getRecordMetadata().partition(),
                                result.getRecordMetadata().offset());
                    }
                });
    }

    public void sendCommand(String commandJson) {
        logger.info("Sending command to topic=items-commands message={}", commandJson);
        kafkaTemplate.send("items-commands", commandJson)
                .whenComplete((result, ex) -> {
                    if (ex != null) {
                        logger.error("Failed to send command message: {}", commandJson, ex);
                    } else if (result != null) {
                        logger.debug("Sent command message successfully, topicPartition={} offset={}",
                                result.getRecordMetadata().topic() + ":" + result.getRecordMetadata().partition(),
                                result.getRecordMetadata().offset());
                    }
                });
    }
}
