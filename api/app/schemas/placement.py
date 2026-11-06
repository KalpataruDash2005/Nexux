import re
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, model_validator

class Suggestion(BaseModel):
    line: str
    suggestion: str

class RewrittenBullet(BaseModel):
    original: str
    rewritten: str

class ProjectEntry(BaseModel):
    title: str
    description: str
    technologies: List[str] = []
    highlights: List[str] = []

class EducationEntry(BaseModel):
    degree: str
    institution: str
    duration: str
    percentage: str

class ExperienceEntry(BaseModel):
    company: str
    role: str
    duration: str
    highlights: List[str] = []

class SkillEvaluation(BaseModel):
    skill: str
    evidenceLevel: str = "Demonstrated"  # "Demonstrated", "Partially demonstrated", "Not demonstrated", "Insufficient info"
    benchmark: str = "Expected"          # "Essential", "Expected", "Role-dependent", "Advanced"
    evidenceDetail: str = ""
    assessedScore: Optional[int] = None

class DimensionBreakdown(BaseModel):
    dimension: str
    score: Optional[int] = None
    weight: float = 0.25
    isAssessed: bool = False
    evidenceSummary: str = ""

class ResumeAnalysis(BaseModel):
    candidateName: str = ""
    atsScore: int = 0
    overallScore: int = 0
    categoryScores: Dict[str, int] = {}
    skills: List[str] = []
    missingSkills: List[str] = []
    strengths: List[str] = []
    weaknesses: List[str] = []
    suggestions: List[Suggestion] = []
    rewrittenBullets: List[RewrittenBullet] = []
    sections: List[str] = []
    projects: List[ProjectEntry] = []
    education: List[EducationEntry] = []
    experience: List[ExperienceEntry] = []
    expectedQuestions: List[str] = []
    recommendedProjects: List[str] = []
    recommendedCertifications: List[str] = []
    checklist: List[str] = []
    skillEvaluations: List[SkillEvaluation] = []
    standardResponse: Optional[Dict[str, Any]] = None

class ResumeResponse(BaseModel):
    resumeId: Optional[str] = None
    fileName: Optional[str] = None
    textLength: Optional[int] = None
    analysis: Optional[ResumeAnalysis] = None

class ResumeListItem(BaseModel):
    id: str
    fileName: str
    textLength: int
    analyzedAt: str

class TodayPractice(BaseModel):
    sessionsToday: int = 0
    questionsToday: int = 0
    goal: int = 10

class RecentFeedbackEntry(BaseModel):
    sessionTitle: str
    type: str
    date: str
    summary: str

class WeeklyProgressItem(BaseModel):
    day: str
    score: int

class DashboardData(BaseModel):
    readiness: int = 0
    readinessLabel: str = "Beginner"
    streak: int = 0
    questionsAnswered: int = 0
    interviewsCompleted: int = 0
    codingProblems: int = 0
    resumeScore: int = 0
    todayPractice: TodayPractice = TodayPractice()
    weakAreas: List[str] = []
    strongAreas: List[str] = []
    weeklyProgress: List[WeeklyProgressItem] = []
    recentFeedback: List[RecentFeedbackEntry] = []

class PlacementSessionDto(BaseModel):
    id: str
    type: str
    mode: str = "AI"
    role: Optional[str] = None
    company: Optional[str] = None
    difficulty: Optional[str] = None
    topic: Optional[str] = None
    status: str = "ACTIVE"
    score: Optional[int] = None
    messageCount: Optional[int] = 0
    createdAt: Optional[datetime] = None
    startedAt: Optional[datetime] = None
    endedAt: Optional[datetime] = None
    summary: Optional[str] = None

    class Config:
        from_attributes = True

class CreateSessionBody(BaseModel):
    type: str
    mode: str = "AI"
    role: Optional[str] = "Software Engineer"
    company: Optional[str] = "General"
    difficulty: Optional[str] = "MEDIUM"
    resumeId: Optional[str] = None

class StartSessionResponse(BaseModel):
    sessionId: str
    question: str

class FeedbackScores(BaseModel):
    confidence: Optional[int] = 0
    communication: int = 0
    grammar: int = 0
    technicalAccuracy: int = 0
    structure: int = 0
    completeness: int = 0

    @model_validator(mode='before')
    @classmethod
    def clean_scores(cls, data: Any) -> Any:
        if isinstance(data, dict):
            cleaned = {}
            for k in ["confidence", "communication", "grammar", "technicalAccuracy", "structure", "completeness"]:
                v = data.get(k)
                if v is None:
                    cleaned[k] = 0
                else:
                    try:
                        cleaned[k] = int(v)
                    except (ValueError, TypeError):
                        cleaned[k] = 0
            return cleaned
        return data

