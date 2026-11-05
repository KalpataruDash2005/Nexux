import asyncio
import pytest
from unittest.mock import AsyncMock, patch
from sqlalchemy.orm import Session

from app.models.base import User, PlacementSession, PlacementMessage
from app.services.placement_service import PlacementService
from app.schemas.placement import CreateSessionBody

def _setup_active_session(db: Session, user: User, question="Explain how a hash map handles collisions and its amortized time complexity.") -> PlacementSession:
    service = PlacementService(db)
    body = CreateSessionBody(
        type="TECHNICAL",
        mode="AI",
        role="Backend Engineer",
        company="Stripe",
        difficulty="MEDIUM"
    )
    dto = service.create_session(user, body)
    session = db.query(PlacementSession).filter(PlacementSession.id == dto.id).first()
    session.started_at = None
    # Add initial question
    msg = PlacementMessage(
        session_id=session.id,
        owner_id=user.id,
        role="assistant",
        content=question
    )
    db.add(msg)
    db.commit()
    return session

def test_interview_scenario_1_correct_complete_answer(db_session: Session, test_user: User):
    """Scenario 1: Thorough, accurate technical explanation -> high score >= 85, correct concepts identified."""
    async def _test():
        session = _setup_active_session(db_session, test_user)
        service = PlacementService(db_session)

        mock_ai_eval = {
            "score": 92,
            "scores": {
                "technicalAccuracy": 95,
                "communication": 90,
                "grammar": 95,
                "structure": 90,
                "completeness": 92,
                "confidence": 88
            },
            "correctConcepts": [
                "Separate chaining with linked lists or red-black trees",
                "Open addressing (linear/quadratic probing)",
                "O(1) average lookup/insert",
                "Load factor and rehashing trigger"
            ],
            "incorrectClaims": [],
            "missingConcepts": ["Worst-case O(n) under deliberate hash collision attacks"],
            "strengths": ["Clear breakdown of chaining vs open addressing", "Precise amortized complexity analysis"],
            "weaknesses": ["Could briefly mention collision resistance in security contexts"],
            "improvements": ["Mention Java 8 treeification when bucket length exceeds threshold"],
            "idealAnswer": "Hash tables resolve collisions via chaining or open addressing with O(1) average time complexity.",
            "scoreExplanation": {"rationale": "Comprehensive, technically precise coverage of hash collision mechanics."},
            "nextQuestion": "How does Java 8 HashMap optimize long collision chains?",
            "nextDifficulty": "HARD",
            "questionCount": 2,
            "shouldEnd": False
        }

        with patch("app.services.placement_service.ai_gateway.generate_json", new_callable=AsyncMock) as mock_gen:
            mock_gen.return_value = mock_ai_eval
            ans = (
                "Hash maps handle collisions primarily through separate chaining (where each bucket holds a list/tree of entries) "
                "or open addressing (like linear probing or double hashing). The amortized time complexity for get and put operations is O(1) "
                "assuming a uniform hash distribution and reasonable load factor threshold that triggers rehashing before buckets get too long."
            )
            res = await service.send_message(session.id, test_user, ans)

        fb = res.feedback
        assert fb.score >= 85
        assert fb.scores.technicalAccuracy >= 85
        assert len(fb.correctConcepts) >= 2
        assert len(fb.incorrectClaims) == 0
        assert fb.evaluationStatus == "SUCCESS"
        assert fb.isDegradedEvaluation is False

    asyncio.run(_test())

def test_interview_scenario_2_correct_incomplete_answer(db_session: Session, test_user: User):
    """Scenario 2: Correct concepts but incomplete coverage -> proportional partial credit (e.g. 50-70)."""
    async def _test():
        session = _setup_active_session(db_session, test_user)
        service = PlacementService(db_session)

        mock_ai_eval = {
            "score": 60,
            "scores": {
                "technicalAccuracy": 70,
                "communication": 65,
                "grammar": 80,
                "structure": 60,
                "completeness": 45,
                "confidence": 60
            },
            "correctConcepts": ["Chaining via linked lists", "O(1) average time"],
            "incorrectClaims": [],
            "missingConcepts": ["Open addressing alternatives", "Load factor / rehashing", "Worst case O(N)"],
            "strengths": ["Correctly identified separate chaining"],
            "weaknesses": ["Omitted load factor and open addressing"],
            "improvements": ["Explain how the map prevents buckets from degrading into long lists"],
            "idealAnswer": "Hash tables resolve collisions via chaining or open addressing with O(1) average time complexity.",
            "scoreExplanation": {"rationale": "Partially correct. Mentioned chaining but missed open addressing and rehashing."},
            "nextQuestion": "What happens when many keys hash to the same bucket?",
            "nextDifficulty": "MEDIUM",
            "questionCount": 2,
            "shouldEnd": False
        }

        with patch("app.services.placement_service.ai_gateway.generate_json", new_callable=AsyncMock) as mock_gen:
            mock_gen.return_value = mock_ai_eval
            ans = "It uses linked lists at each index to store multiple items. Average time is O(1)."
            res = await service.send_message(session.id, test_user, ans)

        fb = res.feedback
        assert 45 <= fb.score <= 75
        assert fb.scores.completeness < 60
        assert len(fb.missingConcepts) >= 1
        assert fb.evaluationStatus == "SUCCESS"

    asyncio.run(_test())

