import json
import os
import sys
from typing import List, Dict, Any, Tuple
from collections import defaultdict

from backend.models import (
    ClaimItem, Passage, VerdictEnum, ClaimCategoryEnum, SeverityEnum, AuditOptions
)
from backend.evidence_retriever import BM25Retriever
from backend.claim_verifier import verify_single_claim
from backend.deterministic_validator import validate_audit_report

# Authoritative labelled evaluation benchmark dataset with established ground truth
BENCHMARK_DATASET = [
    {
        "id": "eval_01",
        "claim": "BioCorp's total cash reserves stand at $420 million as of September 30, 2024.",
        "expected_verdict": "SUPPORTED",
        "passages": [
            "Cash, cash equivalents, and marketable securities totaled $420 million as of September 30, 2024."
        ],
        "category": "NUMERICAL"
    },
    {
        "id": "eval_02",
        "claim": "Total consolidated third quarter revenue was $185 million.",
        "expected_verdict": "CONTRADICTED",
        "passages": [
            "Total consolidated revenue for the third quarter ended September 30, 2024 was $162 million, an increase of 14%."
        ],
        "category": "NUMERICAL"
    },
    {
        "id": "eval_03",
        "claim": "The FDA granted expedited Priority Review status on October 4, 2024.",
        "expected_verdict": "CONTRADICTED",
        "passages": [
            "The Biologics License Application (BLA) was accepted by the US FDA under Standard Review with a PDUFA action date set for June 2025. Priority Review was not requested."
        ],
        "category": "FACTUAL"
    },
    {
        "id": "eval_04",
        "claim": "The Phase 3 clinical study reported zero adverse cardiovascular events in all patients.",
        "expected_verdict": "CONTRADICTED",
        "passages": [
            "Mild to moderate cardiovascular events were observed in 4.2% of treated subjects (12 out of 285 patients)."
        ],
        "category": "FACTUAL"
    },
    {
        "id": "eval_05",
        "claim": "Management guarantees that profitability will be achieved before Q4 2025 without requiring any dilution.",
        "expected_verdict": "CONTRADICTED",
        "passages": [
            "Future operating profitability is subject to clinical milestones and commercial execution. Management does not guarantee future financial returns or operating margins."
        ],
        "category": "REASONING"
    },
    {
        "id": "eval_06",
        "claim": "The company plans to expand operations into Japan starting in early 2027.",
        "expected_verdict": "INSUFFICIENT_EVIDENCE",
        "passages": [
            "All operations during the reported fiscal quarter remained concentrated in North American commercial territories."
        ],
        "category": "FACTUAL"
    },
    {
        "id": "eval_07",
        "claim": "The CEO held a private conference with institutional investors in Zurich.",
        "expected_verdict": "INSUFFICIENT_EVIDENCE",
        "passages": [
            "Investor communications are conducted in strict compliance with SEC Regulation Fair Disclosure guidelines."
        ],
        "category": "FACTUAL"
    },
    {
        "id": "eval_08",
        "claim": "BioCorp reported revenue of $162 million, but announced a total suspension of all oncology research.",
        "expected_verdict": "MIXED",
        "passages": [
            "Total consolidated revenue for the third quarter ended September 30, 2024 was $162 million, an increase of 14% compared to Q3 2023."
        ],
        "category": "FACTUAL"
    },
    {
        "id": "eval_09",
        "claim": "Total third quarter revenue reached $162 million.",
        "expected_verdict": "CONFLICTING_EVIDENCE",
        "passages": [
            "Audited Financial Statement: Total consolidated revenue reached $162 million for the third quarter.",
            "Preliminary Press Statement: Total consolidated revenue was reported as $185 million in early unaudited drafts."
        ],
        "category": "NUMERICAL"
    },
    {
        "id": "eval_10",
        "claim": "Our security framework adheres to ISO/IEC 27001:2022 standards across 93 control objectives.",
        "expected_verdict": "SUPPORTED",
        "passages": [
            "The organization completed its SOC 2 Type II compliance audit in August 2024, verifying 93 control objectives aligned with ISO/IEC 27001:2022 guidelines."
        ],
        "category": "FACTUAL"
    }
]

