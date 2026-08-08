package com.careeros.placement.service;

import com.careeros.placement.dto.CodingProblem;
import com.careeros.placement.dto.CodingTestResult;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Runs candidate code against hidden test cases by compiling/executing it in a
 * throwaway sandbox directory. Test cases are console-style: stdin -> stdout.
 * Supports Java, Python, C++ (if a compiler is installed) and JavaScript (node).
 * Any other language is reported as unsupported.
 */
@Service
@Slf4j
public class CodeExecutorService {

    private static final long EXEC_TIMEOUT_SECONDS = 4;
    private static final int MAX_OUTPUT_BYTES = 64 * 1024;
    private static final Pattern PUBLIC_CLASS = Pattern.compile("public\\s+class\\s+(\\w+)");

    public List<CodingTestResult> runTests(String language, String code, List<CodingProblem.CodingTest> tests) {
        List<CodingTestResult> results = new ArrayList<>();
        if (tests == null || tests.isEmpty()) {
            results.add(new CodingTestResult(false, "", "", "", "No test cases were generated for this problem.", false));
            return results;
        }

        String lang = language == null ? "java" : language.trim().toLowerCase();
        Path sandbox = null;
        try {
            sandbox = Files.createTempDirectory("careeros-code-");
            String compilationError = prepareSandbox(sandbox, lang, code);
            if (compilationError != null) {
                for (CodingProblem.CodingTest t : tests) {
                    results.add(new CodingTestResult(false, t.input(), t.expectedOutput(), "", compilationError, t.hidden()));
                }
                return results;
            }
            for (CodingProblem.CodingTest t : tests) {
                results.add(execute(sandbox, lang, t));
            }
        } catch (Exception e) {
            for (CodingProblem.CodingTest t : tests) {
                results.add(new CodingTestResult(false, t.input(), t.expectedOutput(), "",
                        "Sandbox failure: " + safeMessage(e), t.hidden()));
            }
        } finally {
            if (sandbox != null) {
                deleteRecursively(sandbox);
            }
        }
        return results;
    }

    private String prepareSandbox(Path sandbox, String lang, String code) throws IOException {
        switch (lang) {
            case "java": {
                String className = detectClassName(code);
                Files.writeString(sandbox.resolve(className + ".java"), code, StandardCharsets.UTF_8);
                return runCompile(sandbox, "javac", className + ".java");
            }
            case "cpp":
            case "c++": {
                Files.writeString(sandbox.resolve("main.cpp"), code, StandardCharsets.UTF_8);
                return runCompile(sandbox, "g++", "main.cpp", "-o", "main", "-std=c++17");
            }
            case "python":
            case "python3":
            case "javascript":
            case "js":
            case "node":
                Files.writeString(sandbox.resolve("main.txt"), code, StandardCharsets.UTF_8);
                return null;
            default:
                return "Language '" + lang + "' is not supported for automated test execution. " +
                        "Supported languages: java, python, cpp, javascript.";
        }
    }

    private String runCompile(Path sandbox, String... command) throws IOException {
        ProcessBuilder pb = new ProcessBuilder(command);
        pb.directory(sandbox.toFile());
        pb.redirectErrorStream(true);
        Process proc = pb.start();
        try {
            if (!proc.waitFor(20, TimeUnit.SECONDS)) {
                proc.destroyForcibly();
                return "Compilation timed out.";
            }
            byte[] out = proc.getInputStream().readNBytes(MAX_OUTPUT_BYTES);
            String msg = new String(out, StandardCharsets.UTF_8).trim();
            return proc.exitValue() == 0 ? null : (msg.isEmpty() ? "Compilation failed." : msg);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            proc.destroyForcibly();
            return "Compilation interrupted.";
        }
    }

    private CodingTestResult execute(Path sandbox, String lang, CodingProblem.CodingTest test) throws IOException {
        String fileName;
        String entry = null;
        switch (lang) {
            case "java": {
                Path javaFile = Files.list(sandbox)
                        .filter(p -> p.getFileName().toString().endsWith(".java"))
                        .findFirst().orElse(null);
                String className = javaFile == null ? "Main" : detectClassName(Files.readString(javaFile));
                entry = className;
                fileName = className;
                break;
            }
            case "cpp":
            case "c++":
                fileName = "main";
                entry = null;
                break;
            case "python":
            case "python3":
                fileName = "main.txt";
                entry = null;
                break;
            case "javascript":
            case "js":
            case "node":
                fileName = "main.txt";
                entry = null;
                break;
            default:
                return new CodingTestResult(false, test.input(), test.expectedOutput(), "", "Unsupported language: " + lang, test.hidden());
        }

        ProcessBuilder pb = buildProcess(sandbox, lang, fileName, entry);
        pb.redirectErrorStream(true);
        Process proc = pb.start();
        String output;
        try {
            proc.getOutputStream().write(test.input() == null ? new byte[0] : test.input().getBytes(StandardCharsets.UTF_8));
            proc.getOutputStream().close();
            if (!proc.waitFor(EXEC_TIMEOUT_SECONDS, TimeUnit.SECONDS)) {
                proc.destroyForcibly();
                return new CodingTestResult(false, test.input(), test.expectedOutput(), "", "Execution timed out.", test.hidden());
            }
            output = new String(proc.getInputStream().readNBytes(MAX_OUTPUT_BYTES), StandardCharsets.UTF_8).trim();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            proc.destroyForcibly();
            return new CodingTestResult(false, test.input(), test.expectedOutput(), "", "Execution interrupted.", test.hidden());
        }

        String expected = test.expectedOutput() == null ? "" : test.expectedOutput().trim();
        boolean passed = proc.exitValue() == 0 && output.equals(expected);
        if (passed) {
            return new CodingTestResult(true, test.input(), test.expectedOutput(), output, null, test.hidden());
        }
        String error = proc.exitValue() != 0 && !output.isEmpty() ? "Runtime error / non-zero exit: " + output : null;
        return new CodingTestResult(false, test.input(), test.expectedOutput(), output, error, test.hidden());
    }

    private ProcessBuilder buildProcess(Path sandbox, String lang, String fileName, String entry) {
        List<String> command = new ArrayList<>();
        switch (lang) {
            case "java":
                command.add("java");
                command.add("-Xmx256m");
                command.add("-cp");
                command.add(".");
                command.add(entry);
                break;
            case "cpp":
            case "c++":
                command.add(sandbox.resolve("main").toAbsolutePath().toString());
                break;
            case "python":
            case "python3":
                command.add("python");
                command.add(sandbox.resolve(fileName).toAbsolutePath().toString());
                break;
            case "javascript":
            case "js":
            case "node":
                command.add("node");
                command.add(sandbox.resolve(fileName).toAbsolutePath().toString());
                break;
            default:
                break;
        }
        ProcessBuilder pb = new ProcessBuilder(command);
        pb.directory(sandbox.toFile());
        return pb;
    }

    private String detectClassName(String code) {
        if (code == null) {
            return "Main";
        }
        Matcher m = PUBLIC_CLASS.matcher(code);
        return m.find() ? m.group(1) : "Main";
    }

    private void deleteRecursively(Path root) {
        try {
            Files.walk(root)
                    .sorted(Comparator.reverseOrder())
                    .forEach(p -> {
                        try {
                            Files.deleteIfExists(p);
                        } catch (IOException ignore) {
                        }
                    });
        } catch (IOException ignore) {
        }
    }

    private String safeMessage(Throwable t) {
        return t == null ? "unknown error" : (t.getMessage() == null ? t.getClass().getSimpleName() : t.getMessage());
    }
}