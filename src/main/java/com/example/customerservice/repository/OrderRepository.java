package com.example.customerservice.repository;

import com.example.customerservice.model.Order;
import com.example.customerservice.model.Customer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OrderRepository extends JpaRepository<Order, Long> {

    @Query("select distinct o.customer from Order o where lower(o.customer.name) like lower(concat('%', :name, '%'))")
    java.util.List<Customer> findDistinctCustomersByCustomerNameContainingIgnoreCase(@Param("name") String name);

    @Query("select max(o.uploadedAt) from Order o where o.customer.id = :customerId")
    java.time.LocalDateTime findLatestUploadTimestampByCustomerId(@Param("customerId") Long customerId);
}
