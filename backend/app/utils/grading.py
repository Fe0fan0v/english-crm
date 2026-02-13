"""Server-side answer grading that mirrors BlockRenderer.tsx logic."""
from typing import Any


def grade_answer(block_type: str, content: dict[str, Any], answer: Any) -> bool | None:
    """Grade a student's answer against block content.

    Returns True/False for auto-gradable types, None for essay/flashcards.
    """
    try:
        if block_type == "fill_gaps":
            return _grade_fill_gaps(content, answer)
        elif block_type == "test":
            return _grade_test(content, answer)
        elif block_type == "true_false":
            return _grade_true_false(content, answer)
        elif block_type == "word_order":
            return _grade_word_order(content, answer)
        elif block_type == "matching":
            return _grade_matching(content, answer)
        elif block_type == "image_choice":
            return _grade_image_choice(content, answer)
        elif block_type == "essay":
            return None
        elif block_type == "flashcards":
            return None
        else:
            return None
    except Exception:
        return None


def _grade_fill_gaps(content: dict, answer: Any) -> bool:
    """Check fill_gaps: each gap answer compared case-insensitively with alternatives."""
    gaps = content.get("gaps", [])
    if not gaps or not isinstance(answer, dict):
        return False
    for gap in gaps:
        idx = gap.get("index")
        correct = gap.get("answer", "").lower().strip()
        alternatives = [a.lower().strip() for a in gap.get("alternatives", [])]
        user_answer = str(answer.get(str(idx), answer.get(idx, ""))).lower().strip()
        if user_answer != correct and user_answer not in alternatives:
            return False
    return True


def _grade_test(content: dict, answer: Any) -> bool:
    """Check test: every option's selected state must match is_correct."""
    options = content.get("options", [])
    if not options:
        return False
    if isinstance(answer, list):
        selected_ids = set(str(a) for a in answer)
    elif isinstance(answer, str):
        selected_ids = {answer}
    else:
        return False
    return all(
        (str(opt["id"]) in selected_ids) == opt.get("is_correct", False)
        for opt in options
    )


def _grade_true_false(content: dict, answer: Any) -> bool:
    """Check true_false: boolean comparison."""
    is_true = content.get("is_true", True)
    if not isinstance(answer, bool):
        return False
    return answer == is_true


def _grade_word_order(content: dict, answer: Any) -> bool:
    """Check word_order: joined words must equal correct_sentence."""
    correct = content.get("correct_sentence", "")
    if not isinstance(answer, list):
        return False
    return " ".join(str(w) for w in answer) == correct


def _grade_matching(content: dict, answer: Any) -> bool:
    """Check matching: each pair left→right must match."""
    pairs = content.get("pairs", [])
    if not pairs or not isinstance(answer, dict):
        return False
    return all(
        answer.get(pair["left"]) == pair["right"]
        for pair in pairs
    )


def _grade_image_choice(content: dict, answer: Any) -> bool:
    """Check image_choice: selected option must have is_correct=True."""
    options = content.get("options", [])
    if not options or not isinstance(answer, str):
        return False
    for opt in options:
        if str(opt.get("id")) == answer:
            return opt.get("is_correct", False)
    return False
