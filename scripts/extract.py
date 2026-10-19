"""Local, read-only media extraction. stdout is one JSON result; no source code is executed."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / ".parser"))
sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

import json
import re
import io
import zipfile
from datetime import datetime, timezone
from email import policy
from email.parser import BytesParser
from email.utils import parsedate_to_datetime
from html.parser import HTMLParser


class PlainHTML(HTMLParser):
    def __init__(self):
        super().__init__(); self.parts = []; self.hidden = 0
    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"): self.hidden += 1
        if tag in ("p", "div", "br", "li"): self.parts.append("\n")
    def handle_endtag(self, tag):
        if tag in ("script", "style"): self.hidden = max(0, self.hidden - 1)
    def handle_data(self, data):
        if not self.hidden: self.parts.append(data)


def unit(text, locator, **extra):
    return dict(text=text.strip()[:10000], locator=locator, page=None, bounds=None,
                startSeconds=None, endSeconds=None, eventTimeRaw=None, occurredAt=None, author=None, **extra)


def make_unit(text, locator, **extra):
    result = unit(text, locator)
    result.update(extra)
    return result


def text_units(text, prefix="文字"):
    result = []; raw_time = None; author = None
    for n, line in enumerate(text.splitlines()):
        line = line.strip()
        if not line: continue
        if re.fullmatch(r"[\d\s:/年月日星期一二三四五六天周昨天今天上午下午.-]+", line):
            raw_time = line; continue
        match = re.match(r"^(?:\[([^\]]+)\]|(\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4}[^-]{0,20})\s+-)\s*([^:：]{1,60})[:：]\s*(.+)$", line)
        if match:
            raw_time = match.group(1) or match.group(2); author = match.group(3); line = match.group(4)
        for part in re.split(r"(?<=[。！？!?])\s*|\s*[•●]\s*", line):
            if part.strip(): result.append(make_unit(part, f"{prefix} · 第 {n+1} 行", eventTimeRaw=raw_time, author=author))
    return result


def subtitle_units(text):
    result = []
    stamp = r"(?:(\d{2}):)?(\d{2}):(\d{2})[.,](\d{3})"
    pattern = re.compile(stamp + r"\s*-->\s*" + stamp + r"[^\n]*\n(.*?)(?=\n\s*\n|\Z)", re.S)
    for match in pattern.finditer(text):
        def seconds(offset):
            h, m, s, ms = match.groups()[offset:offset+4]
            return int(h or 0)*3600+int(m)*60+int(s)+int(ms)/1000
        start, end = seconds(0), seconds(4)
        content = re.sub(r"<[^>]*>", "", match.group(9)).strip()
        if content and end >= start:
            result.append(make_unit(content, f"字幕 {start:.1f}–{end:.1f} 秒", startSeconds=start, endSeconds=end))
    return result


def email_units(raw, prefix="邮件"):
    message = BytesParser(policy=policy.default).parsebytes(raw)
    body = message.get_body(preferencelist=("plain", "html"))
    if body is None: return []
    content = body.get_content()
    if body.get_content_type() == "text/html":
        parser = PlainHTML(); parser.feed(content); content = "".join(parser.parts)
    raw_time = str(message.get("Date", "")) or None
    occurred = None
    try:
        d = parsedate_to_datetime(raw_time)
        if d.tzinfo: occurred = d.isoformat()
    except (ValueError, TypeError): pass
    result = text_units(content, f"{prefix} {message.get('Subject', '')}")
    for item in result:
        item.update(author=str(message.get("From", "")) or None, eventTimeRaw=raw_time, occurredAt=occurred)
    return result


def document_units(raw, name):
    suffix = Path(name).suffix.lower()
    text = raw.decode("utf-16" if raw.startswith((b"\xff\xfe",b"\xfe\xff")) else "utf-8-sig", errors="replace")
    if suffix in (".vtt", ".srt"): return subtitle_units(text)
    if suffix == ".eml": return email_units(raw)
    if suffix == ".json":
        data = json.loads(text)
        messages = data if isinstance(data, list) else data.get("messages", []) if isinstance(data, dict) else []
        result = []
        for n, message in enumerate(messages):
            if not isinstance(message, dict) or not isinstance(message.get("text"), str): continue
            raw_time = str(message.get("ts", "")) or None; occurred = None
            try: occurred = datetime.fromtimestamp(float(raw_time), timezone.utc).isoformat()
            except (ValueError, TypeError, OverflowError, OSError): pass
            for part in text_units(message["text"], f"JSON 消息 {n+1}"):
                part.update(author=message.get("user"), eventTimeRaw=raw_time, occurredAt=occurred)
                result.append(part)
        return result
    if suffix in (".html", ".htm"):
        parser = PlainHTML(); parser.feed(text); text = "".join(parser.parts)
    return text_units(text)


def ocr_image(raw, page=None):
    import numpy as np
    from PIL import Image, ImageOps
    from rapidocr_onnxruntime import RapidOCR
    image = ImageOps.exif_transpose(Image.open(io.BytesIO(raw))).convert("RGB")
    if image.width * image.height > 30_000_000: raise ValueError("图片超过 3000 万像素，请缩小后重试。")
    # ponytail: one bounded extraction process; use a persistent worker if repeated model loading becomes costly.
    engine = RapidOCR(intra_op_num_threads=2, inter_op_num_threads=2)
    entries, _ = engine(np.asarray(image))
    result = []; raw_time = None; author = None
    for n, (box, text, score) in enumerate(entries or []):
        if not text.strip(): continue
        xs = [p[0] for p in box]; ys = [p[1] for p in box]
        bounds = [min(xs)/image.width, min(ys)/image.height, (max(xs)-min(xs))/image.width, (max(ys)-min(ys))/image.height]
        pieces = text_units(text, f"{'PDF OCR' if page else '截图 OCR'} · 区域 {n+1}")
        if not pieces and re.fullmatch(r"[\d\s:/年月日星期一二三四五六天周昨天今天上午下午.-]+",text.strip()): raw_time=text.strip()
        for piece in pieces:
            raw_time=piece['eventTimeRaw'] or raw_time; author=piece['author'] or author
            piece.update(bounds=bounds, page=page, eventTimeRaw=raw_time, author=author)
        result.extend(pieces)
    return result


def extract(path, name, mime):
    raw = path.read_bytes(); suffix = Path(name).suffix.lower(); warnings = []
    if mime.startswith("image/") or suffix in (".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tif", ".tiff"):
        result = ocr_image(raw); parser = "RapidOCR · 中文/英文"
        warnings.append("OCR 可能误识别术语；截图中缺失的日期、时区和人物身份保持未知。")
    elif suffix == ".pdf" or mime == "application/pdf":
        import pymupdf
        with pymupdf.open(path) as document:
            if document.needs_pass: raise ValueError("PDF 已加密，请提供可读取副本。")
            if document.page_count > 100: raise ValueError("单次最多解析 100 页 PDF，请拆分文件。")
            result = []
            for n, page in enumerate(document):
                entries = page.get_text("blocks")
                if not any(str(b[4]).strip() for b in entries):
                    result.extend(ocr_image(page.get_pixmap(matrix=pymupdf.Matrix(1.5,1.5)).tobytes("png"), n+1))
                else:
                    for box in entries:
                        if box[6] != 0: continue
                        for part in text_units(box[4], f"PDF 第 {n+1} 页"):
                            part.update(page=n+1,bounds=[box[0]/page.rect.width,box[1]/page.rect.height,(box[2]-box[0])/page.rect.width,(box[3]-box[1])/page.rect.height])
                            result.append(part)
        parser = "PyMuPDF / RapidOCR"
    elif mime.startswith(("audio/", "video/")) or suffix in (".wav", ".mp3", ".m4a", ".ogg", ".flac", ".aac", ".webm", ".mp4", ".mov"):
        import av
        from faster_whisper import WhisperModel
        with av.open(str(path)) as container:
            if container.duration and container.duration/av.time_base > 1800: raise ValueError("单次最多转写 30 分钟，请拆分录音。")
        model_path = ROOT / ".models" / "whisper-tiny"
        if not (model_path / "model.bin").exists(): raise ValueError("本地语音模型未安装，请先运行 npm run setup:parser。")
        model = WhisperModel(str(model_path), device="cpu", compute_type="int8", cpu_threads=4, local_files_only=True)
        segments, info = model.transcribe(str(path), beam_size=3, vad_filter=True)
        result = [make_unit(s.text, f"原音 {s.start:.1f}–{s.end:.1f} 秒", startSeconds=s.start, endSeconds=s.end) for s in segments if s.text.strip()]
        parser = "faster-whisper tiny · 本地 CPU"
        warnings.append("语音转写可能有误，请核对原音；未自动判断说话人或客户批准。视频仅转写音轨。")
    elif suffix == ".mbox":
        import mailbox
        result=[]
        with mailbox.mbox(str(path),create=False) as messages:
            for n, message in enumerate(messages):
                result.extend(email_units(message.as_bytes(),f"邮件 {n+1}"))
                if len(result)>1000: raise ValueError("邮件片段超过单次 1000 条限制，请分批导出。")
        parser="Python email / mailbox"
    elif suffix == ".zip":
        result=[]
        with zipfile.ZipFile(path) as archive:
            if len(archive.infolist())>300 or sum(x.file_size for x in archive.infolist())>100*1024*1024: raise ValueError("导出包超过 300 项或解压后 100 MB 限制。")
            for entry in archive.infolist():
                if ".." in Path(entry.filename).parts or entry.filename.startswith(("/", "\\")): raise ValueError("导出包包含不安全路径。")
                if Path(entry.filename).suffix.lower() in (".txt", ".json", ".vtt", ".srt", ".eml", ".html"):
                    for part in document_units(archive.read(entry),entry.filename):
                        part["locator"] = f"{entry.filename} · {part['locator']}"[:1000]; result.append(part)
        parser="导出包文字/消息解析"
        warnings.append("包内媒体保留在原始 ZIP 中；外部链接未自动下载，缺失附件不推断归属。")
    elif suffix in (".txt", ".md", ".json", ".vtt", ".srt", ".eml", ".html", ".htm"):
        result=document_units(raw,name); parser="结构化消息 / 原文分段"
        warnings.append("无时区或含糊日期保留原文；相对日期不自动换算。链接附件不会自动下载。")
    else: raise ValueError("原件已留存；该格式暂未提供内容解析。")
    if not result: raise ValueError("未检测到可用文字/语音；原件已留存，可重试或人工补充。")
    if len(result)>1000: raise ValueError("解析片段超过 1000 条，请拆分文件。")
    return dict(parser=parser, warnings=warnings, units=result)


if __name__ == "__main__":
    try:
        if sys.argv[1] == "--download-model":
            from huggingface_hub import snapshot_download
            snapshot_download("Systran/faster-whisper-tiny", local_dir=ROOT/".models"/"whisper-tiny", allow_patterns=["*.json", "*.bin", "*.txt"])
            print(json.dumps({"ready": True}))
        else:
            print(json.dumps(extract(Path(sys.argv[1]),sys.argv[2],sys.argv[3]),ensure_ascii=False))
    except Exception as error:
        print(json.dumps({"error":str(error)},ensure_ascii=False)); sys.exit(1)
