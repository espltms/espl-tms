import os
from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle, KeepTogether, PageBreak
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parents[1]
OUT_ROOT = ROOT / "coal-rcr-workflow-guide.pdf"
OUT_PUBLIC = ROOT / "frontend" / "public" / "coal-rcr-workflow-guide.pdf"

PAGE_WIDTH, PAGE_HEIGHT = letter

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        
        # Bottom Footer (drawn on all pages)
        self.drawString(54, 30, "Coal RCR Transportation System — Complete Workflow Guide")
        self.drawRightString(PAGE_WIDTH - 54, 30, f"Page {self._pageNumber} of {page_count}")
        
        # Header (drawn on Page 2 and later)
        if self._pageNumber > 1:
            self.drawString(54, PAGE_HEIGHT - 30, "Coal RCR Transportation Workflow Guide")
            self.setStrokeColor(colors.HexColor("#E2E8F0"))
            self.setLineWidth(0.5)
            self.line(54, PAGE_HEIGHT - 35, PAGE_WIDTH - 54, PAGE_HEIGHT - 35)
            
        self.restoreState()

def build_pdf(filename):
    doc = SimpleDocTemplate(
        str(filename),
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54,
    )
    
    styles = getSampleStyleSheet()
    
    # Custom premium styles
    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Title"],
        fontName="Helvetica-Bold",
        fontSize=20,
        leading=24,
        textColor=colors.HexColor("#0B2545"),
        spaceAfter=4,
        alignment=0,
    )
    
    subtitle_style = ParagraphStyle(
        "DocSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9.5,
        leading=14,
        textColor=colors.HexColor("#64748B"),
        spaceAfter=15,
    )
    
    h1_style = ParagraphStyle(
        "H1Custom",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=16,
        textColor=colors.HexColor("#0B2545"),
        spaceBefore=12,
        spaceAfter=6,
        keepWithNext=True,
    )
    
    h2_style = ParagraphStyle(
        "H2Custom",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=9.5,
        leading=13,
        textColor=colors.HexColor("#134074"),
        spaceBefore=8,
        spaceAfter=4,
        keepWithNext=True,
    )

    body_style = ParagraphStyle(
        "BodyCustom",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor("#334155"),
        spaceAfter=6,
    )

    bullet_style = ParagraphStyle(
        "BulletCustom",
        parent=body_style,
        leftIndent=15,
        firstLineIndent=-10,
        spaceAfter=3,
    )
    
    table_header = ParagraphStyle(
        "TableHeader",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7.5,
        leading=10,
        textColor=colors.HexColor("#0F172A"),
    )
    
    table_cell = ParagraphStyle(
        "TableCell",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor("#334155"),
    )

    table_cell_bold = ParagraphStyle("TableCellBold", parent=table_cell, fontName="Helvetica-Bold")
    
    story = []
    
    # Document Title and Banner
    story.append(Paragraph("Coal RCR Transportation System", title_style))
    story.append(Paragraph("Complete Operations, Verification, and Financial Settlement Workflow", subtitle_style))
    
    # Divider line
    divider = Table([[""]], colWidths=[PAGE_WIDTH - 108], rowHeights=[2])
    divider.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#0B2545")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(divider)
    story.append(Spacer(1, 10))
    
    # Introduction callout
    intro_data = [[
        Paragraph("<b>Executive Summary:</b> This guide details the complete audit trail from DO Issuance through RR Dispatch, Receipt, Quality Verification, GRN Generation, Deduction/Penalty Computation, Invoice Validation, and DO Closure. It ensures all tonnage movements and financial transactions are fully traceable and audited.", body_style)
    ]]
    intro_table = Table(intro_data, colWidths=[PAGE_WIDTH - 108])
    intro_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
        ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#E2E8F0")),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(intro_table)
    story.append(Spacer(1, 12))
    
    # Step-by-Step Flow
    steps = [
        {
            "num": 1,
            "title": "DO Creation",
            "desc": "When a coal Delivery Order (DO) is received from the coal company, the user registers a DO entry. This becomes the primary master record, and all subsequent records are linked to it.",
            "data": ["DO Number", "PO Number", "Siding Name", "Mine Name", "Coal Company Name", "DO Quantity", "Coal Grade", "Issue Date & Validity Period"],
            "why": "This acts as the main tracking ID. Every associated RR receipt, quality testing result, penalty deduction, and invoice is connected to this DO No. for end-to-end traceability.",
            "example_title": "Example Linkage Mapping:",
            "example_headers": ["Primary Tracking DO No."],
            "example_rows": [["1250000958"]]
        },
        {
            "num": 2,
            "title": "RR (Railway Receipt) Tracking",
            "desc": "One master DO generates multiple Railway Receipts (RRs) as individual wagon shipments. The system tracks the quantity dispatched, pending shipments, and completed RRs.",
            "data": ["RR Number", "RR Date & Wagon Details", "Loading Date", "Dispatch Date", "RR Quantity"],
            "why": "Enables real-time tracking of lifted allocations against total DO limits. The system automatically computes operations metrics:\n• Lifted Qty = Sum of RR Qty\n• Balance Qty = DO Qty - Lifted Qty",
            "example_title": "Example Multiple RRs (DO Qty = 12,000 MT):",
            "example_headers": ["RR Number", "RR Qty (MT)"],
            "example_rows": [["RR001", "4,000 MT"], ["RR002", "4,000 MT"], ["RR003", "4,000 MT"]]
        },
        {
            "num": 3,
            "title": "Siding-wise Tracking",
            "desc": "A company may manage operations across multiple siding hubs. Every logged RR is assigned to a specific siding to keep track of loading and unloading performance.",
            "data": ["Siding Name (e.g. HKG, DOS, XYZ)", "Assigned RR Number", "Receipt Status"],
            "why": "Provides management with consolidated operational reports grouped by siding, enabling monitoring of receipt velocities and volume distribution.",
            "example_title": "Example Siding Metrics:",
            "example_headers": ["Siding Name", "Total Quantity Received (MT)"],
            "example_rows": [["HKG", "40,000 MT"], ["DOS", "35,000 MT"]]
        },
        {
            "num": 4,
            "title": "Receipt Tracking",
            "desc": "When the coal rake reaches the destination siding, receipt parameters are logged to compare the weight dispatched at the mine vs the actual weight received.",
            "data": ["Receipt Date", "RR Number Reference", "Actual Unloaded/Received Quantity"],
            "why": "Allows identification and tracking of transit weight shortages to determine shortage liabilities.",
            "example_title": "Example Shortage Audit:",
            "example_headers": ["RR Reference", "Dispatched Qty (MT)", "Received Qty (MT)", "Transit Shortage (MT)"],
            "example_rows": [["RR001", "4,000.00 MT", "3,950.00 MT", "50.00 MT"]]
        },
        {
            "num": 5,
            "title": "Quality Tracking",
            "desc": "For every incoming RR shipment, lab results are captured to track proximate parameters against contracted specifications.",
            "data": ["TM (Total Moisture)", "IM (Inherent Moisture)", "Ash & Volatile Matter (VM) %", "Fixed Carbon (FC) %", "GCV ADB (Air Dried Basis)", "GCV ARB (As Received Basis)"],
            "why": "Maintains complete quality reports. Management can check GCV slippages and quality trends across different mines and suppliers.",
            "example_title": "Example Quality Log:",
            "example_headers": ["RR No", "TM (%)", "Ash (%)", "GCV ADB (kcal/kg)", "GCV ARB (kcal/kg)"],
            "example_rows": [["RR001", "12.5%", "24.2%", "5,200", "4,800"]]
        },
        {
            "num": 6,
            "title": "GRN (Goods Receipt Note)",
            "desc": "Upon quality verification, a Goods Receipt Note (GRN) is generated to verify and approve the accepted weight for inventory valuation.",
            "data": ["RR Number Reference", "Accepted Quantity", "GRN Date"],
            "why": "Directly updates the inventory logs with clean, verified raw material weight.",
            "example_title": "Example Inventory Receipt:",
            "example_headers": ["Received (MT)", "Accepted GRN (MT)", "Rejected Tonnage (MT)"],
            "example_rows": [["3,950 MT", "3,920 MT", "30 MT"]]
        },
        {
            "num": 7,
            "title": "Normalized Quantity Calculation",
            "desc": "Coal companies bill on a quality-normalized weight. The system adjusts the GRN weight based on GCV slippage factors.",
            "data": ["Quality Adjustment Factor", "Base contracted GCV", "Actual received GCV"],
            "why": "Computes the exact billing weight: \nNormalized Qty = Received Qty x Quality Adjustment Factor.",
            "example_title": "Example Adjustment:",
            "example_headers": ["GRN Accepted Qty (MT)", "GCV Factor", "Normalized Billing Qty (MT)"],
            "example_rows": [["3,920.00 MT", "0.9847", "3,860.00 MT"]]
        },
        {
            "num": 8,
            "title": "Deduction Management",
            "desc": "Tracks and consolidates all transit, quality, and administrative deductions applied to each shipment.",
            "data": ["Dead Freight Charges", "Punitive Charges", "Demurrage Charges (DC)", "Quality Slippage Penalty", "Shortage Penalty", "Railway Leakage Deduction"],
            "why": "Maintains a detailed ledger of financial losses and recoveries against each DO and RR.",
            "example_title": "Example Deductions Table:",
            "example_headers": ["RR Number", "Dead Freight (₹)", "Quality Penalty (₹)", "Final Deduction (₹)"],
            "example_rows": [["RR001", "₹15,000", "₹10,000", "₹25,000"], ["RR002", "₹8,000", "₹7,000", "₹15,000"]]
        },
        {
            "num": 9,
            "title": "Invoice Validation",
            "desc": "When transporters submit bills, the system automatically cross-checks transporter claims against verified system receipts, shortages, and deductions.",
            "data": ["Claimed Invoice Amount", "System Eligible Amount", "Discrepancy Details"],
            "why": "Prevents overbilling, highlights invoice discrepancies, and ensures transparency.",
            "example_title": "Example Discrepancy Flag:",
            "example_headers": ["Transporter Claim", "System Calculated", "Variance / Discrepancy"],
            "example_rows": [["₹1,50,000", "₹1,42,000", "₹8,000 (Discrepancy Flagged)"]]
        },
        {
            "num": 10,
            "title": "Payment Tracking",
            "desc": "Logs payment disbursements, TDS deductions, and outstanding payable balances.",
            "data": ["Invoice Number", "Invoice Amount", "Paid Amount & Date", "Pending Amount", "Payment Status"],
            "why": "Enables auditing of unpaid balances, paid invoices, and transporter balances.",
            "example_title": "Example Payment Status:",
            "example_headers": ["Bill Number", "Billed Amount", "Paid Amount", "Pending Balance", "Status"],
            "example_rows": [["BILL-4019", "₹1,42,000", "₹1,00,000", "₹42,000", "Partially Paid"]]
        },
        {
            "num": 11,
            "title": "DO Closure",
            "desc": "Concludes the DO lifecycle. The system automatically marks a DO closed when allocations are fully met or the validity expires.",
            "data": ["Closing Date", "Accumulated Lifted Weight", "Closing Reason"],
            "why": "Prevents duplicate dispatches against lapsed contracts and marks the final lifecycle status.",
            "example_title": "Lifecycle Status Options:",
            "example_headers": ["Status Option", "Condition"],
            "example_rows": [["Active", "Within validity, allocation remaining"], ["Completed", "Lifted quantity matches DO quantity"], ["Expired", "Validity end date reached with balance remaining"]]
        }
    ]

    for step in steps:
        step_elements = []
        
        # Step Header
        step_elements.append(Paragraph(f"Step {step['num']}: {step['title']}", h1_style))
        
        # Description
        step_elements.append(Paragraph(step["desc"], body_style))
        
        # Data Captured
        step_elements.append(Paragraph("Data Captured:", h2_style))
        for item in step["data"]:
            step_elements.append(Paragraph(f"• {item}", bullet_style))
        
        # Why it is important
        step_elements.append(Paragraph("Why It Is Important / Purpose:", h2_style))
        for line in step["why"].split('\n'):
            step_elements.append(Paragraph(line, body_style))
        
        # Example Table
        if step.get("example_headers"):
            step_elements.append(Paragraph(step.get("example_title", "Example:"), h2_style))
            
            # Format table data
            t_data = [[Paragraph(h, table_header) for h in step["example_headers"]]]
            for row in step["example_rows"]:
                t_data.append([Paragraph(cell, table_cell) for cell in row])
            
            # Column widths
            available_width = PAGE_WIDTH - 108
            num_cols = len(step["example_headers"])
            col_widths = [available_width / num_cols] * num_cols
            
            table = Table(t_data, colWidths=col_widths)
            table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F1F5F9")),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
            ]))
            step_elements.append(table)
            
        step_elements.append(Spacer(1, 8))
        
        # Keep each step block together so it doesn't break awkwardly across pages
        story.append(KeepTogether(step_elements))
        story.append(Spacer(1, 10))

    # Page Break for Track Records Section
    story.append(PageBreak())
    
    # Track Records Section
    story.append(Paragraph("Track Records & History Logs Available", title_style))
    story.append(Paragraph("The system maintains multiple historical dimensions to ensure complete traceability:", subtitle_style))
    story.append(Spacer(1, 10))
    
    records = [
        {
            "title": "DO-wise History",
            "desc": "Search by DO Number to view complete DO parameters, associated dispatches, quality proximate metrics, accepted GRNs, accumulated dead freight deductions, and commercial payment status."
        },
        {
            "title": "Siding-wise History",
            "desc": "Search by Siding name (e.g. HKG) to audit total DO allocations handled, aggregate lifted weight, lapsed quantities, and total penalty slip records."
        },
        {
            "title": "RR-wise History",
            "desc": "Search by specific Railway Receipt (RR) to track mine dispatch weights, actual unloaded weights, lab analysis reports, transit shortages, and generated GRNs."
        },
        {
            "title": "Vendor / Transporter History",
            "desc": "Evaluate transporter efficiency and vendor accountability by tracking trips handled, billing invoices, payment statuses, and historical performance logs."
        }
    ]

    for rec in records:
        rec_elements = []
        rec_elements.append(Paragraph(rec["title"], h1_style))
        rec_elements.append(Paragraph(rec["desc"], body_style))
        rec_elements.append(Spacer(1, 6))
        story.append(KeepTogether(rec_elements))

    # Build the document
    doc.build(story, canvasmaker=NumberedCanvas)

if __name__ == "__main__":
    print("Building PDF in project root...")
    build_pdf(OUT_ROOT)
    print("Building PDF in frontend public folder...")
    build_pdf(OUT_PUBLIC)
    print("Done!")
