import dev.langchain4j.model.chat.ChatLanguageModel;
import dev.langchain4j.model.ollama.OllamaChatModel;
import java.time.Duration;

public class TestOllama {
    public static void main(String[] args) {
        ChatLanguageModel model = OllamaChatModel.builder()
                .baseUrl("http://127.0.0.1:11435")
                .modelName("phi3:mini")
                .temperature(0.0)
                .numPredict(150)
                .timeout(Duration.ofMinutes(10))
                .build();
        try {
            model.generate("Test message");
        } catch (Exception e) {
            // expected to fail since our python server doesn't respond properly
        }
    }
}
