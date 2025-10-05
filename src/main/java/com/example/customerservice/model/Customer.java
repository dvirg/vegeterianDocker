package com.example.customerservice.model;

import jakarta.persistence.*;
import lombok.*;

// id changed from UUID to Long

@Entity
@Table(name = "customers")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Customer {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id")
    private String userId;

    private String name;

    private String phones;

    private String address;

    private String email;

    public enum PackageType {
        none,
        pack,
        delivery,
        morning_package,
        morning_delivery
    }

    @Enumerated(EnumType.STRING)
    @Column(name = "default_package")
    private PackageType defaultPackage;

    @Lob
    private String metadata;

    // explicit getters/setters for id in case Lombok processing is not available
    public Long getId() {
        return this.id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getUserId() {
        return this.userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getName() {
        return this.name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getPhones() {
        return this.phones;
    }

    public void setPhones(String phones) {
        this.phones = phones;
    }

    public String getAddress() {
        return this.address;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    public String getEmail() {
        return this.email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public PackageType getDefaultPackage() {
        return this.defaultPackage;
    }

    public void setDefaultPackage(PackageType defaultPackage) {
        this.defaultPackage = defaultPackage;
    }

    public String getMetadata() {
        return this.metadata;
    }

    public void setMetadata(String metadata) {
        this.metadata = metadata;
    }
}
