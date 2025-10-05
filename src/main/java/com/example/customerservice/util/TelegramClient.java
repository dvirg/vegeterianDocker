package com.example.customerservice.util;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.File;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

@SuppressWarnings("FieldCanBeFinal")
public class TelegramClient {

    private final String token;
    private final String chatId;

    public TelegramClient() throws Exception {
        File credentialsFile = new File("src/main/resources/credentials/telegram.json");
        if (credentialsFile.exists()) {
            ObjectMapper mapper = new ObjectMapper();
            JsonNode creds = mapper.readTree(credentialsFile);
            this.token = creds.get("token").asText();
            this.chatId = creds.get("chat_id").asText();
        } else {
            this.token = System.getenv("TELEGRAM_TOKEN");
            this.chatId = System.getenv("TELEGRAM_CHAT_ID");
            if (this.token == null || this.chatId == null) {
                throw new IllegalStateException("Telegram credentials not found in file or environment variables.");
            }
        }
    }

    public void sendMessage(String message) throws Exception {
        String url = "https://api.telegram.org/bot" + token +
                "/sendMessage?chat_id=" + chatId +
                "&text=" + java.net.URLEncoder.encode(message, "UTF-8");

        HttpClient client = HttpClient.newHttpClient();
        HttpRequest request = HttpRequest.newBuilder()
                .uri(new URI(url))
                .GET()
                .build();

        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        System.out.println("Telegram response: " + response.body());
    }
}
