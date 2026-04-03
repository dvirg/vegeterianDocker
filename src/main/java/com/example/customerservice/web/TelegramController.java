package com.example.customerservice.web;

import com.example.customerservice.util.TelegramClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/telegram")
public class TelegramController {

    private final String telegramToken;
    private final String telegramChatId;

    public TelegramController(@Value("${TELEGRAM_TOKEN:}") String telegramToken,
            @Value("${TELEGRAM_CHAT_ID:}") String telegramChatId) {
        this.telegramToken = telegramToken;
        this.telegramChatId = telegramChatId;
    }

    @PostMapping("/send")
    public ResponseEntity<String> sendTelegramMessage(@RequestBody TelegramMessageRequest request) {
        try {
            // Check if credentials are available
            if (telegramToken == null || telegramToken.isEmpty() || telegramChatId == null
                    || telegramChatId.isEmpty()) {
                try {
                    // Try default constructor (file-based or env-based)
                    TelegramClient telegramClient = new TelegramClient();
                    telegramClient.sendMessage(request.getMessage());
                } catch (Exception e) {
                    return ResponseEntity.status(500).body("Telegram credentials not configured: " + e.getMessage());
                }
            } else {
                // Use injected credentials
                TelegramClient telegramClient = new TelegramClient(telegramToken, telegramChatId);
                telegramClient.sendMessage(request.getMessage());
            }
            return ResponseEntity.ok("Message sent to Telegram successfully");
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Failed to send Telegram message: " + e.getMessage());
        }
    }

    public static class TelegramMessageRequest {
        private String message;

        public TelegramMessageRequest() {
        }

        public TelegramMessageRequest(String message) {
            this.message = message;
        }

        public String getMessage() {
            return message;
        }

        public void setMessage(String message) {
            this.message = message;
        }
    }
}
