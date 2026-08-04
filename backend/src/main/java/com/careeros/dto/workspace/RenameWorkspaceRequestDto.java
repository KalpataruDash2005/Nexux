package com.careeros.dto.workspace;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class RenameWorkspaceRequestDto {
    @NotBlank(message = "Name is required")
    private String name;
    private String description;
}
