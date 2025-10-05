package com.example.customerservice.model;

import jakarta.persistence.*;
import java.time.LocalDate;

@Entity
@Table(name = "orders")
public class Order {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "order_id")
    private Long orderId;

    private LocalDate date;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id")
    private Customer customer;

    @Column(name = "package_value")
    private Integer packageValue;

    @Enumerated(EnumType.STRING)
    @Column(name = "selected_package")
    private Customer.PackageType selectedPackage;

    public Long getOrderId() {
        return orderId;
    }

    public void setOrderId(Long orderId) {
        this.orderId = orderId;
    }

    public LocalDate getDate() {
        return date;
    }

    public void setDate(LocalDate date) {
        this.date = date;
    }

    public Customer getCustomer() {
        return customer;
    }

    public void setCustomer(Customer customer) {
        this.customer = customer;
    }

    public Integer getPackageValue() {
        return packageValue;
    }

    public void setPackageValue(Integer packageValue) {
        this.packageValue = packageValue;
    }

    public Customer.PackageType getSelectedPackage() {
        return selectedPackage;
    }

    public void setSelectedPackage(Customer.PackageType selectedPackage) {
        this.selectedPackage = selectedPackage;
    }
}
