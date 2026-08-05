package com.careeros.placement.dto;

import java.util.List;

public record SubmitAptitudeRequest(List<AptitudeAnswerRequest> answers) {}