def test_interview_scenario_3_technically_incorrect_answer(db_session: Session, test_user: User):
    """Scenario 3: Technically incorrect answer -> technicalAccuracy <= 30, overall score <= 40, errors flagged."""
    async def _test():
        session = _setup_active_session(db_session, test_user)
        service = PlacementService(db_session)

        mock_ai_eval = {
            "score": 25,
            "scores": {
                "technicalAccuracy": 20,
                "communication": 50,
                "grammar": 70,
                "structure": 40,
                "completeness": 20,
                "confidence": 40
            },
            "correctConcepts": [],
            "incorrectClaims": [
                "Hash maps sort elements using binary search for O(log n) lookups",
                "Collisions overwrite previous values permanently"
            ],
            "missingConcepts": ["Separate chaining", "Open addressing", "O(1) hash function indexing"],
            "strengths": ["Answer was confident in tone"],
            "weaknesses": ["Fundamental misunderstanding of hashing vs binary search trees"],
            "improvements": ["Review hash table internal array indexing vs search trees"],
            "idealAnswer": "Hash tables use arrays indexed by hash codes, resolving collisions via chaining without overwriting.",
            "scoreExplanation": {"rationale": "Major factual errors: claimed hash maps sort elements with binary search."},
            "nextQuestion": "Let's revisit data structures: How does a hash code compute an array index?",
            "nextDifficulty": "EASY",
            "questionCount": 2,
            "shouldEnd": False
        }

        with patch("app.services.placement_service.ai_gateway.generate_json", new_callable=AsyncMock) as mock_gen:
            mock_gen.return_value = mock_ai_eval
            ans = "A hash map sorts all elements in order and does binary search in O(log n). If two keys collide, the first one is overwritten."
            res = await service.send_message(session.id, test_user, ans)

        fb = res.feedback
        assert fb.scores.technicalAccuracy <= 30
        assert fb.score <= 40
        assert len(fb.incorrectClaims) >= 1

    asyncio.run(_test())

def test_interview_scenario_4_completely_irrelevant_answer(db_session: Session, test_user: User):
    """Scenario 4: Irrelevant or evasive answer -> overall score <= 15, technicalAccuracy <= 10."""
    async def _test():
        session = _setup_active_session(db_session, test_user)
        service = PlacementService(db_session)

        mock_ai_eval = {
            "score": 10,
            "scores": {
                "technicalAccuracy": 5,
                "communication": 20,
                "grammar": 60,
                "structure": 10,
                "completeness": 5,
                "confidence": 10
            },
            "correctConcepts": [],
            "incorrectClaims": [],
            "missingConcepts": ["All technical concepts relevant to hash map collision resolution"],
            "strengths": [],
            "weaknesses": ["Answer did not address the question at all"],
            "improvements": ["Focus directly on the technical topic asked"],
            "idealAnswer": "Hash maps use chaining or probing with O(1) amortized lookup.",
            "scoreExplanation": {"rationale": "Irrelevant response discussing favorite breakfast food instead of hash maps."},
            "nextQuestion": "Can you attempt the question about hash map collision resolution?",
            "nextDifficulty": "EASY",
            "questionCount": 2,
            "shouldEnd": False
        }

        with patch("app.services.placement_service.ai_gateway.generate_json", new_callable=AsyncMock) as mock_gen:
            mock_gen.return_value = mock_ai_eval
            ans = "I really love eating pizza and watching football on Sunday afternoons."
            res = await service.send_message(session.id, test_user, ans)

        fb = res.feedback
        assert fb.score <= 15
        assert fb.scores.technicalAccuracy <= 10

    asyncio.run(_test())

def test_interview_scenario_5_empty_or_whitespace_answer(db_session: Session, test_user: User):
    """Scenario 5: Empty or whitespace answer -> score 0, technicalAccuracy 0, handled without fake score."""
    async def _test():
        session = _setup_active_session(db_session, test_user)
        service = PlacementService(db_session)

        # Send empty whitespace string
        res = await service.send_message(session.id, test_user, "   \n\t  ")

        fb = res.feedback
        assert fb.score == 0
        assert fb.scores.technicalAccuracy == 0
        assert fb.scores.completeness == 0
        assert fb.evaluationStatus == "REJECTED_EMPTY"
        assert len(fb.weaknesses) > 0
        assert "Empty" in fb.weaknesses[0] or "empty" in fb.weaknesses[0]

    asyncio.run(_test())

