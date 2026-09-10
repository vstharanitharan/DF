import markdown2
import subprocess
import os
import pymupdf

def main():
    md_file = os.path.join("docs", "one-page-summary.md")
    html_file = os.path.join("docs", "one-page-summary.html")
    pdf_file = os.path.join("docs", "one-page-summary.pdf")

    with open(md_file, "r", encoding="utf-8") as f:
        md_text = f.read()

    # Clean LaTeX notation into standard publication Unicode typography for PDF
    md_text = md_text.replace("$O(N^2)$", "<i>O</i>(<i>N</i>²)")
    md_text = md_text.replace("$$h_k = \\text{Core}(h_{k-1}, x) \\quad \\text{for } k \\in [1, K]$$", "<b><i>h<sub>k</sub></i> = Core(<i>h</i><sub><i>k</i>-1</sub>, <i>x</i>)</b> &nbsp;for <i>k</i> ∈ [1, <i>K</i>]")
    md_text = md_text.replace("($h \\in \\mathbb{R}^{C \\times H \\times W}$)", "(<i>h</i> ∈ ℝ<sup><i>C</i> × <i>H</i> × <i>W</i></sup>)")
    md_text = md_text.replace("($\\mathbb{R}^{48 \\times 15 \\times 15}$)", "(ℝ<sup>48 × 15 × 15</sup>)")
    md_text = md_text.replace("15 \\times 15", "15 × 15")
    md_text = md_text.replace("$15 \\times 15$", "15 × 15")
    md_text = md_text.replace("$K=1 \\to 10$", "<i>K</i> = 1 → 10")
    md_text = md_text.replace("$K=10 \\to 20$", "<i>K</i> = 10 → 20")
    md_text = md_text.replace("$K \\ge 11$", "<i>K</i> ≥ 11")
    md_text = md_text.replace("$K=1$", "<i>K</i> = 1")
    md_text = md_text.replace("$K=5$", "<i>K</i> = 5")
    md_text = md_text.replace("$K=10$", "<i>K</i> = 10")
    md_text = md_text.replace("$K=20$", "<i>K</i> = 20")
    md_text = md_text.replace("$K=4$", "<i>K</i> = 4")
    md_text = md_text.replace("$K=16–20$", "<i>K</i> = 16–20")
    md_text = md_text.replace("$K=16-20$", "<i>K</i> = 16–20")
    md_text = md_text.replace("$K \\sim \\text{Uniform}(1, 15)$", "<i>K</i> ~ Uniform(1, 15)")
    md_text = md_text.replace("$K$", "<i>K</i>")
    md_text = md_text.replace("$k$", "<i>k</i>")
    md_text = md_text.replace("$L$", "<i>L</i>")
    md_text = md_text.replace("$N$", "<i>N</i>")
    md_text = md_text.replace("+$7.0\\%$", "+7.0%")
    md_text = md_text.replace("$O(1)$", "<i>O</i>(1)")
    import re
    md_text = re.sub(r'\$([^\$]+)\$', r'\1', md_text)
    md_text = md_text.replace("\\times", "×")
    md_text = md_text.replace("\\to", "→")
    md_text = md_text.replace("\\ge", "≥")
    md_text = md_text.replace("\\%", "%")

    html_body = markdown2.markdown(md_text, extras=["tables", "fenced-code-blocks", "cuddled-lists"])

    styled_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Inference-Time Scaling in Latent Space - Summary</title>
<style>
  @page {{
    size: letter;
    margin: 0.3in;
  }}
  body {{
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-size: 7.2pt;
    line-height: 1.2;
    column-count: 2;
    column-gap: 15px;
    color: #111827;
    margin: 0;
    padding: 0;
  }}
  h1 {{
    font-size: 13pt;
    margin: 0 0 3px 0;
    color: #0f172a;
    font-weight: 700;
  }}
  h3 {{
    font-size: 9.5pt;
    margin: 6px 0 2px 0;
    color: #1e293b;
    border-bottom: 1px solid #cbd5e1;
    padding-bottom: 1px;
    font-weight: 600;
  }}
  p {{
    margin: 0 0 4px 0;
  }}
  blockquote {{
    margin: 3px 0;
    padding: 3px 8px;
    background: #f8fafc;
    border-left: 3px solid #3b82f6;
    font-style: italic;
  }}
  table {{
    width: 100%;
    border-collapse: collapse;
    margin: 4px 0;
    font-size: 8pt;
  }}
  th, td {{
    border: 1px solid #cbd5e1;
    padding: 2px 5px;
    text-align: left;
  }}
  th {{
    background: #f1f5f9;
    font-weight: 600;
  }}
  ul, ol {{
    margin: 0 0 4px 0;
    padding-left: 16px;
  }}
  li {{
    margin-bottom: 1px;
  }}
  hr {{
    border: none;
    border-top: 1px solid #e2e8f0;
    margin: 4px 0;
  }}
  code {{
    font-family: monospace;
    font-size: 8pt;
    background: #f1f5f9;
    padding: 1px 2px;
  }}
</style>
</head>
<body>
{html_body}
</body>
</html>"""

    with open(html_file, "w", encoding="utf-8") as f:
        f.write(styled_html)

    edge_path = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
    abs_html = os.path.abspath(html_file)
    abs_pdf = os.path.abspath(pdf_file)

    cmd = [
        edge_path,
        "--headless",
        "--disable-gpu",
        f"--print-to-pdf={abs_pdf}",
        "--no-pdf-header-footer",
        abs_html
    ]
    subprocess.run(cmd, check=True)

    if os.path.exists(pdf_file):
        doc = pymupdf.open(pdf_file)
        print(f"SUCCESS: Generated {pdf_file} with {len(doc)} page(s). File size: {os.path.getsize(pdf_file)} bytes.")
    else:
        print("ERROR: PDF was not generated.")

if __name__ == "__main__":
    main()
