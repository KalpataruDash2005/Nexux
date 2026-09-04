import dev.langchain4j.model.chat.ChatLanguageModel;
import dev.langchain4j.model.ollama.OllamaChatModel;
import java.time.Duration;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.URI;

public class BenchmarkOllama {
    public static void main(String[] args) throws Exception {
        // Build a mock context that reflects the actual size in RagAnswerService (~1000 characters)
        String context = "The Nexux platform is an advanced AI assistant built on Spring Boot and React. "
            + "It uses Qdrant for vector search and Ollama for local LLM inference. ".repeat(10); 

        String prompt = "Respond to the question using ONLY the provided context.\n" +
            "Keep your answer extremely concise (maximum 3 sentences). Do not include introductory phrases like 'Based on the context'.\n" +
            "If the answer is not in the context, reply exactly: 'Information not available.'\n\n" +
            "Context:\n" + context + "\n\n" +
            "Question:\nWhat technologies does the Nexux platform use?";

        System.out.println("--- Starting Direct HTTP test ---");
        String jsonPayload = "{"
            + "\"model\": \"phi3:mini\","
            + "\"messages\": [{\"role\": \"user\", \"content\": \"" + prompt.replace("\n", "\\n") + "\"}],"
            + "\"options\": {"
            + "\"temperature\": 0.0,"
            + "\"num_predict\": 150,"
            + "\"num_ctx\": 2048"
            + "},"
            + "\"stream\": false"
            + "}";

        HttpClient client = HttpClient.newHttpClient();
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create("http://127.0.0.1:11434/api/chat"))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(jsonPayload))
            .build();

        long t2 = System.currentTimeMillis();
        HttpResponse<String> httpResponse = client.send(request, HttpResponse.BodyHandlers.ofString());
        long t3 = System.currentTimeMillis();
        String respBody = httpResponse.body();
        if(respBody.length() > 200) respBody = respBody.substring(0, 200) + "...";
        System.out.println("Direct HTTP Response: " + respBody.replace('\n', ' '));
        System.out.println("Direct HTTP Time: " + (t3 - t2) + " ms\n");

        System.out.println("--- Starting LangChain4j test ---");
        ChatLanguageModel model = OllamaChatModel.builder()
            .baseUrl("http://127.0.0.1:11434")
            .modelName("phi3:mini")
            .temperature(0.0)
            .numPredict(150)
            .numCtx(2048)
            .timeout(Duration.ofMinutes(10))
            .build();

        long t0 = System.currentTimeMillis();
        String lc4jResponse = model.generate(prompt);
        long t1 = System.currentTimeMillis();
        System.out.println("LangChain4j Response: " + lc4jResponse.replace('\n', ' '));
        System.out.println("LangChain4j Time: " + (t1 - t0) + " ms\n");
    }
}
