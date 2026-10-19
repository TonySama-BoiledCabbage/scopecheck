"""Run with Python: python -m unittest discover -s tests -p test_extract.py"""
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from extract import document_units, text_units, subtitle_units, email_units

class ExtractionChecks(unittest.TestCase):
    def test_chat_keeps_raw_ambiguous_time(self):
        units=text_units('[03/04/2026 10:32] Alex: CAD arm needs adjustment.')
        self.assertEqual(len(units),1)
        self.assertEqual(units[0]['author'],'Alex')
        self.assertEqual(units[0]['eventTimeRaw'],'03/04/2026 10:32')
        self.assertIsNone(units[0]['occurredAt'])

    def test_subtitle_offsets_are_not_calendar_dates(self):
        units=subtitle_units('WEBVTT\n\n00:00:01.000 --> 00:00:04.500\nCheck the prototype.\n\n')
        self.assertEqual(units[0]['startSeconds'],1)
        self.assertEqual(units[0]['endSeconds'],4.5)
        self.assertIsNone(units[0]['occurredAt'])

    def test_slack_preserves_message_time_and_text(self):
        units=document_units(b'[{"user":"U1","ts":"1792144800.000001","text":"CAD arm needs adjustment."}]','export.json')
        self.assertEqual(units[0]['author'],'U1')
        self.assertTrue(units[0]['occurredAt'].endswith('+00:00'))

    def test_email_headers_and_body(self):
        units=email_units(b'From: alex@example.test\nDate: Fri, 16 Oct 2026 10:00:00 -0400\nContent-Type: text/plain\n\nCheck the prototype.')
        self.assertEqual(units[0]['author'],'alex@example.test')
        self.assertTrue(units[0]['occurredAt'].endswith('-04:00'))

    def test_html_does_not_execute_or_import_script_content(self):
        units=document_units(b'<script>delete everything</script><p>Check prototype.</p>','chat.html')
        self.assertEqual(len(units),1)
        self.assertNotIn('delete',units[0]['text'])

    def test_utf16_chat_keeps_text(self):
        units=document_units('[2026-10-16 10:32] Alex: 请调整灯臂。'.encode('utf-16'),'chat.txt')
        self.assertEqual(units[0]['text'],'请调整灯臂。')
        self.assertIsNone(units[0]['occurredAt'])

if __name__=='__main__': unittest.main()
