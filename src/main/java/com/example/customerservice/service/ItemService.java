package com.example.customerservice.service;

import com.example.customerservice.model.Item;
import com.example.customerservice.repository.ItemRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import org.springframework.transaction.annotation.Transactional;
import java.util.Comparator;
import java.util.Optional;
import java.util.Map;
import java.util.HashMap;
import java.util.ArrayList;
import java.util.TreeMap;

@Service
public class ItemService {
    private final ItemRepository repository;

    public ItemService(ItemRepository repository) {
        this.repository = repository;
    }

    public List<Item> findAll() {
        List<Item> items = repository.findAll();
        items.sort(Comparator.comparing(Item::getName, Comparator.nullsFirst(String::compareTo)));
        return items;
    }

    public List<Item> getAllItems() {
        return repository.findAll();
    }

    public Optional<Item> findById(Long id) {
        return repository.findById(id);
    }

    public Item save(Item item) {
        return repository.save(item);
    }

    public void deleteById(Long id) {
        repository.deleteById(id);
    }

    public void deleteAllItems() {
        repository.deleteAll();
    }

    public void deleteAllItemsInBatch() {
        repository.deleteAllInBatch();
    }

    @Transactional
    public void setAllAvailable(boolean available) {
        List<Item> items = repository.findAll();
        for (Item i : items) {
            i.setAvailable(available);
        }
        repository.saveAll(items);
    }

    @Transactional
    public void setAllKgAvailable(boolean available) {
        List<Item> items = repository.findAll();
        for (Item i : items) {
            if (i.getType() == Item.ItemType.kg) {
                i.setAvailable(available);
            }
        }
        repository.saveAll(items);
    }

    public String buildPriceList() {
        List<Item> items = getAllItems();

        // Map to hold lowest price per renamed item
        Map<String, Float> lowestPriceMap = new HashMap<>();
        Map<String, Item.ItemType> itemTypeMap = new HashMap<>();

        for (Item item : items) {
            if (!item.isAvailable()) {
                continue;
            }
            String renamed = renameItem(item.getName());
            if (renamed == null) {
                continue; // skip unwanted (e.g. שום קלוף)
            }

            float price = item.getPrice();
            // If we've seen this item before, keep only the lowest price
            if (lowestPriceMap.containsKey(renamed)) {
                if (price < lowestPriceMap.get(renamed)) {
                    lowestPriceMap.put(renamed, price);
                    itemTypeMap.put(renamed, item.getType());
                }
            } else {
                lowestPriceMap.put(renamed, price);
                itemTypeMap.put(renamed, item.getType());
            }
        }

        // Now build price groups with only lowest prices
        Map<Integer, List<String>> kgItems = new TreeMap<>();
        Map<Integer, List<String>> unitItems = new TreeMap<>();

        for (Map.Entry<String, Float> entry : lowestPriceMap.entrySet()) {
            String renamed = entry.getKey();
            float price = entry.getValue();
            Item.ItemType type = itemTypeMap.get(renamed);

            if (type == Item.ItemType.kg) {
                int rounded = (int) Math.floor(price);
                if (rounded < 3)
                    rounded = 3;
                if (renamed.contains("לימון") || renamed.contains("קולורבי")) {
                    rounded = Math.max(3, rounded - 1);
                }
                if (renamed.contains("בננה") || renamed.contains("תפו\"א")) {
                    rounded = rounded + 1;
                }
                kgItems.computeIfAbsent(rounded, k -> new ArrayList<>()).add(renamed);

            } else {
                int rounded = (int) Math.ceil(price);

                if (renamed.contains("אגס")) {
                    rounded = (int) Math.floor(price / 1.5);
                    type = Item.ItemType.kg; // treat as kg
                } else if (renamed.contains("עגבנית-שרי") || renamed.contains("גזר")) {
                    rounded = (int) Math.floor(price / 1.1);
                    type = Item.ItemType.kg; // treat as kg
                }

                if (type == Item.ItemType.kg) {
                    kgItems.computeIfAbsent(rounded, k -> new ArrayList<>()).add(renamed);
                } else {
                    unitItems.computeIfAbsent(rounded, k -> new ArrayList<>()).add(renamed);
                }
            }
        }

        // Build result string
        StringBuilder sb = new StringBuilder();
        sb.append("יש סחורה איכותית במועדון שלב ד', רק מה שעל השולחן הזה, פשוט לשקול ולהעביר לפייבוקס\n")
                .append("https://links.payboxapp.com/qzbne3WZLUb\n\n");

        sb.append("המחירים לק\"ג:\n");
        for (Map.Entry<Integer, List<String>> e : kgItems.entrySet()) {
            sb.append(String.join(" / ", e.getValue())).append(" ").append(e.getKey()).append("\n");
        }

        sb.append("\nטיפ: ניתן ללחוץ על המספר במשקל ויחושב המחיר. \nכפתור הפעלה נמצא בצד ימין למטה.\n");
        sb.append("\nהמחירים ליחידה:\n");
        for (Map.Entry<Integer, List<String>> e : unitItems.entrySet()) {
            sb.append(String.join(" / ", e.getValue())).append(" ").append(e.getKey()).append("\n");
        }

        return sb.toString();
    }

    private String renameItem(String itemName) {
        if (itemName == null)
            return null;

        String clean = itemName.replace("-", " ").replace("(", " ").replace(")", " ");
        String[] split = clean.split("\\s+");
        String firstWord = split.length > 0 ? split[0] : "";

        if (itemName.contains("תפוח עץ"))
            return "תפוח-עץ";
        if (itemName.contains("מלפפון בייבי"))
            return "מלפפון-בייבי";
        if (itemName.contains("צ'ילי"))
            return "צ'ילי";
        if (firstWord.contains("פלפל") && !itemName.contains("פלפלונים"))
            return "פלפל / חריף";
        if (itemName.contains("תפו\"א למיקרו"))
            return "תפו\"א-למיקרו";
        if (itemName.contains("בצל ירוק"))
            return "בצל-ירוק";
        if (itemName.contains("סלק מבושל"))
            return "סלק-בוואקום";
        if (itemName.contains("לאליק"))
            return "חסה-לאליק";
        if (itemName.contains("סלנובה"))
            return "חסה-סלנובה";
        if (itemName.contains("נבט") && split.length > 1)
            return split[0] + "-" + split[1];
        if (itemName.contains("סלרי ראש"))
            return "סלרי-ראש";
        if (itemName.contains("שום טרי"))
            return "שום-ישראלי";
        if (itemName.contains("שום קלוף"))
            return null; // skip
        if (itemName.contains("שום יבש"))
            return "שום-רביעייה";
        if (itemName.contains("שרי"))
            return "עגבנית-שרי";
        if (itemName.contains("ענב לבן"))
            return "ענבים";
        if (itemName.contains("קלחי"))
            return "תירס";

        return firstWord;
    }
}