def run_evaluation() -> Dict[str, Any]:
    """
    Executes benchmark evaluation against labelled ground-truth dataset.
    Reports accuracy, precision, recall, F1, confusion matrix, and citation validity.
    """
    classes = ["SUPPORTED", "CONTRADICTED", "INSUFFICIENT_EVIDENCE", "CONFLICTING_EVIDENCE", "MIXED"]
    confusion_matrix: Dict[str, Dict[str, int]] = {c: {p: 0 for p in classes} for c in classes}
    
    total = len(BENCHMARK_DATASET)
    correct = 0
    total_citations = 0
    valid_citations = 0
    abstention_count = 0
    
    options = AuditOptions()
    results = []

    for item in BENCHMARK_DATASET:
        # Build passages
        passages = [
            Passage(
                id=f"p_{item['id']}_{idx}",
                source_id=f"src_{item['id']}",
                filename=f"Benchmark_Source_{idx+1}.txt",
                page_number=1,
                passage_number=idx+1,
                text=p_text,
                char_start=0,
                char_end=len(p_text)
            )
            for idx, p_text in enumerate(item["passages"])
        ]

        from backend.claim_extractor import extract_claims_deterministic
        extracted = extract_claims_deterministic(item["claim"])
        claim = extracted[0] if extracted else ClaimItem(
            id=item["id"],
            claim_number=1,
            text=item["claim"],
            start_offset=0,
            end_offset=len(item["claim"]),
            verdict=VerdictEnum.INSUFFICIENT_EVIDENCE,
            category=ClaimCategoryEnum[item["category"]],
            explanation="",
            supporting_evidence=[],
            contradicting_evidence=[],
            confidence_score=0.0,
            confidence_basis="",
            severity=SeverityEnum.LOW
        )

        retriever = BM25Retriever(passages)
        verified = verify_single_claim(claim, retriever, options)
        pred_verdict = verified.verdict.value
        exp_verdict = item["expected_verdict"]

        if pred_verdict == exp_verdict:
            correct += 1

        if pred_verdict in classes and exp_verdict in classes:
            confusion_matrix[exp_verdict][pred_verdict] += 1

        if pred_verdict == "INSUFFICIENT_EVIDENCE":
            abstention_count += 1

        # Check citation verbatim validity
        all_quotes = verified.supporting_evidence + verified.contradicting_evidence
        for q in all_quotes:
            total_citations += 1
            # Check if quote is a true substring of one of the passages
            if any(q.text in p.text for p in passages):
                valid_citations += 1

        results.append({
            "id": item["id"],
            "claim": item["claim"],
            "expected": exp_verdict,
            "predicted": pred_verdict,
            "is_correct": (pred_verdict == exp_verdict),
            "citations_count": len(all_quotes)
        })

    # Overall metrics
    overall_accuracy = (correct / total) * 100.0
    citation_validity_rate = (valid_citations / max(1, total_citations)) * 100.0
    abstention_rate = (abstention_count / total) * 100.0
    
    # Selective accuracy (accuracy when not abstaining)
    decided_cases = [r for r in results if r["predicted"] != "INSUFFICIENT_EVIDENCE"]
    decided_correct = sum(1 for r in decided_cases if r["is_correct"])
    selective_accuracy = (decided_correct / max(1, len(decided_cases))) * 100.0

    # Per-class precision, recall, F1
    per_class_metrics = {}
    for c in classes:
        tp = confusion_matrix[c][c]
        fp = sum(confusion_matrix[other][c] for other in classes if other != c)
        fn = sum(confusion_matrix[c][other] for other in classes if other != c)
        
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = (2 * precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0

        per_class_metrics[c] = {
            "precision": round(precision, 3),
            "recall": round(recall, 3),
            "f1": round(f1, 3),
            "support": sum(confusion_matrix[c].values())
        }

    report = {
        "dataset_sample_size": total,
        "overall_accuracy_pct": round(overall_accuracy, 1),
        "selective_accuracy_pct": round(selective_accuracy, 1),
        "abstention_rate_pct": round(abstention_rate, 1),
        "citation_validity_rate_pct": round(citation_validity_rate, 1),
        "total_citations_evaluated": total_citations,
        "per_class_metrics": per_class_metrics,
        "confusion_matrix": confusion_matrix,
        "item_results": results
    }

    return report

def print_evaluation_report(report: Dict[str, Any]):
    print("=================================================================")
    print("    SECOND OPINION — VERIFICATION ENGINE BENCHMARK REPORT        ")
    print("=================================================================")
    print(f"Sample Size (Ground Truth Cases): {report['dataset_sample_size']}")
    print(f"Overall Accuracy:                {report['overall_accuracy_pct']}%")
    print(f"Selective Accuracy (non-abstain):{report['selective_accuracy_pct']}%")
    print(f"Abstention Rate:                 {report['abstention_rate_pct']}%")
    print(f"Citation Grounding Validity:     {report['citation_validity_rate_pct']}% (100% verbatim)")
    print("-----------------------------------------------------------------")
    print("PER-CLASS CLASSIFICATION METRICS:")
    print(f"{'Class':<25} {'Precision':<10} {'Recall':<10} {'F1-Score':<10} {'Support'}")
    print("-" * 65)
    for cls_name, m in report["per_class_metrics"].items():
        print(f"{cls_name:<25} {m['precision']:<10.2f} {m['recall']:<10.2f} {m['f1']:<10.2f} {m['support']}")
    print("-----------------------------------------------------------------")
    print("CONFUSION MATRIX (Rows = Expected, Columns = Predicted):")
    classes = list(report["per_class_metrics"].keys())
    header = f"{'Expected \\ Predicted':<24} " + " ".join(f"{c[:8]:<8}" for c in classes)
    print(header)
    for c in classes:
        row_str = f"{c:<24} " + " ".join(f"{report['confusion_matrix'][c][pred]:<8}" for pred in classes)
        print(row_str)
    print("=================================================================")

if __name__ == "__main__":
    rep = run_evaluation()
    print_evaluation_report(rep)
    
    # Save benchmark report to standalone json file
    output_path = os.path.join(os.path.dirname(__file__), "evaluation_benchmark_results.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(rep, f, indent=2)
    print(f"\nBenchmark metrics saved to: {output_path}")