def test_interview_scenario_6_nonsensical_or_gibberish_answer(db_session: Session, test_user: User):
    """Scenario 6: Nonsensical or random keyboard mash -> score <= 15, technicalAccuracy <= 10."""
    async def _test():
        session = _setup_active_session(db_session, test_user)
        service = PlacementService(db_session)

        mock_ai_eval = {
            "score": 5,
            "scores": {
                "technicalAccuracy": 0,
                "communication": 5,
                "grammar": 0,
                "structure": 0,
                "completeness": 0,
                "confidence": 0
            },
            "correctConcepts": [],
            "incorrectClaims": ["Unintelligible random characters"],
            "missingConcepts": ["All required hash map collision concepts"],
            "strengths": [],
            "weaknesses": ["Gibberish / nonsensical text provided"],
            "improvements": ["Submit coherent technical answers"],
            "idealAnswer": "Hash collision resolution requires chaining or probing.",
            "scoreExplanation": {"rationale": "Random keystrokes submitted."},
            "nextQuestion": "Please provide a coherent answer regarding hash collisions.",
            "nextDifficulty": "EASY",
            "questionCount": 2,
            "shouldEnd": False
        }

        with patch("app.services.placement_service.ai_gateway.generate_json", new_callable=AsyncMock) as mock_gen:
            mock_gen.return_value = mock_ai_eval
            ans = "asdfjkllkjhgfdsazxcvbnm12345!@#$%"
            res = await service.send_message(session.id, test_user, ans)

        fb = res.feedback
        assert fb.score <= 15
        assert fb.scores.technicalAccuracy <= 10

    asyncio.run(_test())

def test_interview_scenario_7_malformed_model_response_or_timeout(db_session: Session, test_user: User):
    """Scenario 7: Provider failure or invalid JSON -> degraded state, score 0, NO fake passing grade (80)."""
    async def _test():
        session = _setup_active_session(db_session, test_user)
        service = PlacementService(db_session)

        # Mock ai_gateway.generate_json to raise TimeoutError
        with patch("app.services.placement_service.ai_gateway.generate_json", new_callable=AsyncMock) as mock_gen:
            mock_gen.side_effect = TimeoutError("Grok upstream gateway timeout")
            ans = "Hash maps use buckets and linked lists."
            res = await service.send_message(session.id, test_user, ans)

        fb = res.feedback
        # MUST NOT fabricate fake 80 passing score
        assert fb.score == 0
        assert fb.scores.technicalAccuracy == 0
        assert fb.isDegradedEvaluation is True
        assert fb.evaluationStatus == "EVALUATION_FAILED"
        assert "Live evaluation temporarily unavailable" in fb.scoreExplanation["rationale"]

    asyncio.run(_test())

def test_interview_deterministic_gibberish_does_not_call_ai(db_session: Session, test_user: User):
    """Deterministic check must block keyboard mash from reaching AI and assign score <= 10."""
    async def _test():
        session = _setup_active_session(db_session, test_user)
        service = PlacementService(db_session)

        with patch("app.services.placement_service.ai_gateway.generate_json", new_callable=AsyncMock) as mock_gen:
            res = await service.send_message(session.id, test_user, "qwrtpsdfghjklzxcvbnm")
            # AI should NOT be called for obvious consonant keyboard mash
            mock_gen.assert_not_called()

        fb = res.feedback
        assert fb.score <= 10
        assert fb.scores.technicalAccuracy <= 10
        assert fb.evaluationStatus == "REJECTED_GIBBERISH"

    asyncio.run(_test())

def test_interview_end_session_truthful_average_score(db_session: Session, test_user: User):
    """end_session must calculate the truthful arithmetic mean across evaluated messages, not default to 82."""
    session = _setup_active_session(db_session, test_user)
    service = PlacementService(db_session)

    # Add 2 messages with evaluated scores 20 and 40
    import json
    msg1 = PlacementMessage(
        session_id=session.id,
        owner_id=test_user.id,
        role="assistant",
        content="Q2?",
        analysis_json=json.dumps({"score": 20})
    )
    msg2 = PlacementMessage(
        session_id=session.id,
        owner_id=test_user.id,
        role="assistant",
        content="Q3?",
        analysis_json=json.dumps({"score": 40})
    )
    db_session.add(msg1)
    db_session.add(msg2)
    db_session.commit()

    end_resp = service.end_session(session.id, test_user)
    assert end_resp.score == 30  # (20 + 40) / 2 = 30, NOT 82!

