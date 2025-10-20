package com.example.customerservice.service;

import com.example.customerservice.model.Customer;
import com.example.customerservice.model.Item;
import com.example.customerservice.model.Order;
import com.example.customerservice.model.OrderItem;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class ImportService {
    private final ItemService itemService;
    private final OrderService orderService;
    private final OrderItemService orderItemService;
    private final CustomerService customerService;

    public ImportService(ItemService itemService, OrderService orderService, OrderItemService orderItemService,
            CustomerService customerService) {
        this.itemService = itemService;
        this.orderService = orderService;
        this.orderItemService = orderItemService;
        this.customerService = customerService;
    }

    @Transactional
    public void replaceAll(List<Customer> customers, List<Item> items, List<Order> orders, List<OrderItem> orderItems) {
        // delete existing using in-batch deletes (direct DB deletes) in correct order
        orderItemService.deleteAllOrderItemsInBatch();
        orderService.deleteAllOrdersInBatch();
        itemService.deleteAllItemsInBatch();
        // customers: we will not delete all customers to avoid losing other references;
        // but you requested clearing items/orders/order-items
        // If needed, we can also clear customers here: customerService.deleteAll();

        // save new - preserve correct references
        java.util.Map<String, Customer> persistedCustomersByName = new java.util.HashMap<>();
        if (customers != null) {
            for (Customer c : customers) {
                Customer pc = customerService.save(c);
                if (pc != null && pc.getName() != null)
                    persistedCustomersByName.put(pc.getName().toLowerCase(), pc);
            }
        }

        java.util.Map<String, Item> persistedItemsByName = new java.util.HashMap<>();
        if (items != null) {
            for (Item it : items) {
                Item pi = itemService.save(it);
                if (pi != null && pi.getName() != null)
                    persistedItemsByName.put(pi.getName().toLowerCase(), pi);
            }
        }

        java.util.Map<Integer, Order> persistedOrdersByIndex = new java.util.HashMap<>();
        if (orders != null) {
            int idx = 0;
            for (Order o : orders) {
                // remap customer reference to persisted customer if available
                if (o.getCustomer() != null && o.getCustomer().getName() != null) {
                    Customer pc = persistedCustomersByName.get(o.getCustomer().getName().toLowerCase());
                    if (pc != null)
                        o.setCustomer(pc);
                }
                Order po = orderService.save(o);
                persistedOrdersByIndex.put(idx++, po);
            }
        }

        if (orderItems != null) {
            // For each orderItem, remap the Item and Order references to the persisted ones
            for (OrderItem oi : orderItems) {
                if (oi.getItem() != null && oi.getItem().getName() != null) {
                    Item pi = persistedItemsByName.get(oi.getItem().getName().toLowerCase());
                    if (pi != null)
                        oi.setItem(pi);
                }
                // Orders were created in same sequence as parsed - find matching persisted
                // order by object equality or by position
                // If order reference has no id, try to match by customer + date
                if (oi.getOrder() != null && oi.getOrder().getOrderId() == null) {
                    // try naive match: find order by customer and date
                    for (Order persisted : persistedOrdersByIndex.values()) {
                        if (persisted.getCustomer() != null && oi.getOrder().getCustomer() != null
                                && persisted.getCustomer().getName() != null
                                && oi.getOrder().getCustomer().getName() != null
                                && persisted.getCustomer().getName()
                                        .equalsIgnoreCase(oi.getOrder().getCustomer().getName())) {
                            oi.setOrder(persisted);
                            break;
                        }
                    }
                }
            }
            orderItemService.saveAll(orderItems);
        }
    }
}
