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
        elif block_type == "drag_words":
            return _grade_drag_words(content, answer)
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
        user_answer = str(answer.get(str(idx), answer.get(idx, ""))).lower().strip()
        if correct == "":
            # Empty correct answer means any input is accepted
            continue
        alternatives = [a.lower().strip() for a in gap.get("alternatives", [])]
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
    return all(answer.get(pair["left"]) == pair["right"] for pair in pairs)


def _grade_image_choice(content: dict, answer: Any) -> bool:
    """Check image_choice: selected option must have is_correct=True."""
    options = content.get("options", [])
    if not options or not isinstance(answer, str):
        return False
    for opt in options:
        if str(opt.get("id")) == answer:
            return opt.get("is_correct", False)
    return False


def _grade_drag_words(content: dict, answer: Any) -> bool:
    """Check drag_words: each gap must have the correct word placed."""
    words = content.get("words", [])
    if not words or not isinstance(answer, dict):
        return False
    for word_item in words:
        idx = word_item.get("index")
        correct = word_item.get("word", "").lower().strip()
        user_answer = str(answer.get(str(idx), answer.get(idx, ""))).lower().strip()
        if user_answer != correct:
            return False
    return True


def grade_answer_detailed(
    block_type: str, content: dict[str, Any], answer: Any
) -> dict | None:
    """Return detailed per-item grading results for the frontend.

    Returns a dict with granular correctness info so the frontend
    can highlight individual items without having the full answer key.
    """
    try:
        if block_type == "fill_gaps":
            gaps = content.get("gaps", [])
            if not gaps or not isinstance(answer, dict):
                return {"gap_results": {}}
            gap_results = {}
            correct_answers = {}
            for gap in gaps:
                idx = gap.get("index")
                correct = gap.get("answer", "").lower().strip()
                user_answer = (
                    str(answer.get(str(idx), answer.get(idx, ""))).lower().strip()
                )
                if correct == "":
                    gap_results[str(idx)] = True
                else:
                    alternatives = [
                        a.lower().strip() for a in gap.get("alternatives", [])
                    ]
                    is_gap_correct = user_answer == correct or user_answer in alternatives
                    gap_results[str(idx)] = is_gap_correct
                    if not is_gap_correct:
                        correct_answers[str(idx)] = gap.get("answer", "")
            return {"gap_results": gap_results, "correct_answers": correct_answers}

        if block_type == "test":
            options = content.get("options", [])
            if not options:
                return {"option_results": {}}
            selected_ids = set()
            if isinstance(answer, list):
                selected_ids = set(str(a) for a in answer)
            elif isinstance(answer, str):
                selected_ids = {answer}
            option_results = {}
            for opt in options:
                oid = str(opt["id"])
                is_selected = oid in selected_ids
                is_correct = opt.get("is_correct", False)
                if is_selected and is_correct:
                    option_results[oid] = "correct"
                elif is_selected and not is_correct:
                    option_results[oid] = "incorrect"
                elif not is_selected and is_correct:
                    option_results[oid] = "correct_missed"
                else:
                    option_results[oid] = "default"
            return {"option_results": option_results}

        if block_type == "true_false":
            is_true = content.get("is_true", True)
            if not isinstance(answer, bool):
                return {"is_correct": False, "correct_answer": is_true}
            return {"is_correct": answer == is_true, "correct_answer": is_true}

        if block_type == "word_order":
            correct = content.get("correct_sentence", "")
            if not isinstance(answer, list):
                return {"is_correct": False, "correct_sentence": correct}
            return {
                "is_correct": " ".join(str(w) for w in answer) == correct,
                "correct_sentence": correct,
            }

        if block_type == "matching":
            pairs = content.get("pairs", [])
            if not pairs or not isinstance(answer, dict):
                return {"pair_results": {}}
            pair_results = {}
            correct_pairs = {}
            for pair in pairs:
                left = pair["left"]
                is_pair_correct = answer.get(left) == pair["right"]
                pair_results[left] = is_pair_correct
                if not is_pair_correct:
                    correct_pairs[left] = pair["right"]
            return {"pair_results": pair_results, "correct_pairs": correct_pairs}

        if block_type == "image_choice":
            options = content.get("options", [])
            if not options or not isinstance(answer, str):
                return {"option_results": {}}
            option_results = {}
            for opt in options:
                oid = str(opt.get("id"))
                is_selected = oid == answer
                is_correct = opt.get("is_correct", False)
                if is_selected and is_correct:
                    option_results[oid] = "correct"
                elif is_selected and not is_correct:
                    option_results[oid] = "incorrect"
                elif not is_selected and is_correct:
                    option_results[oid] = "correct_missed"
                else:
                    option_results[oid] = "default"
            return {"option_results": option_results}

        if block_type == "drag_words":
            words = content.get("words", [])
            if not words or not isinstance(answer, dict):
                return {"drag_results": {}}
            drag_results = {}
            correct_answers = {}
            for word_item in words:
                idx = word_item.get("index")
                correct = word_item.get("word", "").lower().strip()
                user_answer = (
                    str(answer.get(str(idx), answer.get(idx, ""))).lower().strip()
                )
                is_drag_correct = user_answer == correct
                drag_results[str(idx)] = is_drag_correct
                if not is_drag_correct:
                    correct_answers[str(idx)] = word_item.get("word", "")
            return {"drag_results": drag_results, "correct_answers": correct_answers}

        return None
    except Exception:
        return None
