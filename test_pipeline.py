import urllib.request
import json
import time

def test_full_pipeline():
    print("--- 1. Testing Frontend Server ---")
    html = urllib.request.urlopen("http://127.0.0.1:5173/").read().decode()
    assert "Second Opinion" in html or "root" in html or "vite" in html
    print("Frontend is live on port 5173!")

    print("--- 2. Testing Health & Settings ---")
    health = json.loads(urllib.request.urlopen("http://127.0.0.1:8000/api/health").read().decode())
    print("Health:", health)
    settings = json.loads(urllib.request.urlopen("http://127.0.0.1:8000/api/settings").read().decode())
    print("Settings engine:", settings["engine_mode"])

    print("--- 3. Testing Demo Dataset Retrieval ---")
    demo = json.loads(urllib.request.urlopen("http://127.0.0.1:8000/api/demo/earnings").read().decode())
    print("Loaded demo:", demo["title"])

    print("--- 4. Creating Audit via API ---")
    payload = json.dumps({
        "title": demo["title"],
        "answer_text": demo["answer_text"],
        "source_text": demo["source_text"],
        "options": {
            "verify_sources": True,
            "reasoning_checks": True,
            "safety_review": True,
            "external_verification": False
        }
    }).encode("utf-8")

    req = urllib.request.Request(
        "http://127.0.0.1:8000/api/audits",
        data=payload,
        headers={"Content-Type": "application/json"}
    )
    audit = json.loads(urllib.request.urlopen(req).read().decode())
    audit_id = audit["id"]
    print("Created audit ID:", audit_id, "Status:", audit["status"])

    print("--- 5. Monitoring Multi-Stage Pipeline Execution ---")
    completed = False
    for i in range(30):
        time.sleep(0.4)
        report = json.loads(urllib.request.urlopen(f"http://127.0.0.1:8000/api/audits/{audit_id}").read().decode())
        print(f"[{i+1}] {report['progress_percentage']}% - {report['current_step']} ({report['status']})")
        if report["status"] == "COMPLETED":
            completed = True
            break
        elif report["status"] == "FAILED":
            raise RuntimeError(f"Audit failed: {report.get('error_message')}")

    assert completed, "Audit did not reach COMPLETED status within timeout"
    print("\n--- 6. Evidentiary Ledger Findings ---")
    print(f"Assessment: {report['summary']['overall_assessment']}")
    print(f"Total claims: {len(report['claims'])}")
    for c in report["claims"]:
        print(f"\nClaim #{c['claim_number']}: [{c['verdict']}] ({c['category']})")
        print(f"   Claim text: '{c['text']}'")
        print(f"   Finding: {c['explanation']}")
        print(f"   Confidence: {int(c['confidence_score'] * 100)}% ({c['confidence_basis']})")
        if c.get("suggested_correction"):
            print(f"   Suggested correction: {c['suggested_correction']}")
        if c["contradicting_evidence"]:
            ev = c["contradicting_evidence"][0]
            print(f"   Contradicting quote: '{ev['text']}' from {ev['filename']} (Page {ev['page_number']})")
        if c["supporting_evidence"]:
            ev = c["supporting_evidence"][0]
            print(f"   Supporting quote: '{ev['text']}' from {ev['filename']} (Page {ev['page_number']})")

    print("\n--- 7. Testing Export Functionality ---")
    md = urllib.request.urlopen(f"http://127.0.0.1:8000/api/audits/{audit_id}/export/markdown").read().decode()
    assert "# Second Opinion" in md
    print("Exported Markdown length:", len(md))

    print("\n--- 8. Testing SQLite Persistence ---")
    audits_list = json.loads(urllib.request.urlopen("http://127.0.0.1:8000/api/audits").read().decode())
    match = next((a for a in audits_list if a["id"] == audit_id), None)
    assert match is not None, "Audit not persisted in SQLite database"
    print("Persisted audit found in SQLite ledger:", match)

    print("\n==========================================")
    print("ALL 8 END-TO-END PIPELINE CHECKS PASSED!")
    print("==========================================")

if __name__ == "__main__":
    test_full_pipeline()
