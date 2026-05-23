#!/usr/bin/env python3
import argparse
import json
import os
import re
import sys
from pathlib import Path


def emit(payload, exit_code=0):
    sys.stdout.write(json.dumps(payload, ensure_ascii=False))
    return exit_code


def read_text(path):
    return Path(path).read_text(encoding="utf-8", errors="replace")


def compact_text(value):
    return re.sub(r"\s+", " ", str(value or "")).strip()


def extract_pdf(args):
    try:
        import pdfplumber
    except Exception as exc:
        return emit({"ok": False, "error": f"pdfplumber import failed: {exc}"}, 1)

    try:
        pages_text = []
        layout_warnings = []
        with pdfplumber.open(args.input) as pdf:
            for index, page in enumerate(pdf.pages, start=1):
                text = page.extract_text(x_tolerance=1, y_tolerance=3) or ""
                if not text.strip():
                    layout_warnings.append(f"page_{index}_empty_text")
                pages_text.append(text)

        normalized = "\n\n".join(pages_text)
        normalized = normalized.replace("\r", "\n")
        normalized = re.sub(r"[ \t]+\n", "\n", normalized)
        normalized = re.sub(r"\n{3,}", "\n\n", normalized).strip()

        return emit({
            "ok": True,
            "parser": "pdfplumber",
            "text": normalized,
            "page_count": len(pages_text),
            "layout_warnings": layout_warnings,
        })
    except Exception as exc:
        return emit({"ok": False, "error": f"pdfplumber extraction failed: {exc}"}, 1)


def load_spacy_model():
    try:
        import spacy
    except Exception as exc:
        return None, f"spaCy import failed: {exc}"

    model_name = os.getenv("SPACY_MODEL", "en_core_web_sm")
    try:
        return spacy.load(model_name), None
    except Exception as load_exc:
        try:
            nlp = spacy.blank("en")
            nlp.add_pipe("sentencizer")
            return nlp, f"spaCy model fallback used: {load_exc}"
        except Exception as fallback_exc:
            return None, f"spaCy model load failed: {load_exc}; fallback failed: {fallback_exc}"


def numeric_claims(text):
    claim_pattern = re.compile(
        r"(?:(?:reduced|improved|increased|decreased|saved|cut|grew|raised|lowered|delivered|built|processed|handled|supported)[^.:\n]{0,120})?"
        r"(?:\d+(?:\.\d+)?\s?%|\d+(?:\.\d+)?\+?\s?(?:years?|users?|requests?|records?|hours?|minutes?|seconds?|projects?|pipelines?|dashboards?))",
        re.I,
    )
    return [compact_text(match.group(0)) for match in claim_pattern.finditer(text)][:40]


def analyze_text(args):
    text = read_text(args.input)
    nlp, warning = load_spacy_model()
    if nlp is None:
        return emit({"ok": False, "error": warning or "spaCy unavailable"}, 1)

    doc = nlp(text[:200000])
    sentences = [compact_text(sent.text) for sent in doc.sents if compact_text(sent.text)]
    noun_chunks = []
    if doc.has_annotation("DEP"):
        noun_chunks = [compact_text(chunk.text) for chunk in doc.noun_chunks if len(compact_text(chunk.text)) > 2]

    entities = [
        {"text": compact_text(ent.text), "label": ent.label_}
        for ent in doc.ents
        if compact_text(ent.text)
    ][:80]
    action_verbs = sorted({
        token.lemma_.lower()
        for token in doc
        if token.pos_ == "VERB" and len(token.lemma_) > 2
    })[:80]

    return emit({
        "ok": True,
        "parser": "spaCy",
        "kind": args.kind,
        "model": os.getenv("SPACY_MODEL", "en_core_web_sm"),
        "warnings": [warning] if warning else [],
        "sentences": sentences[:200],
        "noun_chunks": sorted(set(noun_chunks), key=lambda item: (len(item), item.lower()))[:120],
        "entities": entities,
        "action_verbs": action_verbs,
        "numeric_claims": numeric_claims(text),
    })


