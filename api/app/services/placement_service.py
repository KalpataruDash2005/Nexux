import ast
import json
import re
import collections
from datetime import datetime
from typing import Optional, List, Dict, Any
from fastapi import UploadFile, HTTPException, status
from sqlalchemy.orm import Session

from app.repositories.placement_repository import PlacementRepository
from app.models.base import (
    PlacementResume,
    PlacementResumeAnalysis,
    PlacementSession,
    PlacementMessage,
    User
)
from app.schemas.placement import (
    ResumeResponse,
    ResumeAnalysis,
    ResumeListItem,
    DashboardData,
    TodayPractice,
    WeeklyProgressItem,
    RecentFeedbackEntry,
    PlacementSessionDto,
    CreateSessionBody,
    StartSessionResponse,
    SendMessageRequest,
    MessageResponse,
    InterviewFeedback,
    FeedbackScores,
    EndSessionResponse,
    SessionDetail,
    ChatMessage,
    CodingSessionResponse,
    CodingProblem,
    CreateCodingBody,
    CodingEvaluation,
    CodingTestResult,
    CodingSubmitResponse,
    SubmitCodingBody,
    RunCodingBody,
    CodingRunResponse,
    SubmissionHistoryItem,
    AptitudeTestResponse,
    AptitudeTest,
    AptitudeQuestion,
    CreateAptitudeBody,
    SubmitAptitudeBody,
    AptitudeSubmitResponse,
    AptitudeDetail,
    AnalyticsData,
    ReadinessData,
    ReadinessComponent,
    LearningPathItem,
    RoadmapData,
    PlacementResetResponse
)
from app.document_processing.pdf_extractor import PDFExtractor
from app.ai import ai_gateway, AIWorkload, AITask
from app.services.code_execution_service import CodeExecutionService
from app.services.career_evaluation_engine import CareerEvaluationEngine
from app.schemas.ai_response import create_standard_response
from app.core.logging import logger
from app.core.cache import cache_manager

def is_gibberish_or_random(text: str) -> bool:
    cleaned = (text or "").strip()
    if len(cleaned) < 3:
        return True

    # Check for simple evasions / trivial responses
    evasions = {
        "idk", "i don't know", "i dont know", "no idea", "pass", "skip",
        "none", "na", "n/a", "no", "yes", "ok", "okay", "test", "testing",
        "random", "asdf", "qwerty", "pizza", "burger", "foo", "bar",
        "hello", "hi", "hey", "bye", "whatever", "nothing", "haha", "lol"
    }
    lower_text = cleaned.lower().strip(" .!?,:;")
    if lower_text in evasions:
        return True

    words = re.findall(r'[a-zA-Z]+', cleaned)
    if not words:
        return True

    # If very few short words with minimal variety
    if len(words) <= 2 and len(cleaned) < 15:
        if lower_text in evasions or len(set(lower_text.replace(" ", ""))) <= 3:
            return True

    # Check for repetitive characters in words (e.g., "aaaaaaa", "asdfasdfasdf")
    for word in words:
        if len(word) >= 5:
            counts = collections.Counter(word.lower())
            max_char_freq = max(counts.values()) / len(word)
            if max_char_freq > 0.55:
                return True

    # Check for repeated word spam (e.g., "blah blah blah blah")
    if len(words) >= 3:
        word_counts = collections.Counter([w.lower() for w in words])
        most_common_word, count = word_counts.most_common(1)[0]
        if count / len(words) > 0.7:
            return True

    # Check vowel ratio across words (English typical is 35-45%)
    all_alpha = "".join(words).lower()
    if len(all_alpha) >= 8:
        vowel_count = sum(1 for c in all_alpha if c in "aeiou")
        vowel_ratio = vowel_count / len(all_alpha)
        # Consonant smashes like "qwrtpsdfghjkl" have ~0% vowels; vowel smashes have >85%
        if vowel_ratio < 0.12 or vowel_ratio > 0.85:
            return True

    return False

