package com.example.customerservice.model;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

public class CustomerSearchResult {
    private final String name;
    private final String phones;
    private final LocalDateTime uploadedAt;
    private final String uploadedAtFormatted;

    public CustomerSearchResult(String name, String phones, LocalDateTime uploadedAt) {
        this.name = name;
        this.phones = phones;
        this.uploadedAt = uploadedAt;
        if (uploadedAt != null) {
            // interpret uploadedAt as system default local date-time, convert to Israel
            // time
            var sysZone = ZoneId.systemDefault();
            var israel = ZoneId.of("Asia/Jerusalem");
            var zdt = uploadedAt.atZone(sysZone).withZoneSameInstant(israel);
            this.uploadedAtFormatted = zdt.format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm"));
        } else {
            this.uploadedAtFormatted = "-";
        }
    }

    public String getName() {
        return name;
    }

    public String getPhones() {
        return phones;
    }

    public LocalDateTime getUploadedAt() {
        return uploadedAt;
    }

    public String getUploadedAtFormatted() {
        return uploadedAtFormatted;
    }
}
