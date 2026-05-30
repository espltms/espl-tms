from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "espl-tms-login-credentials.pdf"
PASSWORD = "TMSAdminPassword2026!"

rows = [
    ["Super Admin", "superadmin@espl.com", PASSWORD, "Complete access to all regions and all modules."],
    ["Place-1 Admin", "place1.admin@espl.com", PASSWORD, "Region admin access for Place-1."],
    ["Place-2 Admin", "place2.admin@espl.com", PASSWORD, "Region admin access for Place-2."],
    ["Place-3 Admin", "place3.admin@espl.com", PASSWORD, "Region admin access for Place-3."],
    ["Place-4 Admin", "place4.admin@espl.com", PASSWORD, "Region admin access for Place-4."],
    ["Place-5 Admin", "place5.admin@espl.com", PASSWORD, "Region admin access for Place-5."],
    ["Vendor 1", "vendor1@espl.com", PASSWORD, "Vendor access: vehicle summary only for Vendor 1."],
    ["Vendor 2", "vendor2@espl.com", PASSWORD, "Vendor access: vehicle summary only for Vendor 2."],
    ["Vendor 3", "vendor3@espl.com", PASSWORD, "Vendor access: vehicle summary only for Vendor 3."],
]

styles = getSampleStyleSheet()
title = ParagraphStyle(
    "TitleCustom",
    parent=styles["Title"],
    fontName="Helvetica-Bold",
    fontSize=22,
    leading=26,
    textColor=colors.HexColor("#0B2545"),
    alignment=1,
    spaceAfter=6,
)
subtitle = ParagraphStyle(
    "SubtitleCustom",
    parent=styles["Normal"],
    fontName="Helvetica",
    fontSize=10,
    leading=13,
    textColor=colors.HexColor("#64748B"),
    alignment=1,
    spaceAfter=18,
)
note = ParagraphStyle(
    "NoteCustom",
    parent=styles["Normal"],
    fontName="Helvetica-Bold",
    fontSize=9,
    leading=12,
    textColor=colors.HexColor("#9A3412"),
    spaceAfter=12,
)
cell = ParagraphStyle(
    "Cell",
    parent=styles["Normal"],
    fontName="Helvetica",
    fontSize=8,
    leading=10,
    textColor=colors.HexColor("#1E293B"),
)
cell_bold = ParagraphStyle("CellBold", parent=cell, fontName="Helvetica-Bold")

doc = SimpleDocTemplate(
    str(OUT),
    pagesize=letter,
    leftMargin=0.55 * inch,
    rightMargin=0.55 * inch,
    topMargin=0.6 * inch,
    bottomMargin=0.6 * inch,
)

story = [
    Paragraph("ESPL TMS Login Credentials", title),
    Paragraph("New access roles: Super Admin, Place Admins, and Vendors", subtitle),
    Paragraph("Important: Self registration is disabled. Accounts must be created/managed by the Super Admin.", note),
]

table_data = [[
    Paragraph("Role / Account", cell_bold),
    Paragraph("Login Email", cell_bold),
    Paragraph("Password", cell_bold),
    Paragraph("Access", cell_bold),
]]

for role, email, password, access in rows:
    table_data.append([
        Paragraph(role, cell_bold),
        Paragraph(email, cell),
        Paragraph(password, cell),
        Paragraph(access, cell),
    ])

table = Table(table_data, colWidths=[1.35 * inch, 1.95 * inch, 1.65 * inch, 2.25 * inch], repeatRows=1)
table.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#E8F1FF")),
    ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#0F172A")),
    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#D9E2EC")),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("TOPPADDING", (0, 0), (-1, -1), 7),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ("LEFTPADDING", (0, 0), (-1, -1), 7),
    ("RIGHTPADDING", (0, 0), (-1, -1), 7),
    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
]))

story.append(table)
story.append(Spacer(1, 16))
story.append(Paragraph("Keep this document private. Do not share vendor/admin passwords publicly.", subtitle))

doc.build(story)
print(OUT)