def test_interview_pydantic_schema_mismatch_string_improvement_tips(db_session: Session, test_user: User):
    """Verifies that string improvementTips and scoreExplanation are safely normalized to valid list and dict."""
    async def _test():
        session = _setup_active_session(db_session, test_user)
        service = PlacementService(db_session)

        # Provider returned improvementTips as string and scoreExplanation as string
        mock_ai_eval = {
            "score": 85,
            "scores": {
                "technicalAccuracy": 85,
                "communication": 80,
                "grammar": 90,
                "structure": 80,
                "completeness": 80,
                "confidence": 85
            },
            "correctConcepts": ["Separate chaining handles collisions by linking nodes"],
            "incorrectClaims": [],
            "missingConcepts": ["Open addressing"],
            "strengths": "Strong explanation of linked node chaining",
            "weaknesses": "Could detail load factor thresholds",
            "improvements": "Review quadratic probing techniques",
            "improvementTips": "Focus on dynamic table resizing and amortized complexity bounds.",
            "idealAnswer": "Hash tables resolve collisions via chaining or probing.",
            "scoreExplanation": "High technical accuracy on chaining fundamentals.",
            "nextQuestion": "How does resizing work?",
            "nextDifficulty": "HARD",
            "questionCount": 2,
            "shouldEnd": False
        }

        with patch("app.services.placement_service.ai_gateway.generate_json", new_callable=AsyncMock) as mock_gen:
            mock_gen.return_value = mock_ai_eval
            ans = "Hash tables use linked lists for chaining collisions, maintaining O(1) amortized time."
            res = await service.send_message(session.id, test_user, ans)

        fb = res.feedback
        assert isinstance(fb.improvementTips, list)
        assert len(fb.improvementTips) == 1
        assert "dynamic table resizing" in fb.improvementTips[0]
        assert isinstance(fb.improvements, list)
        assert isinstance(fb.scoreExplanation, dict)
        assert fb.scoreExplanation.get("rationale") == "High technical accuracy on chaining fundamentals."
        assert fb.evaluationStatus == "SUCCESS"

    asyncio.run(_test())

def test_interview_missing_evaluation_fields_safe_defaults(db_session: Session, test_user: User):
    """Verifies that missing fields or flat scores are safely completed without raising validation errors."""
    async def _test():
        session = _setup_active_session(db_session, test_user)
        service = PlacementService(db_session)

        # Minimal payload missing nested scores object, improvementTips, etc.
        mock_ai_eval = {
            "score": 75,
            "correctConcepts": ["Hash function distribution"],
            "nextQuestion": "What is open addressing?"
        }

        with patch("app.services.placement_service.ai_gateway.generate_json", new_callable=AsyncMock) as mock_gen:
            mock_gen.return_value = mock_ai_eval
            ans = "A hash map uses a hash function to map keys into array indices."
            res = await service.send_message(session.id, test_user, ans)

        fb = res.feedback
        assert fb.score > 0
        assert isinstance(fb.scores.technicalAccuracy, int)
        assert isinstance(fb.improvementTips, list)
        assert fb.evaluationStatus == "SUCCESS"

    asyncio.run(_test())

def test_interview_multiple_consecutive_answers(db_session: Session, test_user: User):
    """Verifies multi-turn interview progression with accurate question counts and message history."""
    async def _test():
        session = _setup_active_session(db_session, test_user)
        service = PlacementService(db_session)

        answers = [
            ("Chaining uses linked lists per bucket with O(1) amortized lookup.", 80),
            ("Open addressing searches for the next available slot via linear probing.", 85),
            ("Load factor is the ratio of stored elements to total capacity.", 90)
        ]

        for i, (ans_text, target_score) in enumerate(answers):
            mock_eval = {
                "score": target_score,
                "scores": {
                    "technicalAccuracy": target_score,
                    "communication": 80,
                    "grammar": 85,
                    "structure": 80,
                    "completeness": 80,
                    "confidence": 85
                },
                "correctConcepts": [f"Concept {i+1}"],
                "incorrectClaims": [],
                "missingConcepts": [],
                "strengths": [f"Good response {i+1}"],
                "weaknesses": [],
                "improvements": [],
                "idealAnswer": "Complete answer",
                "nextQuestion": f"Followup question {i+2}?",
                "questionCount": i + 1,
                "shouldEnd": (i == 2)
            }
            with patch("app.services.placement_service.ai_gateway.generate_json", new_callable=AsyncMock) as mock_gen:
                mock_gen.return_value = mock_eval
                res = await service.send_message(session.id, test_user, ans_text)
                assert abs(res.feedback.score - target_score) <= 6

        end_res = service.end_session(session.id, test_user)
        # Average of scores is accurately calculated
        assert end_res.score >= 80
        assert end_res.messageCount > 4

    asyncio.run(_test())


