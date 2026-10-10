import unittest
import os
import zipfile
import xml.etree.ElementTree as ET
import tempfile
from backend.document_processor import process_file, extract_pptx_slides


class TestPPTXExtraction(unittest.TestCase):
    """
    Tests for PowerPoint (.pptx) file extraction, slide chunking, and error handling.
    """

    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()

    def tearDown(self):
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def _create_sample_pptx(self, slides_text):
        """Creates a minimal valid PPTX zip file with given slide text contents."""
        import xml.sax.saxutils as saxutils
        file_path = os.path.join(self.temp_dir, "test_presentation.pptx")
        
        with zipfile.ZipFile(file_path, "w", zipfile.ZIP_DEFLATED) as z:
            # Minimal PowerPoint Presentation structure
            for i, text in enumerate(slides_text, 1):
                escaped_text = saxutils.escape(text)
                slide_xml = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
    <p:cSld>
        <p:spTree>
            <p:sp>
                <p:txBody>
                    <a:p>
                        <a:r>
                            <a:t>{escaped_text}</a:t>
                        </a:r>
                    </a:p>
                </p:txBody>
            </p:sp>
        </p:spTree>
    </p:cSld>
</p:sld>"""
                z.writestr(f"ppt/slides/slide{i}.xml", slide_xml)

        return file_path

    def test_extract_valid_pptx(self):
        """Test extraction of slides, passages, and page numbers from PPTX."""
        slide_1 = "Slide 1: Third quarter net revenue reached $162 million."
        slide_2 = "Slide 2: Operating margin contracted to 26.2% due to clinical R&D."
        
        pptx_path = self._create_sample_pptx([slide_1, slide_2])
        doc = process_file(pptx_path, "test_presentation.pptx")

        self.assertEqual(doc.filename, "test_presentation.pptx")
        self.assertEqual(doc.page_count, 2)
        self.assertGreaterEqual(doc.passage_count, 2)
        self.assertIn("162 million", doc.extracted_text)
        self.assertIn("26.2%", doc.extracted_text)
        
        # Check that page_number is mapped correctly to slide number
        self.assertEqual(doc.passages[0].page_number, 1)
        self.assertEqual(doc.passages[1].page_number, 2)

    def test_corrupted_pptx_error_handling(self):
        """Test that invalid/corrupted PPTX files raise clear, structured exceptions."""
        corrupted_path = os.path.join(self.temp_dir, "corrupted.pptx")
        with open(corrupted_path, "wb") as f:
            f.write(b"NOT A REAL PPTX ZIP FILE CONTENT")

        with self.assertRaises(RuntimeError) as ctx:
            process_file(corrupted_path, "corrupted.pptx")
        self.assertIn("Failed to extract PowerPoint (.pptx)", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
