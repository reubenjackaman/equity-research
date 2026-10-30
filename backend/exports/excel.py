"""
Excel exports, built with openpyxl.

Statements are exported in millions (per-share figures as-is), one sheet per statement.
Calculated rows (EBITDA, total debt, FCF) are written as real Excel formulas that point
at the cells they're built from, so you can audit them in Excel.
"""

from io import BytesIO

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

from finance.statements import STATEMENTS

SHEET_NAMES = {"income": "Income Statement", "balance": "Balance Sheet", "cashflow": "Cash Flow"}

# Formulas for the calculated rows, written in terms of other row keys.
# COUNT() ignores "N/A" text, so a missing input gives "N/A" instead of silently using 0.
CALC_FORMULAS = {
    "ebitda": '=IF(COUNT({operating_income},{dna})<2,"N/A",{operating_income}+{dna})',
    "total_debt": '=IF(COUNT({short_term_debt},{long_term_debt})=0,"N/A",SUM({short_term_debt},{long_term_debt}))',
    "fcf": '=IF(COUNT({cfo},{capex})<2,"N/A",{cfo}+{capex})',
}

HEADER_FILL = PatternFill("solid", fgColor="1E293B")
HEADER_FONT = Font(bold=True, color="FFFFFF")
MILLIONS = '#,##0;(#,##0);"–"'
PER_SHARE = '0.00;(0.00);"–"'


def _scale(value, fmt):
    if value is None:
        return "N/A"
    return value if fmt == "perShare" else value / 1e6


def statements_workbook(data: dict) -> bytes:
    wb = Workbook()
    wb.remove(wb.active)
    n_cols = len(data["columns"])

    # First pass: work out which sheet/row every line item lands on, so formulas can
    # reference rows on other sheets (EBITDA uses D&A from the cash flow sheet).
    location = {}
    for name in STATEMENTS:
        for i, row in enumerate(data["statements"][name]):
            location[row["key"]] = (SHEET_NAMES[name], i + 4)

    for name in STATEMENTS:
        ws = wb.create_sheet(SHEET_NAMES[name])
        ws["A1"] = f"{data['symbol']} · {SHEET_NAMES[name]} ({data['period']})"
        ws["A1"].font = Font(bold=True, size=13)
        ws["A2"] = f"{data['currency']} millions, except per-share data · Source: {data['source']}"
        ws["A2"].font = Font(italic=True, color="64748B")

        ws.cell(row=3, column=1, value="Line item")
        for j, col in enumerate(data["columns"]):
            ws.cell(row=3, column=j + 2, value=col["label"])
        for c in range(1, n_cols + 2):
            cell = ws.cell(row=3, column=c)
            cell.fill, cell.font = HEADER_FILL, HEADER_FONT
            cell.alignment = Alignment(horizontal="left" if c == 1 else "right")

        for i, row in enumerate(data["statements"][name]):
            r = i + 4
            label = ws.cell(row=r, column=1, value=("    " if row["indent"] else "") + row["label"])
            label.font = Font(bold=row["bold"])
            for j in range(n_cols):
                col_letter = get_column_letter(j + 2)
                cell = ws.cell(row=r, column=j + 2)
                formula = CALC_FORMULAS.get(row["key"])
                if formula:
                    refs = {}
                    for key in ("operating_income", "dna", "short_term_debt", "long_term_debt", "cfo", "capex"):
                        sheet, ref_row = location[key]
                        prefix = "" if sheet == SHEET_NAMES[name] else f"'{sheet}'!"
                        refs[key] = f"{prefix}{col_letter}{ref_row}"
                    cell.value = formula.format(**refs)
                else:
                    cell.value = _scale(row["values"][j], row["format"])
                cell.number_format = PER_SHARE if row["format"] == "perShare" else MILLIONS
                cell.font = Font(bold=row["bold"])
                cell.alignment = Alignment(horizontal="right")

        ws.column_dimensions["A"].width = 36
        for j in range(n_cols):
            ws.column_dimensions[get_column_letter(j + 2)].width = 13
        ws.freeze_panes = "B4"

    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()
