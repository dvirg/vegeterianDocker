package com.example.customerservice.service;

import com.example.customerservice.model.OrderItem;
import com.example.customerservice.repository.OrderItemRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
public class OrderItemService {
    private final OrderItemRepository repository;

    public OrderItemService(OrderItemRepository repository) {
        this.repository = repository;
    }

    public List<OrderItem> findAll() {
        return repository.findAll();
    }

    public Optional<OrderItem> findById(Long id) {
        return repository.findById(id);
    }

    public OrderItem save(OrderItem oi) {
        return repository.save(oi);
    }

    @Transactional
    public java.util.List<OrderItem> saveAll(java.util.List<OrderItem> items) {
        return repository.saveAll(items);
    }

    public void deleteById(Long id) {
        repository.deleteById(id);
    }

    public void deleteAllOrderItems() {
        repository.deleteAll();
    }

    public void deleteAllOrderItemsInBatch() {
        repository.deleteAllInBatch();
    }
}
