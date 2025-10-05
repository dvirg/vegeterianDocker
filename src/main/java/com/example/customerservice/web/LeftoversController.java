package com.example.customerservice.web;

import com.example.customerservice.service.ItemService;
import com.example.customerservice.util.TelegramClient;
import org.apache.poi.util.Units;
import org.apache.poi.xwpf.usermodel.*;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.*;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;

import java.io.ByteArrayOutputStream;
import java.io.FileInputStream;
import java.io.InputStream;
import java.math.BigInteger;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

@Controller
public class LeftoversController {

    private final ItemService itemService;

    public LeftoversController(ItemService itemService) {
        this.itemService = itemService;
    }

    @GetMapping("/leftovers")
    public String getLeftovers(Model model) {
        String priceList = itemService.buildPriceList();
        model.addAttribute("priceList", priceList);

        try {
            TelegramClient telegramClient = new TelegramClient();
            telegramClient.sendMessage(priceList);
        } catch (Exception e) {
            e.printStackTrace();
        }

        return "leftovers";
    }

    @GetMapping("/leftovers/download")
    public ResponseEntity<ByteArrayResource> downloadLeftovers() throws Exception {
        String content = itemService.buildPriceList();
        XWPFDocument doc = createWordDocument(content);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        doc.write(out);
        doc.close();

        ByteArrayResource resource = new ByteArrayResource(out.toByteArray());

        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss");
        String timestamp = LocalDateTime.now().format(formatter);
        String fileName = "items_list_" + timestamp + ".docx";

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=" + fileName)
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(resource);
    }

    private XWPFDocument createWordDocument(String content) throws Exception {
        XWPFDocument doc = new XWPFDocument();

        // Set landscape orientation properly
        CTSectPr sectPr = doc.getDocument().getBody().addNewSectPr();
        CTPageSz pageSize = sectPr.addNewPgSz();
        pageSize.setOrient(STPageOrientation.LANDSCAPE);
        pageSize.setW(BigInteger.valueOf(16840)); // A4 width in twips
        pageSize.setH(BigInteger.valueOf(11900)); // A4 height in twips

        // Set page margins (0.1 cm = ~56 twips)
        CTPageMar pageMar = sectPr.addNewPgMar();
        pageMar.setTop(BigInteger.valueOf(200));
        pageMar.setBottom(BigInteger.valueOf(200));
        pageMar.setLeft(BigInteger.valueOf(200));
        pageMar.setRight(BigInteger.valueOf(200));

        // Remove first 2 lines
        String[] lines = content.split("\n");
        StringBuilder sb = new StringBuilder();
        for (int i = 2; i < lines.length; i++) {
            sb.append(lines[i]).append("\n");
        }

        // Split content into kg and unit sections
        String[] sections = sb.toString().split("המחירים ליחידה");
        String kgContent = sections[0].trim();
        String unitContent = sections.length > 1 ? ("המחירים ליחידה" + sections[1]).trim() : "";

        // Create a table with 1 row, 2 cells
        XWPFTable table = doc.createTable(1, 2);

        // Make table borders transparent
        table.getCTTbl().getTblPr().addNewTblBorders().addNewTop().setVal(STBorder.NIL);
        table.getCTTbl().getTblPr().getTblBorders().addNewBottom().setVal(STBorder.NIL);
        table.getCTTbl().getTblPr().getTblBorders().addNewLeft().setVal(STBorder.NIL);
        table.getCTTbl().getTblPr().getTblBorders().addNewRight().setVal(STBorder.NIL);
        table.getCTTbl().getTblPr().getTblBorders().addNewInsideH().setVal(STBorder.NIL);
        table.getCTTbl().getTblPr().getTblBorders().addNewInsideV().setVal(STBorder.NIL);

        table.setWidth("100%");

        // Right-to-left table
        table.getCTTbl().getTblPr().addNewBidiVisual().setVal(true);

        // Add kg items line by line to first cell
        XWPFTableCell cell1 = table.getRow(0).getCell(0);
        XWPFParagraph para = cell1.addParagraph();
        para.setAlignment(ParagraphAlignment.RIGHT);
        XWPFRun run = para.createRun();
        run.setFontFamily("Arial");
        run.setFontSize(8);
        run.setText("בס\"ד");
        for (String line : kgContent.split("\n")) {
            if (line.length() == 0) {
                continue;
            }
            para = cell1.addParagraph();
            para.setAlignment(ParagraphAlignment.RIGHT);
            run = para.createRun();
            run.setFontFamily("Arial");
            run.setFontSize(18);
            run.setText(line);
        }

        // Add unit items line by line to second cell
        XWPFTableCell cell2 = table.getRow(0).getCell(1);
        for (String line : unitContent.split("\n")) {
            if (line.length() == 0) {
                continue;
            }
            para = cell2.addParagraph();
            para.setAlignment(ParagraphAlignment.RIGHT);
            run = para.createRun();
            run.setFontFamily("Arial");
            run.setFontSize(18);
            run.setText(line);
        }

        // Add images in a single row table
        XWPFTable imgTable = doc.createTable(1, 2);
        imgTable.getCTTbl().getTblPr().addNewTblBorders().addNewTop().setVal(STBorder.NIL);
        imgTable.getCTTbl().getTblPr().getTblBorders().addNewBottom().setVal(STBorder.NIL);
        imgTable.getCTTbl().getTblPr().getTblBorders().addNewLeft().setVal(STBorder.NIL);
        imgTable.getCTTbl().getTblPr().getTblBorders().addNewRight().setVal(STBorder.NIL);
        imgTable.getCTTbl().getTblPr().getTblBorders().addNewInsideH().setVal(STBorder.NIL);
        imgTable.getCTTbl().getTblPr().getTblBorders().addNewInsideV().setVal(STBorder.NIL);
        imgTable.getCTTbl().getTblPr().addNewBidiVisual().setVal(true);
        imgTable.setWidth("100%");

        addImageWithCaption(imgTable.getRow(0).getCell(0), "src/main/resources/images/paybox.png", "פייבוקס");
        addImageWithCaption(imgTable.getRow(0).getCell(1), "src/main/resources/images/bit.png", "ביט");

        return doc;
    }

    private void addImageWithCaption(XWPFTableCell cell, String imagePath, String caption) throws Exception {
        XWPFParagraph imgPara = cell.addParagraph();
        imgPara.setAlignment(ParagraphAlignment.CENTER);
        try (InputStream is = new FileInputStream(imagePath)) {
            imgPara.createRun().addPicture(is, XWPFDocument.PICTURE_TYPE_PNG, imagePath,
                    Units.toEMU(2 * 72), Units.toEMU(2 * 72));
        }
        XWPFParagraph capPara = cell.addParagraph();
        capPara.setAlignment(ParagraphAlignment.CENTER);
        XWPFRun run = capPara.createRun();
        run.setText(caption);
        run.setFontSize(18);
        run.setFontFamily("Arial");
    }
}
