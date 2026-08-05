package com.careeros.placement.dto;

import java.util.List;

public record SessionDetailResponse(PlacementSessionDto session, List<MessageDto> messages) {}