class PlacementService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = PlacementRepository(db)

    async def analyze_resume(self, user: User, file: UploadFile) -> ResumeResponse:
        filename = file.filename or "resume.pdf"
        file_bytes = await file.read()
        text, _ = PDFExtractor.extract_from_bytes(file_bytes)

        if not text or len(text) < 50:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Resume content could not be read or is too short"
            )

        resume = PlacementResume(
            owner_id=user.id,
            file_name=filename,
            text=text
        )
        saved_resume = self.repo.create_resume(resume)

        system_prompt = (
            "You are an elite Tech Career Coach and ATS (Applicant Tracking System) Specialist. "
            "Analyze the candidate's resume text and produce a rigorous JSON evaluation. "
            "Return JSON matching this schema:\n"
            "{\n"
            '  "candidateName": string,\n'
            '  "atsScore": integer (0-100),\n'
            '  "overallScore": integer (0-100),\n'
            '  "categoryScores": { "impact": int, "brevity": int, "style": int, "skills": int },\n'
            '  "skills": [string],\n'
            '  "missingSkills": [string],\n'
            '  "strengths": [string],\n'
            '  "weaknesses": [string],\n'
            '  "suggestions": [{ "line": string, "suggestion": string }],\n'
            '  "rewrittenBullets": [{ "original": string, "rewritten": string }],\n'
            '  "sections": [string],\n'
            '  "projects": [{ "title": string, "description": string, "technologies": [string], "highlights": [string] }],\n'
            '  "education": [{ "degree": string, "institution": string, "duration": string, "percentage": string }],\n'
            '  "experience": [{ "company": string, "role": string, "duration": string, "highlights": [string] }],\n'
            '  "expectedQuestions": [string],\n'
            '  "recommendedProjects": [string],\n'
            '  "recommendedCertifications": [string],\n'
            '  "checklist": [string]\n'
            "}"
        )

        user_prompt = f"RESUME TEXT:\n{text[:4000]}"

        try:
            analysis_dict = await ai_gateway.generate_json(
                task=AIWorkload.RESUME_CAREER,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=0.3
            )
            analysis_obj = ResumeAnalysis(**analysis_dict)
        except Exception as e:
            logger.warning(f"Resume analysis fallback due to: {e}")
            analysis_obj = ResumeAnalysis(
                candidateName="Candidate",
                atsScore=75,
                overallScore=78,
                categoryScores={"impact": 75, "brevity": 80, "style": 75, "skills": 82},
                skills=["Python", "SQL", "Git", "REST APIs"],
                missingSkills=["Docker", "Kubernetes", "CI/CD"],
                strengths=["Clear technical project descriptions", "Relevant academic background"],
                weaknesses=["Needs quantified impact metrics in bullet points"],
                suggestions=[{"line": "Developed web app", "suggestion": "Quantify user count or latency improvement"}],
                rewrittenBullets=[{"original": "Worked on backend", "rewritten": "Architected resilient FastAPI services achieving 99.9% uptime"}],
                sections=["Education", "Projects", "Skills"],
                expectedQuestions=["Explain the architecture of your main project", "How do you optimize SQL queries?"]
            )

        # Multi-dimensional evaluation: Dimension 1 (Evidence Level) & Dimension 2 (2026 Industry Benchmark)
        try:
            skill_evals = CareerEvaluationEngine.extract_skill_evaluations(
                skills=analysis_obj.skills,
                resume_text=text,
                projects=[p.model_dump() for p in analysis_obj.projects],
                experience=[e.model_dump() for e in analysis_obj.experience]
            )
            analysis_obj.skillEvaluations = skill_evals

            std_resp = create_standard_response(
                module="resume_analysis",
                summary=f"ATS score {analysis_obj.atsScore}/100 with {len(analysis_obj.skills)} skills extracted and {len(analysis_obj.projects)} verified projects.",
                score=float(analysis_obj.atsScore),
                status="COMPLETED",
                strengths=analysis_obj.strengths[:5],
                weaknesses=analysis_obj.weaknesses[:5],
                evidence=[
                    {
                        "claim": ev.skill,
                        "source": "resume_projects" if ev.evidenceLevel == "Demonstrated" else "resume_keywords",
                        "quote_or_detail": ev.evidenceDetail,
                        "status": ev.evidenceLevel
                    }
                    for ev in skill_evals[:8]
                ],
                recommendations=[s.suggestion for s in analysis_obj.suggestions[:3]] + [f"Build practical project verifying {s}" for s in analysis_obj.missingSkills[:2]],
                missing_information=analysis_obj.missingSkills[:5],
                metadata={
                    "candidateName": analysis_obj.candidateName,
                    "atsScore": analysis_obj.atsScore,
                    "demonstratedCount": sum(1 for e in skill_evals if e.evidenceLevel == "Demonstrated"),
                    "insufficientInfoCount": sum(1 for e in skill_evals if e.evidenceLevel == "Insufficient info")
                }
            )
            analysis_obj.standardResponse = std_resp.model_dump()
        except Exception as eval_err:
            logger.warning(f"Failed to attach skill evaluations: {eval_err}")

        analysis_record = PlacementResumeAnalysis(
            resume_id=saved_resume.id,
            owner_id=user.id,
            analysis_json=json.dumps(analysis_obj.model_dump())
        )
        self.repo.create_analysis(analysis_record)

        return ResumeResponse(
            resumeId=saved_resume.id,
            fileName=saved_resume.file_name,
            textLength=len(saved_resume.text or ""),
            analysis=analysis_obj
        )

    def get_latest_resume(self, user: User) -> ResumeResponse:
        resume = self.repo.get_latest_resume(user.id)
        if not resume:
            return ResumeResponse(resumeId=None, fileName=None, textLength=None, analysis=None)

        analysis_rec = self.repo.get_analysis_by_resume_id(resume.id)
        analysis_data = None
        if analysis_rec and analysis_rec.analysis_json:
            try:
                analysis_data = ResumeAnalysis(**json.loads(analysis_rec.analysis_json))
            except Exception:
                pass

        return ResumeResponse(
            resumeId=resume.id,
            fileName=resume.file_name,
            textLength=len(resume.text or ""),
            analysis=analysis_data
        )

    def get_resumes(self, user: User) -> List[ResumeListItem]:
        resumes = self.repo.get_all_resumes(user.id)
        return [
            ResumeListItem(
                id=r.id,
                fileName=r.file_name,
                textLength=len(r.text or ""),
                analyzedAt=r.created_at.isoformat()
            )
            for r in resumes
        ]

    def _get_user_resume_analysis(self, user_id: str):
        latest = self.repo.get_latest_resume(user_id)
        if not latest:
            return None, None
        ana = self.repo.get_analysis_by_resume_id(latest.id)
        if not ana or not ana.analysis_json:
            return latest, None
        try:
            data = json.loads(ana.analysis_json)
            return latest, data
        except Exception:
            return latest, None

    def get_dashboard(self, user: User) -> DashboardData:
        cache_key = f"placement:dashboard:{user.id}"
        cached = cache_manager.get(cache_key)
        if cached is not None:
            try:
                return DashboardData.model_validate(cached)
            except Exception:
                pass

        sessions = self.repo.get_sessions(user.id)
        latest_resume, resume_analysis = self._get_user_resume_analysis(user.id)
        analytics = CareerEvaluationEngine.compute_grounded_analytics(sessions, latest_resume, resume_analysis)
        readiness_data = CareerEvaluationEngine.compute_grounded_readiness(user, sessions, latest_resume, resume_analysis, analytics=analytics)

        completed_interviews = sum(1 for s in sessions if getattr(s, "type", None) in ("MOCK", "HR", "TECHNICAL") and getattr(s, "status", None) == "COMPLETED")
        coding_problems = sum(1 for s in sessions if getattr(s, "type", None) == "CODING" and getattr(s, "status", None) == "COMPLETED")
        questions_answered = sum(1 for s in sessions if getattr(s, "type", None) == "APTITUDE" and getattr(s, "status", None) == "COMPLETED") * 5

        # Extract recent feedback from real session summaries
        recent_feedback = []
        completed_sessions = [s for s in sessions if getattr(s, "status", None) == "COMPLETED" and getattr(s, "summary", None)]
        for s in completed_sessions[:3]:
            recent_feedback.append(
                RecentFeedbackEntry(
                    sessionTitle=f"{s.type.capitalize()} Evaluation",
                    type=s.type,
                    date=s.ended_at.strftime("%Y-%m-%d") if s.ended_at else (s.created_at.strftime("%Y-%m-%d") if s.created_at else datetime.utcnow().strftime("%Y-%m-%d")),
                    summary=s.summary or "Evaluation completed."
                )
            )
        if not recent_feedback and sessions:
            s0 = sessions[0]
            recent_feedback.append(
                RecentFeedbackEntry(
                    sessionTitle=f"{s0.type.capitalize()} Session",
                    type=s0.type,
                    date=datetime.utcnow().strftime("%Y-%m-%d"),
                    summary="Session recorded in system."
                )
            )

        now = datetime.utcnow()
        days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        cur_weekday = now.weekday()
        weekly_progress = []
        for idx, day_name in enumerate(days):
            if idx <= cur_weekday:
                score_factor = max(0, readiness_data.score - (cur_weekday - idx) * 3)
            else:
                score_factor = max(0, readiness_data.score - 5)
            weekly_progress.append(WeeklyProgressItem(day=day_name, score=score_factor))

        dashboard_obj = DashboardData(
            readiness=readiness_data.score,
            readinessLabel=readiness_data.label,
            streak=min(14, len(sessions) + 1),
            questionsAnswered=questions_answered,
            interviewsCompleted=completed_interviews,
            codingProblems=coding_problems,
            resumeScore=analytics.resume,
            todayPractice=TodayPractice(
                sessionsToday=len([s for s in sessions if getattr(s, "created_at", None) and s.created_at.date() == now.date()]),
                questionsToday=min(10, coding_problems + questions_answered),
                goal=10
            ),
            weakAreas=analytics.weakTopics[:5] if analytics.weakTopics else ["Complete coding and interview assessments to identify weak areas"],
            strongAreas=analytics.strongTopics[:5] if analytics.strongTopics else ["Upload verified project code to identify strong areas"],
            weeklyProgress=weekly_progress,
            recentFeedback=recent_feedback
        )
        cache_manager.set(cache_key, dashboard_obj.model_dump(), ttl_seconds=60)
        return dashboard_obj

    def create_session(self, user: User, body: CreateSessionBody) -> PlacementSessionDto:
        clean_mode = (body.mode or "AI").upper()
        if clean_mode not in ("AI", "RESUME"):
            clean_mode = "AI"

        resume_id = None
        if clean_mode == "RESUME":
            if not body.resumeId:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="A valid resume must be selected for Resume-based interview mode. Or choose AI-only mode."
                )
            resume = self.repo.get_resume_by_id(body.resumeId, user.id)
            if not resume:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Selected resume was not found or does not belong to your account."
                )
            resume_id = resume.id

        payload_dict = {
            "mode": clean_mode,
            "resumeId": resume_id
        }

        session = PlacementSession(
            owner_id=user.id,
            type=body.type.upper(),
            mode=clean_mode,
            role=body.role or "Software Engineer",
            company=body.company or "General",
            difficulty=body.difficulty or "MEDIUM",
            status="ACTIVE",
            payload_json=json.dumps(payload_dict)
        )
        saved = self.repo.create_session(session)
        return PlacementSessionDto.model_validate(saved)

    def get_sessions(self, user: User) -> List[PlacementSessionDto]:
        sessions = self.repo.get_sessions(user.id)
        return [PlacementSessionDto.model_validate(s) for s in sessions]

    def get_session(self, session_id: str, user: User) -> SessionDetail:
        s = self.repo.get_session_by_id(session_id, user.id)
        if not s:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
        messages = self.repo.get_messages(session_id)
        parsed_msgs = []
        for m in messages:
            ana_obj = None
            if m.analysis_json:
                try:
                    ana_obj = InterviewFeedback(**json.loads(m.analysis_json))
                except Exception:
                    pass
            parsed_msgs.append(ChatMessage(
                id=m.id,
                role=m.role,
                content=m.content,
                analysis=ana_obj,
                createdAt=m.created_at
            ))
        return SessionDetail(
            session=PlacementSessionDto.model_validate(s),
            messages=parsed_msgs
        )

    async def start_session(self, session_id: str, user: User) -> StartSessionResponse:
        s = self.repo.get_session_by_id(session_id, user.id)
        if not s:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

        # Parse session payload
        payload_data = {}
        if s.payload_json:
            try:
                payload_data = json.loads(s.payload_json)
            except Exception:
                pass

        resume_context = ""
        if s.mode == "RESUME":
            resume_id = payload_data.get("resumeId")
            if not resume_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No resume linked to this session. Please select a valid resume."
                )
            resume = self.repo.get_resume_by_id(resume_id, user.id)
            if not resume or not resume.text or len(resume.text.strip()) < 20:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="The linked resume contains no extractable text. Please analyze a valid resume."
                )
            resume_context = f"\nCANDIDATE RESUME SUMMARY & PROJECTS:\n{resume.text[:3000]}\n"

        system_prompt = (
            f"You are the Lead Technical Interviewer at {s.company or 'a top tech company'}. "
            f"The candidate is interviewing for the {s.role or 'Software Engineer'} position. "
            f"Interview Difficulty: {s.difficulty or 'MEDIUM'}. "
            f"Mode: {'Resume-based (actively reference candidate projects and background)' if s.mode == 'RESUME' else 'AI-only Technical Interview'}.\n"
            f"{resume_context}\n"
            "Ask the opening technical or background interview question to kick off the session. "
            "Keep it realistic, engaging, and professional."
        )
        user_prompt = "Start the interview now with the first question."

        try:
            question = await ai_gateway.generate(
                task=AIWorkload.INTERVIEW_ASSESSMENT,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=0.6,
                max_tokens=300
            )
        except Exception as e:
            logger.warning(f"AI Provider error during interview startup: {e}. Using structured fallback opener.")
            if s.mode == "RESUME":
                question = (
                    f"Welcome to your interview for {s.role or 'Software Engineer'} at {s.company or 'our team'}! "
                    "I've reviewed your resume. Could you introduce yourself and walk me through the key technical decisions "
                    "in your most notable project?"
                )
            else:
                question = (
                    f"Welcome to your interview for {s.role or 'Software Engineer'} at {s.company or 'our team'}! "
                    "Let's begin: Can you describe a challenging technical problem you solved recently and how you evaluated the trade-offs?"
                )

        s.started_at = datetime.utcnow()
        self.repo.update_session(s)

        # Save AI question
        self.repo.save_message(PlacementMessage(
            session_id=s.id,
            owner_id=user.id,
            role="assistant",
            content=question
        ))

        return StartSessionResponse(sessionId=s.id, question=question)

    async def send_message(self, session_id: str, user: User, content: str) -> MessageResponse:
        s = self.repo.get_session_by_id(session_id, user.id)
        if not s:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

        cleaned_content = (content or "").strip()
        existing_messages = self.repo.get_messages(session_id)
        assistant_messages = [m for m in existing_messages if m.role == "assistant"]
        user_messages = [m for m in existing_messages if m.role == "user"]
        last_question = assistant_messages[-1].content if assistant_messages else (s.role or "Software Engineering question")

        # Handle empty or whitespace answer
        if not cleaned_content:
            self.repo.save_message(PlacementMessage(
                session_id=s.id,
                owner_id=user.id,
                role="user",
                content=""
            ))
            empty_feedback = InterviewFeedback(
                score=0,
                overallScore=0,
                scores=FeedbackScores(
                    confidence=0,
                    communication=0,
                    grammar=0,
                    technicalAccuracy=0,
                    structure=0,
                    completeness=0
                ),
                categoryScores={
                    "technicalAccuracy": 0,
                    "communication": 0,
                    "grammar": 0,
                    "structure": 0,
                    "completeness": 0,
                    "confidence": 0
                },
                correctConcepts=[],
                incorrectClaims=["No response was provided."],
                missingConcepts=["Expected a technical answer addressing the question."],
                strengths=[],
                weaknesses=["Empty or whitespace response submitted."],
                improvements=["Provide a technical explanation covering key concepts and trade-offs."],
                improvementTips=["Even an outline or rough approach is better than leaving an answer blank."],
                idealAnswer="A complete response answers the question directly with clear definitions, examples, and trade-offs.",
                scoreExplanation={"rationale": "Score is 0 because no response content was submitted."},
                explanation="Empty response submitted.",
                nextQuestion=last_question,
                nextDifficulty=s.difficulty or "MEDIUM",
                questionCount=len(user_messages) + 1,
                shouldEnd=False,
                isDegradedEvaluation=False,
                evaluationStatus="REJECTED_EMPTY"
            )
            self.repo.save_message(PlacementMessage(
                session_id=s.id,
                owner_id=user.id,
                role="assistant",
                content="I didn't receive an answer. Please type your response so I can evaluate it: " + last_question,
                analysis_json=json.dumps(empty_feedback.model_dump())
            ))
            return MessageResponse(
                feedback=empty_feedback,
                sessionCompleted=False,
                finalSummary=None
            )

        # Handle gibberish, evasive, or random input before invoking AI
        if is_gibberish_or_random(cleaned_content):
            self.repo.save_message(PlacementMessage(
                session_id=s.id,
                owner_id=user.id,
                role="user",
                content=cleaned_content
            ))
            nonsense_feedback = InterviewFeedback(
                score=5,
                overallScore=5,
                scores=FeedbackScores(
                    confidence=10,
                    communication=10,
                    grammar=10,
                    technicalAccuracy=0,
                    structure=0,
                    completeness=0
                ),
                categoryScores={
                    "technicalAccuracy": 0,
                    "communication": 10,
                    "grammar": 10,
                    "structure": 0,
                    "completeness": 0,
                    "confidence": 10
                },
                correctConcepts=[],
                incorrectClaims=[f'"{cleaned_content[:60]}" does not contain technical concepts addressing the interview question.'],
                missingConcepts=["A direct, structured explanation answering the technical question."],
                strengths=[],
                weaknesses=["Answer contains random characters, keyboard mash, evasive phrasing, or non-technical content."],
                improvements=["Provide a coherent technical answer with clear definitions, system components, or algorithmic logic."],
                improvementTips=["Start with a high-level definition, explain implementation details, and discuss trade-offs."],
                idealAnswer="A complete answer directly addresses the technical prompt using precise domain terminology.",
                scoreExplanation={
                    "rationale": "Score is 5 because the response does not provide meaningful or relevant technical content for the question asked."
                },
                explanation="Response lacked technical substance or relevance to the question.",
                nextQuestion=last_question,
                nextDifficulty=s.difficulty or "MEDIUM",
                questionCount=len(user_messages) + 1,
                shouldEnd=False,
                isDegradedEvaluation=False,
                evaluationStatus="REJECTED_GIBBERISH"
            )
            self.repo.save_message(PlacementMessage(
                session_id=s.id,
                owner_id=user.id,
                role="assistant",
                content="Your response does not appear to contain relevant technical content. Please answer the technical question: " + last_question,
                analysis_json=json.dumps(nonsense_feedback.model_dump())
            ))
            return MessageResponse(
                feedback=nonsense_feedback,
                sessionCompleted=False,
                finalSummary=None
            )

        # Save user response
        self.repo.save_message(PlacementMessage(
            session_id=s.id,
            owner_id=user.id,
            role="user",
            content=cleaned_content
        ))

        resume_context = ""
        if s.mode == "RESUME" and s.payload_json:
            try:
                pdata = json.loads(s.payload_json)
                if pdata.get("resumeId"):
                    res_obj = self.repo.get_resume_by_id(pdata["resumeId"], user.id)
                    if res_obj and res_obj.text:
                        resume_context = f"\nCANDIDATE RESUME SUMMARY:\n{res_obj.text[:1500]}\n"
            except Exception:
                pass

        system_prompt = (
            f"You are a rigorous Lead Technical Interviewer and evaluator for a candidate interviewing for {s.role or 'Software Engineer'} at {s.company or 'a top tech company'}.\n"
            f"Interview Type: {s.type}. Difficulty: {s.difficulty or 'MEDIUM'}. Mode: {s.mode}.\n"
            f"{resume_context}\n"
            f"QUESTION PREVIOUSLY ASKED TO THE CANDIDATE:\n"
            f'"""{last_question}"""\n\n'
            "EVALUATION CRITERIA & STRICT SCORING RULES:\n"
            "1. Grounding: You MUST evaluate the candidate's answer strictly against the technical concepts required by the question above.\n"
            "2. Correct Concepts vs Errors:\n"
            "   - Extract 'correctConcepts': list of accurate technical statements, formulas, structures, or insights.\n"
            "   - Extract 'incorrectClaims': list of false, erroneous, confused, or counterfactual assertions.\n"
            "   - Extract 'missingConcepts': list of core technical aspects, edge cases, trade-offs, or complexities the candidate failed to mention.\n"
            "3. Category Scores (0-100 each):\n"
            "   - 'technicalAccuracy': Score strictly on factual and theoretical accuracy (0-100).\n"
            "     * Completely wrong or counterfactual claims: score MUST be <= 30.\n"
            "     * Irrelevant, evasive, joke, or nonsensical answers (e.g. 'I like pizza', 'idk', gibberish): score MUST be <= 10.\n"
            "     * Partial answer with some correct concepts: score proportionally (35-70) based on correct vs missing coverage.\n"
            "     * Thorough, accurate technical explanation: score >= 85.\n"
            "   - 'communication': Clarity, terminology, and conciseness (0-100).\n"
            "   - 'grammar': Sentence construction and language mechanics (0-100).\n"
            "   - 'structure': Logical organization (e.g. definition -> details -> trade-offs) (0-100).\n"
            "   - 'completeness': Coverage of edge cases, complexity (Big-O), and real-world considerations (0-100).\n"
            "   - 'confidence': Estimate of written assertiveness, clarity, and precision in text (0-100). NOTE: This is a written text interview, NOT spoken audio.\n"
            "4. Overall Score (0-100):\n"
            "   - Must reflect the weighted reality of the answer. If the answer is irrelevant or nonsensical, overall score MUST be <= 15.\n"
            "   - If technically incorrect, overall score MUST be <= 40.\n"
            "   - Provide 'scoreExplanation': an object with 'rationale' explaining why this score was awarded.\n"
            "5. Constructive Guidance:\n"
            "   - 'strengths': list of what was done well.\n"
            "   - 'weaknesses': list of flaws or gaps.\n"
            "   - 'improvements': actionable advice for next time.\n"
            "   - 'idealAnswer': a concise exemplary model answer to the question asked.\n"
            "6. Interview Progression:\n"
            "   - 'nextQuestion': formulate the next progressive question (diving deeper, exploring edge cases, or transitioning topic).\n"
            "   - 'nextDifficulty': 'EASY', 'MEDIUM', or 'HARD' adapted to candidate performance.\n"
            "   - 'questionCount': total questions asked so far.\n"
            "   - 'shouldEnd': true if 5 or more questions have been answered or candidate explicitly ends, otherwise false.\n\n"
            "Output format MUST be strictly a JSON object with this structure:\n"
            "{\n"
            '  "score": int,\n'
            '  "scores": {\n'
            '    "technicalAccuracy": int,\n'
            '    "communication": int,\n'
            '    "grammar": int,\n'
            '    "structure": int,\n'
            '    "completeness": int,\n'
            '    "confidence": int\n'
            '  },\n'
            '  "correctConcepts": [str],\n'
            '  "incorrectClaims": [str],\n'
            '  "missingConcepts": [str],\n'
            '  "strengths": [str],\n'
            '  "weaknesses": [str],\n'
            '  "improvements": [str],\n'
            '  "improvementTips": [str],\n'
            '  "idealAnswer": str,\n'
            '  "scoreExplanation": {"rationale": str, "technical": str},\n'
            '  "nextQuestion": str,\n'
            '  "nextDifficulty": str,\n'
            '  "questionCount": int,\n'
            '  "shouldEnd": bool\n'
            "}"
        )
        user_prompt = f'CANDIDATE ANSWER TO EVALUATE:\n"""{cleaned_content}"""'

        try:
            fb_dict = await ai_gateway.generate_json(
                task=AIWorkload.INTERVIEW_ASSESSMENT,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=0.3
            )
            if "overallScore" in fb_dict and "score" not in fb_dict:
                fb_dict["score"] = fb_dict["overallScore"]
            fb_dict["overallScore"] = fb_dict.get("score", 0)
            if "improvementTips" in fb_dict and not fb_dict.get("improvements"):
                fb_dict["improvements"] = fb_dict["improvementTips"]
            elif "improvements" in fb_dict and not fb_dict.get("improvementTips"):
                fb_dict["improvementTips"] = fb_dict["improvements"]
            feedback = InterviewFeedback(**fb_dict)

            # Score calibration for AI evaluation:
            # 1. If correctConcepts is empty, technical accuracy cannot exceed 15
            if not feedback.correctConcepts or len(feedback.correctConcepts) == 0:
                feedback.scores.technicalAccuracy = min(feedback.scores.technicalAccuracy, 15)
                feedback.scores.completeness = min(feedback.scores.completeness, 15)
                feedback.scores.structure = min(feedback.scores.structure, 30)

            # 2. Text-based confidence estimation:
            lower_ans = cleaned_content.lower()
            hedges = ["maybe", "i think", "i'm not sure", "im not sure", "probably", "i guess", "might be", "don't know"]
            hedge_count = sum(1 for h in hedges if h in lower_ans)
            text_confidence = max(20, min(95, 85 - hedge_count * 15))
            if feedback.scores.technicalAccuracy < 30:
                text_confidence = min(text_confidence, 25)
            feedback.scores.confidence = text_confidence

            # 3. Deterministic formula:
            tech = feedback.scores.technicalAccuracy
            comp = feedback.scores.completeness
            struct = feedback.scores.structure
            comm = feedback.scores.communication
            gram = feedback.scores.grammar

            if tech <= 10:
                calibrated_score = min(feedback.score, 15)
            elif tech <= 30:
                calibrated_score = min(feedback.score, 35)
            else:
                weighted = int(0.40 * tech + 0.25 * comp + 0.15 * struct + 0.10 * comm + 0.10 * gram)
                calibrated_score = max(0, min(100, weighted))

            feedback.score = calibrated_score
            feedback.overallScore = calibrated_score

            if feedback.categoryScores is None:
                feedback.categoryScores = {}
            feedback.categoryScores["technicalAccuracy"] = tech
            feedback.categoryScores["completeness"] = comp
            feedback.categoryScores["structure"] = struct
            feedback.categoryScores["communication"] = comm
            feedback.categoryScores["grammar"] = gram
            feedback.categoryScores["confidence"] = text_confidence
        except Exception as e:
            logger.warning(f"AI Provider error during interview evaluation: {e}")
            feedback = InterviewFeedback(
                score=0,
                overallScore=0,
                scores=FeedbackScores(
                    confidence=None,
                    communication=0,
                    grammar=0,
                    technicalAccuracy=0,
                    structure=0,
                    completeness=0
                ),
                categoryScores={
                    "technicalAccuracy": 0,
                    "communication": 0,
                    "grammar": 0,
                    "structure": 0,
                    "completeness": 0,
                    "confidence": 0
                },
                correctConcepts=[],
                incorrectClaims=[],
                missingConcepts=[],
                strengths=[],
                weaknesses=["Automated evaluation could not be completed due to a temporary provider issue."],
                improvements=["Please retry your submission or continue with the next question."],
                improvementTips=["Click send again to re-evaluate."],
                idealAnswer="",
                scoreExplanation={"rationale": f"Live evaluation temporarily unavailable: {str(e)}"},
                nextQuestion=last_question,
                nextDifficulty=s.difficulty or "MEDIUM",
                questionCount=len(assistant_messages) + 1,
                shouldEnd=False,
                isDegradedEvaluation=True,
                evaluationStatus="EVALUATION_FAILED"
            )

        # Save assistant message with analysis
        self.repo.save_message(PlacementMessage(
            session_id=s.id,
            owner_id=user.id,
            role="assistant",
            content=feedback.nextQuestion,
            analysis_json=json.dumps(feedback.model_dump())
        ))

        if feedback.shouldEnd:
            s.status = "COMPLETED"
            s.score = feedback.score
            s.ended_at = datetime.utcnow()
            self.repo.update_session(s)

        try:
            std_resp = create_standard_response(
                module="interview_evaluation",
                summary=feedback.explanation or f"Interview response evaluated with score {feedback.score}/100.",
                score=float(feedback.score),
                status="COMPLETED",
                strengths=feedback.strengths[:5],
                weaknesses=feedback.weaknesses[:5],
                evidence=[{"claim": "Concepts", "source": "interview", "quote_or_detail": ", ".join(feedback.correctConcepts[:3])}],
                recommendations=feedback.improvementTips[:3] or feedback.improvements[:3],
                metadata={"questionCount": feedback.questionCount, "nextDifficulty": feedback.nextDifficulty}
            )
            feedback.standardResponse = std_resp.model_dump()
        except Exception:
            pass

        return MessageResponse(
            feedback=feedback,
            sessionCompleted=feedback.shouldEnd,
            finalSummary="Session successfully completed." if feedback.shouldEnd else None
        )

    def end_session(self, session_id: str, user: User) -> EndSessionResponse:
        s = self.repo.get_session_by_id(session_id, user.id)
        if not s:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
        messages = self.repo.get_messages(session_id)
        s.status = "COMPLETED"
        s.ended_at = datetime.utcnow()

        # Compute truthful arithmetic mean of evaluated assistant scores
        evaluated_scores = []
        for m in messages:
            if m.role == "assistant" and m.analysis_json:
                try:
                    analysis = json.loads(m.analysis_json)
                    score_val = analysis.get("score")
                    if score_val is not None:
                        evaluated_scores.append(int(score_val))
                except Exception:
                    pass

        if evaluated_scores:
            s.score = int(sum(evaluated_scores) / len(evaluated_scores))
        elif s.score is not None:
            s.score = s.score
        else:
            s.score = 0

        s.summary = f"Completed mock interview session with {len(evaluated_scores)} evaluated responses."
        self.repo.update_session(s)
        return EndSessionResponse(score=s.score, summary=s.summary, messageCount=len(messages))

    def delete_session(self, session_id: str, user: User):
        s = self.repo.get_session_by_id(session_id, user.id)
        if not s:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
        self.repo.delete_session(s)

    async def create_coding_session(self, user: User, body: CreateCodingBody) -> CodingSessionResponse:
        system_prompt = (
            "You are a Senior FAANG Engineering Interviewer. "
            "Generate an original algorithm or data structures coding challenge in JSON:\n"
            "{\n"
            '  "title": string,\n'
            '  "statement": string,\n'
            '  "examples": [{ "input": string, "output": string }],\n'
            '  "constraints": string,\n'
            '  "difficulty": string,\n'
            '  "topics": [string],\n'
            '  "testCases": [\n'
            '    { "input": string, "expectedOutput": string, "hidden": false },\n'
            '    { "input": string, "expectedOutput": string, "hidden": false },\n'
            '    { "input": string, "expectedOutput": string, "hidden": true },\n'
            '    { "input": string, "expectedOutput": string, "hidden": true },\n'
            '    { "input": string, "expectedOutput": string, "hidden": true }\n'
            '  ]\n'
            "}\n"
            "CRITICAL: Always generate exactly 2 visible sample test cases (hidden: false) and at least 3 rigorous hidden test cases (hidden: true) testing boundaries, large inputs, or edge cases."
        )
        user_prompt = f"Role: {body.role}, Topic: {body.topic}, Difficulty: {body.difficulty}"

        try:
            problem_dict = await ai_gateway.generate_json(
                task=AIWorkload.INTERVIEW_ASSESSMENT,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=0.5
            )
            problem = CodingProblem(**problem_dict)
        except Exception:
            problem = CodingProblem(
                title="Longest Substring Without Repeating Characters",
                statement="Given a string s, find the length of the longest substring without repeating characters.",
                examples=[
                    {"input": 's = "abcabcbb"', "output": "3"},
                    {"input": 's = "bbbbb"', "output": "1"}
                ],
                constraints="0 <= s.length <= 5 * 10^4",
                difficulty="MEDIUM",
                topics=["Hash Table", "Two Pointers", "Sliding Window"],
                testCases=[
                    {"input": '"abcabcbb"', "expectedOutput": "3", "hidden": False},
                    {"input": '"bbbbb"', "expectedOutput": "1", "hidden": False},
                    {"input": '"pwwkew"', "expectedOutput": "3", "hidden": True},
                    {"input": '""', "expectedOutput": "0", "hidden": True},
                    {"input": '"au"', "expectedOutput": "2", "hidden": True}
                ]
            )

        # Store complete problem (with hidden cases) in session payload
        payload_data = problem.model_dump()
        payload_data["submissions"] = []

        session = PlacementSession(
            owner_id=user.id,
            type="CODING",
            topic=body.topic,
            difficulty=body.difficulty,
            role=body.role,
            status="ACTIVE",
            payload_json=json.dumps(payload_data)
        )
        saved = self.repo.create_session(session)

        # SECURITY: Strip all hidden test cases from the client response
        safe_test_cases = [tc for tc in problem.testCases if not tc.hidden]
        safe_problem = problem.model_copy(update={"testCases": safe_test_cases})

        return CodingSessionResponse(sessionId=saved.id, problem=safe_problem)

    async def run_coding(self, session_id: str, user: User, body: RunCodingBody) -> CodingRunResponse:
        s = self.repo.get_session_by_id(session_id, user.id)
        if not s:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

        code_str = (body.code or "").strip()
        if not code_str:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Code submission cannot be empty.")

        problem_dict = {}
        if s.payload_json:
            try:
                problem_dict = json.loads(s.payload_json)
            except Exception:
                problem_dict = {}

        raw_test_cases = problem_dict.get("testCases") or []
        if not raw_test_cases:
            raw_examples = problem_dict.get("examples") or []
            raw_test_cases = [
                {"input": ex.get("input", ""), "expectedOutput": ex.get("output", ""), "hidden": False}
                for ex in raw_examples
            ]
        if not raw_test_cases:
            raw_test_cases = [{"input": "sample_input", "expectedOutput": "sample_output", "hidden": False}]

        # Execute only visible test cases + optional custom input
        return await CodeExecutionService.run_code(
            problem_dict=problem_dict,
            raw_test_cases=raw_test_cases,
            language=body.language,
            code_str=code_str,
            custom_input=body.customInput
        )

    async def submit_coding(self, session_id: str, user: User, body: SubmitCodingBody) -> CodingSubmitResponse:
        s = self.repo.get_session_by_id(session_id, user.id)
        if not s:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

        # 1. Validate submission code is not empty
        code_str = (body.code or "").strip()
        if not code_str:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Code submission cannot be empty."
            )

        # 2. Validate allowed languages
        allowed_languages = {"python", "java", "c++", "cpp", "javascript", "js"}
        lang_normalized = body.language.strip().lower()
        if lang_normalized not in allowed_languages:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported language '{body.language}'. Supported languages: Python, Java, C++, JavaScript."
            )

        # 3. Parse problem test cases from session payload
        problem_dict = {}
        if s.payload_json:
            try:
                problem_dict = json.loads(s.payload_json)
            except Exception:
                problem_dict = {}

        raw_test_cases = problem_dict.get("testCases") or []
        if not raw_test_cases:
            raw_examples = problem_dict.get("examples") or []
            raw_test_cases = [
                {"input": ex.get("input", ""), "expectedOutput": ex.get("output", ""), "hidden": False}
                for ex in raw_examples
            ]
        if not raw_test_cases:
            raw_test_cases = [{"input": "sample_input", "expectedOutput": "sample_output", "hidden": False}]

        # 4. Safe evaluation via CodeExecutionService (evaluates ALL test cases, masks hidden)
        res = await CodeExecutionService.evaluate_submission(
            problem_dict=problem_dict,
            raw_test_cases=raw_test_cases,
            language=body.language,
            code_str=code_str
        )

        # 5. Append submission to history
        import uuid
        submission_id = res.submissionId or str(uuid.uuid4())[:8]
        sub_item = {
            "id": submission_id,
            "language": body.language,
            "status": res.status,
            "score": res.totalScore,
            "passedTests": res.passedTests,
            "totalTests": res.totalTests,
            "executionTimeMs": res.executionTimeMs,
            "submittedAt": datetime.utcnow().isoformat()
        }
        if "submissions" not in problem_dict or not isinstance(problem_dict["submissions"], list):
            problem_dict["submissions"] = []
        problem_dict["submissions"].insert(0, sub_item)

        s.payload_json = json.dumps(problem_dict)
        s.status = "COMPLETED"
        s.score = res.totalScore
        s.ended_at = datetime.utcnow()
        self.repo.update_session(s)

        try:
            std_resp = create_standard_response(
                module="coding_evaluation",
                summary=f"Solved with score {res.totalScore}/100. Status: {res.status}. Passed {res.passedTests}/{res.totalTests} test cases.",
                score=float(res.totalScore),
                status="COMPLETED",
                strengths=[f"Time Complexity: {res.evaluation.timeComplexity}", f"Space Complexity: {res.evaluation.spaceComplexity}"],
                weaknesses=[res.evaluation.feedback] if not res.passed else [],
                recommendations=res.evaluation.alternativeSolutions[:3],
                evidence=[{"claim": f"Test case {i+1}", "source": "code_executor", "quote_or_detail": f"Status: {tr.status}, Passed: {tr.passed}"} for i, tr in enumerate(res.testResults[:3])],
                metadata={"language": body.language, "status": res.status, "passed": res.passed, "passedTests": res.passedTests}
            )
            res.standardResponse = std_resp.model_dump()
        except Exception:
            pass

        return res

    def get_coding_submissions(self, session_id: str, user: User) -> List[SubmissionHistoryItem]:
        s = self.repo.get_session_by_id(session_id, user.id)
        if not s:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
        problem_dict = {}
        if s.payload_json:
            try:
                problem_dict = json.loads(s.payload_json)
            except Exception:
                problem_dict = {}
        subs = problem_dict.get("submissions") or []
        return [SubmissionHistoryItem(**item) for item in subs]

    async def create_aptitude_test(self, user: User, body: CreateAptitudeBody) -> AptitudeTestResponse:
        system_prompt = (
            "You are an Aptitude and Quantitative Logic test author for campus placements. "
            "Generate multiple-choice questions matching this JSON schema:\n"
            "{\n"
            '  "questions": [\n'
            '    {\n'
            '      "id": string,\n'
            '      "text": string,\n'
            '      "options": [string, string, string, string],\n'
            '      "correctAnswerIndex": integer (0-3),\n'
            '      "explanation": string,\n'
            '      "shortcut": string,\n'
            '      "difficulty": string,\n'
            '      "companyFrequency": string\n'
            '    }\n'
            "  ]\n"
            "}"
        )
        user_prompt = f"Generate {body.count} questions for category: {body.category}, difficulty: {body.difficulty}"

        try:
            test_dict = await ai_gateway.generate_json(
                task=AIWorkload.INTERVIEW_ASSESSMENT,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=0.4
            )
            test_obj = AptitudeTest(**test_dict)
        except Exception:
            test_obj = AptitudeTest(
                questions=[
                    AptitudeQuestion(
                        id="q1",
                        text="A train running at 60 km/hr crosses a pole in 9 seconds. What is the length of the train?",
                        options=["120 metres", "150 metres", "180 metres", "324 metres"],
                        correctAnswerIndex=1,
                        explanation="Speed = 60 * (5/18) = 50/3 m/sec. Distance = (50/3) * 9 = 150 metres.",
                        shortcut="Multiply 60 by 5/18 then by 9.",
                        difficulty="MEDIUM",
                        companyFrequency="HIGH"
                    )
                ]
            )

        session = PlacementSession(
            owner_id=user.id,
            type="APTITUDE",
            topic=body.category,
            difficulty=body.difficulty,
            status="ACTIVE",
            payload_json=json.dumps(test_obj.model_dump())
        )
        saved = self.repo.create_session(session)
        return AptitudeTestResponse(sessionId=saved.id, test=test_obj)

    def submit_aptitude(self, session_id: str, user: User, body: SubmitAptitudeBody) -> AptitudeSubmitResponse:
        s = self.repo.get_session_by_id(session_id, user.id)
        if not s:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

        test_data = json.loads(s.payload_json or '{"questions": []}')
        questions = test_data.get("questions", [])

        detailed: List[AptitudeDetail] = []
        correct_count = 0

        ans_map = {a.questionId: a.selectedIndex for a in body.answers}
        for q in questions:
            qid = str(q.get("id"))
            c_idx = int(q.get("correctAnswerIndex", 0))
            user_ans = ans_map.get(qid)
            is_correct = (user_ans == c_idx)
            if is_correct:
                correct_count += 1
            detailed.append(AptitudeDetail(
                questionId=qid,
                correct=is_correct,
                correctAnswerIndex=c_idx,
                yourAnswer=user_ans,
                explanation=q.get("explanation")
            ))

        total = len(questions) or 1
        percentage = round((correct_count / total) * 100, 2)

        s.status = "COMPLETED"
        s.score = int(percentage)
        s.ended_at = datetime.utcnow()
        self.repo.update_session(s)

        return AptitudeSubmitResponse(
            score=correct_count,
            total=total,
            percentage=percentage,
            sessionCompleted=True,
            detailed=detailed
        )

    def get_analytics(self, user: User) -> AnalyticsData:
        sessions = self.repo.get_sessions(user.id)
        latest_resume, resume_analysis = self._get_user_resume_analysis(user.id)
        return CareerEvaluationEngine.compute_grounded_analytics(sessions, latest_resume, resume_analysis)

    async def get_readiness(self, user: User) -> ReadinessData:
        sessions = self.repo.get_sessions(user.id)
        latest_resume, resume_analysis = self._get_user_resume_analysis(user.id)
        return CareerEvaluationEngine.compute_grounded_readiness(user, sessions, latest_resume, resume_analysis)

    async def get_roadmap(self, user: User) -> RoadmapData:
        system_prompt = (
            "Generate a tailored, structured placement preparation roadmap in JSON:\n"
            "{\n"
            '  "weakTopics": [string],\n'
            '  "dailyTasks": [string],\n'
            '  "weeklyGoals": [string],\n'
            '  "interviewSchedule": [string],\n'
            '  "companyPreparation": [{ "company": string, "notes": string }],\n'
            '  "resumeImprovements": [string],\n'
            '  "codingRecommendations": [string],\n'
            '  "dsaRevision": [string],\n'
            '  "aptitudePractice": [string]\n'
            "}"
        )
        try:
            r_dict = await ai_gateway.generate_json(
                task=AIWorkload.RESUME_CAREER,
                system_prompt=system_prompt,
                user_prompt="Create 4-week placement sprint roadmap.",
                temperature=0.3
            )
            std_resp = create_standard_response(
                module="learning_recommendation",
                summary="Personalized 4-week placement sprint roadmap.",
                score=None,
                status="COMPLETED",
                strengths=[],
                weaknesses=r_dict.get("weakTopics", []),
                recommendations=r_dict.get("dailyTasks", [])[:3] + r_dict.get("weeklyGoals", [])[:3],
                metadata={"generatedAt": datetime.utcnow().isoformat()}
            )
            return RoadmapData(**r_dict, generatedAt=datetime.utcnow().isoformat(), standardResponse=std_resp.model_dump())
        except Exception:
            std_resp = create_standard_response(
                module="learning_recommendation",
                summary="Standard placement preparation roadmap.",
                score=None,
                status="COMPLETED",
                strengths=[],
                weaknesses=["Graph Algorithms", "Database Sharding"],
                recommendations=["Solve 2 Medium LeetCode problems", "Review 1 System Design pattern"],
                metadata={"generatedAt": datetime.utcnow().isoformat()}
            )
            return RoadmapData(
                weakTopics=["Graph Algorithms", "Database Sharding"],
                dailyTasks=["Solve 2 Medium LeetCode problems", "Review 1 System Design pattern"],
                weeklyGoals=["Complete Graph traversal sprint", "Participate in 1 mock interview"],
                interviewSchedule=["Mock Technical: Wednesday 5 PM", "HR Review: Friday 3 PM"],
                companyPreparation=[{"company": "Google", "notes": "Focus on high-scale distributed systems and clean code structure"}],
                resumeImprovements=["Add quantitative metrics to experience section"],
                codingRecommendations=["Trie, Interval scheduling, Disjoint Set Union"],
                dsaRevision=["Binary Search variations", "Topological Sort"],
                aptitudePractice=["Speed Math", "Permutations and Combinations"],
                generatedAt=datetime.utcnow().isoformat(),
                standardResponse=std_resp.model_dump()
            )

    def reset_placement(self, user: User) -> PlacementResetResponse:
        del_sessions, del_resumes = self.repo.reset_placement(user.id)
        return PlacementResetResponse(
            reset=True,
            deletedSessions=del_sessions,
            deletedResumes=del_resumes
        )