class InterviewFeedback(BaseModel):
    score: int = 0
    overallScore: Optional[int] = None
    scores: FeedbackScores = FeedbackScores()
    categoryScores: Optional[Dict[str, int]] = None
    correctConcepts: List[str] = []
    incorrectClaims: List[str] = []
    missingConcepts: List[str] = []
    strengths: List[str] = []
    weaknesses: List[str] = []
    improvements: List[str] = []
    improvementTips: List[str] = []
    idealAnswer: str = ""
    scoreExplanation: Optional[Dict[str, str]] = None
    explanation: Optional[str] = None
    nextQuestion: str = ""
    nextDifficulty: str = "MEDIUM"
    questionCount: int = 1
    shouldEnd: bool = False
    isDegradedEvaluation: bool = False
    evaluationStatus: str = "SUCCESS"
    standardResponse: Optional[Dict[str, Any]] = None

    @model_validator(mode='before')
    @classmethod
    def normalize_feedback_dict(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data

        d = dict(data)

        # 1. Safely normalize list fields (model may return string, None, or list)
        list_fields = [
            "correctConcepts", "incorrectClaims", "missingConcepts",
            "strengths", "weaknesses", "improvements", "improvementTips"
        ]
        for field in list_fields:
            val = d.get(field)
            if val is None:
                d[field] = []
            elif isinstance(val, str):
                cleaned = val.strip()
                if not cleaned:
                    d[field] = []
                elif "\n" in cleaned:
                    lines = [
                        re.sub(r'^[•\-\*\d+\.]\s*', '', line).strip()
                        for line in cleaned.splitlines()
                        if line.strip()
                    ]
                    d[field] = lines if lines else [cleaned]
                else:
                    d[field] = [cleaned]
            elif isinstance(val, (list, tuple)):
                d[field] = [str(item).strip() for item in val if item is not None and str(item).strip()]
            else:
                d[field] = [str(val).strip()]

        # Synchronize improvements and improvementTips
        if not d.get("improvements") and d.get("improvementTips"):
            d["improvements"] = list(d["improvementTips"])
        elif not d.get("improvementTips") and d.get("improvements"):
            d["improvementTips"] = list(d["improvements"])

        # 2. Normalize scoreExplanation (model may return string or dict)
        expl = d.get("scoreExplanation")
        if isinstance(expl, str):
            d["scoreExplanation"] = {"rationale": expl.strip()}
        elif isinstance(expl, dict):
            d["scoreExplanation"] = {str(k): str(v) for k, v in expl.items()}
        elif expl is None:
            fallback_text = str(d.get("explanation") or "").strip()
            d["scoreExplanation"] = {"rationale": fallback_text}

        # 3. Normalize scores object
        scores_val = d.get("scores")
        if not isinstance(scores_val, dict):
            d["scores"] = {
                "technicalAccuracy": d.get("technicalAccuracy", d.get("score", 0)),
                "communication": d.get("communication", 0),
                "grammar": d.get("grammar", 0),
                "structure": d.get("structure", 0),
                "completeness": d.get("completeness", 0),
                "confidence": d.get("confidence", 0),
            }

        # 4. Normalize score and overallScore
        if "score" not in d and "overallScore" in d:
            d["score"] = d["overallScore"]
        elif "overallScore" not in d and "score" in d:
            d["overallScore"] = d["score"]
        try:
            d["score"] = int(d.get("score", 0))
        except (ValueError, TypeError):
            d["score"] = 0
        d["overallScore"] = d["score"]

        # 5. Fallback for nextQuestion
        if not d.get("nextQuestion"):
            d["nextQuestion"] = str(d.get("followUpQuestion") or "").strip()

        return d

class SendMessageRequest(BaseModel):
    content: str

class MessageResponse(BaseModel):
    feedback: InterviewFeedback
    sessionCompleted: bool = False
    finalSummary: Optional[str] = None

class EndSessionResponse(BaseModel):
    score: Optional[int] = None
    summary: Optional[str] = None
    messageCount: Optional[int] = None

class ChatMessage(BaseModel):
    id: str
    role: str
    content: str
    analysis: Optional[InterviewFeedback] = None
    createdAt: Optional[datetime] = None

class SessionDetail(BaseModel):
    session: PlacementSessionDto
    messages: List[ChatMessage] = []

class CodingExample(BaseModel):
    input: str
    output: str

class CodingTest(BaseModel):
    input: str
    expectedOutput: str
    hidden: bool = False

class CodingProblem(BaseModel):
    title: str
    statement: str
    examples: List[CodingExample] = []
    constraints: str = ""
    difficulty: str = "MEDIUM"
    topics: List[str] = []
    testCases: List[CodingTest] = []

class CodingSessionResponse(BaseModel):
    sessionId: str
    problem: CodingProblem

class CreateCodingBody(BaseModel):
    role: str = "Software Engineer"
    topic: str = "Algorithms"
    difficulty: str = "MEDIUM"

class CodingEvaluation(BaseModel):
    correctness: int = 0
    timeComplexity: str = "O(n)"
    spaceComplexity: str = "O(1)"
    codeQuality: int = 0
    naming: int = 0
    optimization: int = 0
    feedback: str = ""
    alternativeSolutions: List[str] = []
    expectedQuestions: List[str] = []

class CodingTestResult(BaseModel):
    passed: bool
    input: str
    expectedOutput: str
    actualOutput: str
    error: Optional[str] = None
    hidden: bool = False

class CodingSubmitResponse(BaseModel):
    evaluation: CodingEvaluation
    passed: bool
    totalScore: int
    testResults: List[CodingTestResult] = []
    passedTests: int = 0
    totalTests: int = 0
    standardResponse: Optional[Dict[str, Any]] = None

class SubmitCodingBody(BaseModel):
    language: str = "python"
    code: str

class AptitudeQuestion(BaseModel):
    id: str
    text: str
    options: List[str]
    correctAnswerIndex: Optional[int] = None
    explanation: Optional[str] = None
    shortcut: Optional[str] = None
    difficulty: str = "MEDIUM"
    companyFrequency: str = "HIGH"

class AptitudeTest(BaseModel):
    questions: List[AptitudeQuestion]

class AptitudeTestResponse(BaseModel):
    sessionId: str
    test: AptitudeTest

class CreateAptitudeBody(BaseModel):
    category: str = "QUANTITATIVE"
    difficulty: str = "MEDIUM"
    count: int = 5

class AptitudeAnswer(BaseModel):
    questionId: str
    selectedIndex: int

class SubmitAptitudeBody(BaseModel):
    answers: List[AptitudeAnswer]

class AptitudeDetail(BaseModel):
    questionId: str
    correct: bool
    correctAnswerIndex: int
    yourAnswer: Optional[int] = None
    explanation: Optional[str] = None

class AptitudeSubmitResponse(BaseModel):
    score: int
    total: int
    percentage: float
    sessionCompleted: bool
    detailed: List[AptitudeDetail] = []

class AnalyticsData(BaseModel):
    technical: int = 0
    hr: int = 0
    communication: int = 0
    coding: int = 0
    dsa: int = 0
    aptitude: int = 0
    resume: int = 0
    overallReadiness: int = 0
    daily: List[Dict[str, Any]] = []
    weekly: List[Dict[str, Any]] = []
    monthly: List[Dict[str, Any]] = []
    timeSpentMinutes: int = 0
    accuracy: int = 0
    successRate: int = 0
    strongTopics: List[str] = []
    weakTopics: List[str] = []
    scoreBreakdown: Dict[str, str] = {}
    standardResponse: Optional[Dict[str, Any]] = None

class ReadinessComponent(BaseModel):
    name: str
    score: int
    weight: float
    isAssessed: bool = True
    evidenceSummary: str = ""

class LearningPathItem(BaseModel):
    topic: str
    resources: List[str] = []
    estimatedHours: int = 5
    priority: str = "HIGH"

class ReadinessData(BaseModel):
    score: int
    label: str
    components: List[ReadinessComponent] = []
    recommendedCompanies: List[str] = []
    recommendedRoles: List[str] = []
    learningPath: List[LearningPathItem] = []
    skillEvaluations: List[SkillEvaluation] = []
    missingAssessments: List[str] = []
    dimensionBreakdown: List[DimensionBreakdown] = []
    standardResponse: Optional[Dict[str, Any]] = None

class CompanyPreparation(BaseModel):
    company: str
    notes: str

class RoadmapData(BaseModel):
    weakTopics: List[str] = []
    dailyTasks: List[str] = []
    weeklyGoals: List[str] = []
    interviewSchedule: List[str] = []
    companyPreparation: List[CompanyPreparation] = []
    resumeImprovements: List[str] = []
    codingRecommendations: List[str] = []
    dsaRevision: List[str] = []
    aptitudePractice: List[str] = []
    generatedAt: Optional[str] = None
    standardResponse: Optional[Dict[str, Any]] = None

class PlacementResetResponse(BaseModel):
    reset: bool
    deletedSessions: int
    deletedResumes: int
