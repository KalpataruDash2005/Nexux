package com.careeros.rag.service;

import dev.langchain4j.data.document.Document;
import dev.langchain4j.data.document.splitter.DocumentSplitters;
import dev.langchain4j.data.segment.TextSegment;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class TextChunkingService {

    public List<TextSegment> chunkText(String text) {
        Document document = Document.from(text);
        // Split by 1000 characters max, with 200 characters overlap
        return DocumentSplitters.recursive(1000, 200).split(document);
    }
}
