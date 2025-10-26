package com.example.customerservice.service;

import com.example.customerservice.model.Order;
import com.example.customerservice.repository.OrderRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class OrderService {
    private final OrderRepository repository;

    public OrderService(OrderRepository repository) {
        this.repository = repository;
    }

    public List<Order> findAll() {
        return repository.findAll();
    }

    public Optional<Order> findById(Long id) {
        return repository.findById(id);
    }

    public Order save(Order order) {
        return repository.save(order);
    }

    public void deleteById(Long id) {
        repository.deleteById(id);
    }

    public void deleteAllOrders() {
        repository.deleteAll();
    }

    public void deleteAllOrdersInBatch() {
        repository.deleteAllInBatch();
    }

    public java.util.List<com.example.customerservice.model.Customer> findDistinctCustomersByNameContaining(
            String name) {
        return repository.findDistinctCustomersByCustomerNameContainingIgnoreCase(name);
    }

    public java.time.LocalDateTime findLatestUploadTimestampForCustomer(Long customerId) {
        return repository.findLatestUploadTimestampByCustomerId(customerId);
    }
}