def lexical_tokens(text):
    return {
        token
        for token in re.sub(r"[^a-z0-9+#\s]", " ", str(text or "").lower()).split()
        if len(token) > 1 and token not in {"and", "or", "the", "with", "for", "to", "of", "in", "a", "an"}
    }


def lexical_score(requirement_text, evidence_text):
    requirement_tokens = lexical_tokens(requirement_text)
    evidence_tokens = lexical_tokens(evidence_text)
    if not requirement_tokens or not evidence_tokens:
        return 0.0
    overlap = requirement_tokens & evidence_tokens
    return len(overlap) / max(1, len(requirement_tokens))


def cosine_scores_with_sentence_transformers(requirements, evidence):
    from sentence_transformers import SentenceTransformer, util

    model_name = os.getenv("SENTENCE_TRANSFORMER_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
    model = SentenceTransformer(model_name)
    requirement_texts = [item.get("text") or item.get("label") or "" for item in requirements]
    evidence_texts = [item.get("text") or "" for item in evidence]
    requirement_embeddings = model.encode(requirement_texts, convert_to_tensor=True, normalize_embeddings=True)
    evidence_embeddings = model.encode(evidence_texts, convert_to_tensor=True, normalize_embeddings=True)
    matrix = util.cos_sim(requirement_embeddings, evidence_embeddings)
    return matrix.cpu().tolist(), model_name


def rank_evidence(args):
    requirements = json.loads(read_text(args.requirements))
    evidence = json.loads(read_text(args.evidence))
    top_k = max(1, min(args.top_k, 8))
    model_name = os.getenv("SENTENCE_TRANSFORMER_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
    scorer = "sentence-transformers"

    try:
        scores, model_name = cosine_scores_with_sentence_transformers(requirements, evidence)
    except Exception as exc:
        scorer = "lexical-fallback"
        scores = [
            [lexical_score(requirement.get("text") or requirement.get("label"), item.get("text")) for item in evidence]
            for requirement in requirements
        ]
        model_name = f"lexical-fallback ({exc})"

    ranked = []
    for requirement_index, requirement in enumerate(requirements):
        scored_items = []
        for evidence_index, item in enumerate(evidence):
            scored_items.append({
                "evidenceId": item.get("id") or f"evidence_{evidence_index}",
                "text": item.get("text") or "",
                "sourceType": item.get("sourceType") or "",
                "evidenceStrength": item.get("evidenceStrength") or "",
                "score": round(float(scores[requirement_index][evidence_index]), 6),
            })
        scored_items.sort(key=lambda item: item["score"], reverse=True)
        ranked.append({
            "requirementId": requirement.get("id") or f"requirement_{requirement_index}",
            "label": requirement.get("label") or requirement.get("text") or "",
            "matches": scored_items[:top_k],
        })

    return emit({
        "ok": True,
        "model": model_name,
        "scorer": scorer,
        "matches": ranked,
    })


def main():
    parser = argparse.ArgumentParser(description="Open-source NLP helper for Kiwi AI backend")
    subparsers = parser.add_subparsers(dest="command", required=True)

    pdf_parser = subparsers.add_parser("extract-pdf")
    pdf_parser.add_argument("--input", required=True)
    pdf_parser.set_defaults(func=extract_pdf)

    analyze_parser = subparsers.add_parser("analyze-text")
    analyze_parser.add_argument("--kind", choices=["cv", "jd"], required=True)
    analyze_parser.add_argument("--input", required=True)
    analyze_parser.set_defaults(func=analyze_text)

    rank_parser = subparsers.add_parser("rank-evidence")
    rank_parser.add_argument("--requirements", required=True)
    rank_parser.add_argument("--evidence", required=True)
    rank_parser.add_argument("--top-k", type=int, default=3)
    rank_parser.set_defaults(func=rank_evidence)

    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
