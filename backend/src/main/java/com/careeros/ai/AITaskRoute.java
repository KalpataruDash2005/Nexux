package com.careeros.ai;

import com.careeros.ai.provider.AIProvider;

public record AITaskRoute(AIProvider provider, String model) {
}
