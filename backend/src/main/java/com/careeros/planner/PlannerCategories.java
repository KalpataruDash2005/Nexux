package com.careeros.planner;

import java.util.List;

public final class PlannerCategories {

    private PlannerCategories() {
    }

    public static final List<String> ALL = List.of(
            "EXAM", "INTERNAL_EXAM", "EXTERNAL_EXAM", "PRACTICAL_EXAM",
            "ASSIGNMENT", "SUBMISSION", "PROJECT", "HACKATHON",
            "WORKSHOP", "SEMINAR", "HOLIDAY", "FESTIVAL", "VACATION",
            "SPORTS", "PLACEMENT", "INDUSTRIAL_VISIT", "ORIENTATION",
            "CONVOCATION", "CLASS", "OTHER"
    );

    public static boolean isValid(String category) {
        if (category == null) {
            return false;
        }
        return ALL.contains(category.toUpperCase());
    }

    public static String normalize(String category) {
        if (category == null) {
            return "OTHER";
        }
        String normalized = category.toUpperCase()
                .replaceAll("[^A-Z_]", "_")
                .replaceAll("_+", "_")
                .replaceAll("^_|_$", "");
        if (isValid(normalized)) {
            return normalized;
        }
        return "OTHER";
    }

    /**
     * Refines the LLM's category using keywords in the event title. Fixes common
     * mislabels (e.g. "Mid Sem Exam" tagged as EXTERNAL_EXAM, or a milestone
     * tagged as CLASS) so exams and key deadlines land in the right bucket.
     */
    public static String refineByTitle(String title, String category) {
        String t = (title == null ? "" : title).toLowerCase();
        if (t.contains("mid sem") || t.contains("mid-sem") || t.contains("midsem")
                || t.contains("internal assessment") || t.contains("sessional")) {
            return "INTERNAL_EXAM";
        }
        if (t.contains("end sem") || t.contains("end-sem") || t.contains("final exam")) {
            return "EXTERNAL_EXAM";
        }
        if (t.contains("practical") || t.contains("lab exam") || t.contains("viva")) {
            return "PRACTICAL_EXAM";
        }
        if (t.contains("holiday") || t.contains("vacation") || t.contains("break")) {
            return "HOLIDAY";
        }
        if (t.contains("festival") || t.contains("diwali") || t.contains("holi")
                || t.contains("ganesh") || t.contains("eid") || t.contains("christmas")
                || t.contains("navratri") || t.contains("puja")) {
            return "FESTIVAL";
        }
        if (t.contains("assignment") || t.contains("homework") || t.contains("hw")) {
            return "ASSIGNMENT";
        }
        if (t.contains("submission") || t.contains("submit") || t.contains("deadline")) {
            return "SUBMISSION";
        }
        if (t.contains("project")) {
            return "PROJECT";
        }
        if (t.contains("placement") || t.contains("drive") || t.contains("interview")) {
            return "PLACEMENT";
        }
        if (t.contains("industrial visit") || t.contains("industry visit") || t.contains("site visit")) {
            return "INDUSTRIAL_VISIT";
        }
        if (t.contains("orientation")) {
            return "ORIENTATION";
        }
        if (t.contains("convocation") || t.contains("graduation")) {
            return "CONVOCATION";
        }
        if (t.contains("workshop")) {
            return "WORKSHOP";
        }
        if (t.contains("seminar")) {
            return "SEMINAR";
        }
        if (t.contains("hackathon")) {
            return "HACKATHON";
        }
        if (t.contains("sports") || t.contains("tournament") || t.contains("athletic")) {
            return "SPORTS";
        }
        return category;
    }
}
