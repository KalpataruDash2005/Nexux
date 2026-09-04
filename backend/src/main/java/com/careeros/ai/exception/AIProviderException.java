package com.careeros.ai.exception;

public class AIProviderException extends AIException {
    
    private final String providerName;

    public AIProviderException(String providerName, String message) {
        super(message);
        this.providerName = providerName;
    }

    public AIProviderException(String providerName, String message, Throwable cause) {
        super(message, cause);
        this.providerName = providerName;
    }

    public String getProviderName() {
        return providerName;
    }
}
