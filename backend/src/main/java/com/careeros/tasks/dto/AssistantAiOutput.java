package com.careeros.tasks.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

/** Raw structured output from the LLM (OpenAI-style function/JSON schema, snake_case keys). */
public class AssistantAiOutput {

    @JsonProperty("reply_message")
    public String replyMessage;

    public String action;

    public AiUpdates updates;

    @JsonProperty("new_chunks")
    public List<AiChunk> newChunks;

    @JsonProperty("memory_updates")
    public List<MemoryUpdate> memoryUpdates;

    public static class AiUpdates {
        public String status;

        @JsonProperty("progress_notes")
        public String progressNotes;

        public String deadline;

        @JsonProperty("scheduled_date")
        public String scheduledDate;
    }

    public static class AiChunk {
        public String title;

        @JsonProperty("scheduled_date")
        public String scheduledDate;

        @JsonProperty("estimated_hours")
        public String estimatedHours;
    }

    public static class MemoryUpdate {
        @JsonProperty("key")
        public String key;

        @JsonProperty("value")
        public String value;
    }

    public List<MemoryUpdate> memoryUpdatesOrEmpty() {
        return memoryUpdates == null ? List.of() : memoryUpdates;
    }
}
