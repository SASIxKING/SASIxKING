package com.voltbill.pro.pdf

import android.content.Context
import android.content.Intent
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.graphics.pdf.PdfDocument
import androidx.core.content.FileProvider
import com.voltbill.pro.data.BusinessProfile
import com.voltbill.pro.data.Invoice
import com.voltbill.pro.data.InvoiceItem
import com.voltbill.pro.domain.amountInWords
import com.voltbill.pro.domain.fmtDate
import com.voltbill.pro.domain.inr
import java.io.File
import java.io.FileOutputStream

/**
 * Renders a GST tax invoice to A4 using the platform PdfDocument API.
 * No third-party PDF dependency is required.
 */
object InvoicePdf {

    private const val W = 595   // A4 @72dpi
    private const val H = 842
    private const val M = 32f   // margin

    private val ACCENT = Color.parseColor("#0F4C81")
    private val ACCENT_LT = Color.parseColor("#E8F0F8")
    private val INK = Color.parseColor("#1A1A1A")
    private val MUTED = Color.parseColor("#6B7280")
    private val LINE = Color.parseColor("#D5DBE3")

    private fun paint(size: Float, bold: Boolean = false, color: Int = INK, align: Paint.Align = Paint.Align.LEFT) =
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            textSize = size
            this.color = color
            textAlign = align
            typeface = Typeface.create(Typeface.SANS_SERIF, if (bold) Typeface.BOLD else Typeface.NORMAL)
        }

    fun generate(
        context: Context,
        invoice: Invoice,
        items: List<InvoiceItem>,
        biz: BusinessProfile
    ): File {
        val doc = PdfDocument()
        val page = doc.startPage(PdfDocument.PageInfo.Builder(W, H, 1).create())
        val c = page.canvas

        var y = drawHeader(c, biz, invoice)
        y = drawParties(c, invoice, biz, y)
        y = drawItems(c, items, invoice, y)
        y = drawTotals(c, invoice, items, y)
        drawFooter(c, biz, invoice, y)

        doc.finishPage(page)

        val dir = File(context.cacheDir, "invoices").apply { mkdirs() }
        val file = File(dir, "${invoice.invoiceNo.replace("/", "-")}.pdf")
        FileOutputStream(file).use { doc.writeTo(it) }
        doc.close()
        return file
    }

    private fun drawHeader(c: Canvas, biz: BusinessProfile, inv: Invoice): Float {
        // accent banner
        c.drawRect(0f, 0f, W.toFloat(), 96f, Paint().apply { color = ACCENT })

        c.drawText(biz.name, M, 38f, paint(19f, true, Color.WHITE))
        c.drawText(biz.tagline, M, 55f, paint(8.5f, false, Color.parseColor("#C7D9EC")))
        c.drawText(biz.address, M, 70f, paint(8f, false, Color.parseColor("#C7D9EC")))
        c.drawText(
            "Ph: ${biz.phone}   |   ${biz.email}   |   GSTIN: ${biz.gstin}",
            M, 84f, paint(8f, false, Color.parseColor("#C7D9EC"))
        )

        val right = W - M
        c.drawText("TAX INVOICE", right, 40f, paint(16f, true, Color.WHITE, Paint.Align.RIGHT))
        c.drawText(inv.invoiceNo, right, 57f, paint(9.5f, true, Color.WHITE, Paint.Align.RIGHT))
        c.drawText(fmtDate(inv.date), right, 71f, paint(8.5f, false, Color.parseColor("#C7D9EC"), Paint.Align.RIGHT))

        val badge = inv.status
        val bp = paint(8f, true, Color.WHITE, Paint.Align.RIGHT)
        c.drawText(badge, right, 86f, bp)
        return 116f
    }

    private fun drawParties(c: Canvas, inv: Invoice, biz: BusinessProfile, top: Float): Float {
        val boxH = 84f
        val half = (W - 2 * M - 12f) / 2f

        val fill = Paint().apply { color = ACCENT_LT }
        val stroke = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE; color = LINE; strokeWidth = 0.8f
        }

        c.drawRect(M, top, M + half, top + boxH, fill)
        c.drawRect(M, top, M + half, top + boxH, stroke)
        c.drawText("BILL TO", M + 8, top + 15, paint(7.5f, true, ACCENT))
        c.drawText(inv.customerName.take(34), M + 8, top + 30, paint(10f, true))
        var ly = top + 43
        wrap(inv.customerAddress, 44).take(2).forEach {
            c.drawText(it, M + 8, ly, paint(8f, false, MUTED)); ly += 11
        }
        if (inv.customerPhone.isNotBlank()) {
            c.drawText("Ph: ${inv.customerPhone}", M + 8, ly, paint(8f, false, MUTED)); ly += 11
        }
        if (inv.customerGstin.isNotBlank()) {
            c.drawText("GSTIN: ${inv.customerGstin}", M + 8, ly, paint(8f, true))
        }

        val rx = M + half + 12f
        c.drawRect(rx, top, W - M, top + boxH, fill)
        c.drawRect(rx, top, W - M, top + boxH, stroke)
        c.drawText("INVOICE DETAILS", rx + 8, top + 15, paint(7.5f, true, ACCENT))
        val rows = listOf(
            "Invoice No" to inv.invoiceNo,
            "Date" to fmtDate(inv.date),
            "Due Date" to fmtDate(inv.dueDate),
            "Place of Supply" to inv.placeOfSupply,
            "Payment Mode" to inv.paymentMode
        )
        var ry = top + 29
        rows.forEach { (k, v) ->
            c.drawText(k, rx + 8, ry, paint(8f, false, MUTED))
            c.drawText(v, W - M - 8, ry, paint(8f, true, INK, Paint.Align.RIGHT))
            ry += 11.5f
        }
        return top + boxH + 16f
    }

    // column x positions
    private val colSn = M + 6
    private val colDesc = M + 26
    private val colHsn = 300f
    private val colQty = 350f
    private val colRate = 405f
    private val colGst = 455f
    private val colAmt = W - M - 6

    private fun drawItems(c: Canvas, items: List<InvoiceItem>, inv: Invoice, top: Float): Float {
        val headH = 22f
        c.drawRect(M, top, W - M, top + headH, Paint().apply { color = ACCENT })
        val hp = paint(8f, true, Color.WHITE)
        val hpR = paint(8f, true, Color.WHITE, Paint.Align.RIGHT)
        val ty = top + 14.5f
        c.drawText("#", colSn, ty, hp)
        c.drawText("DESCRIPTION", colDesc, ty, hp)
        c.drawText("HSN", colHsn, ty, hp)
        c.drawText("QTY", colQty + 22, ty, hpR)
        c.drawText("RATE", colRate + 40, ty, hpR)
        c.drawText("GST", colGst + 30, ty, hpR)
        c.drawText("AMOUNT", colAmt, ty, hpR)

        var y = top + headH
        val stroke = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE; color = LINE; strokeWidth = 0.7f
        }

        items.forEachIndexed { i, it ->
            val serialLines = if (it.serials.isBlank()) 0 else wrap("S/N: ${it.serials}", 52).size
            val rowH = 20f + serialLines * 9f
            if (i % 2 == 1) {
                c.drawRect(M, y, W - M, y + rowH, Paint().apply { color = Color.parseColor("#F7F9FC") })
            }
            val by = y + 13f
            c.drawText("${i + 1}", colSn, by, paint(8f))
            c.drawText(it.name.take(40), colDesc, by, paint(8.5f, true))
            c.drawText(it.hsn, colHsn, by, paint(8f, false, MUTED))
            c.drawText(trimNum(it.qty) + " " + it.unit, colQty + 22, by, paint(8f, false, INK, Paint.Align.RIGHT))
            c.drawText(inr(it.rate), colRate + 40, by, paint(8f, false, INK, Paint.Align.RIGHT))
            c.drawText("${trimNum(it.gstRate)}%", colGst + 30, by, paint(8f, false, INK, Paint.Align.RIGHT))
            c.drawText(inr(it.lineTotal), colAmt, by, paint(8.5f, true, INK, Paint.Align.RIGHT))

            var sy = by + 10f
            if (it.serials.isNotBlank()) {
                wrap("S/N: ${it.serials}", 52).forEach { line ->
                    c.drawText(line, colDesc, sy, paint(7f, false, MUTED)); sy += 9f
                }
            }
            if (it.warrantyMonths > 0) {
                c.drawText(
                    "Warranty: ${it.warrantyMonths} months",
                    colHsn - 60, by + 10f, paint(7f, false, ACCENT)
                )
            }
            y += rowH
            c.drawLine(M, y, W - M, y, stroke)
        }

        c.drawRect(M, top, W - M, y, stroke)
        return y + 14f
    }

    private fun drawTotals(c: Canvas, inv: Invoice, items: List<InvoiceItem>, top: Float): Float {
        val boxW = 210f
        val x = W - M - boxW
        var y = top

        fun row(label: String, value: String, bold: Boolean = false, color: Int = INK) {
            c.drawText(label, x + 8, y, paint(8.5f, bold, if (bold) color else MUTED))
            c.drawText(value, W - M - 8, y, paint(8.5f, bold, color, Paint.Align.RIGHT))
            y += 14f
        }

        y += 6f
        row("Taxable Value", inr(inv.taxableValue))
        if (inv.discount > 0) row("Discount", "- " + inr(inv.discount))
        if (inv.interState) {
            row("IGST", inr(inv.igst))
        } else {
            row("CGST", inr(inv.cgst))
            row("SGST", inr(inv.sgst))
        }
        if (inv.exchangeDeduction > 0) row("Old Battery Exchange", "- " + inr(inv.exchangeDeduction))
        if (inv.roundOff != 0.0) row("Round Off", inr(inv.roundOff))

        y += 2f
        c.drawRect(x, y - 4, W - M, y + 22, Paint().apply { color = ACCENT })
        c.drawText("GRAND TOTAL", x + 8, y + 12, paint(10f, true, Color.WHITE))
        c.drawText(inr(inv.grandTotal), W - M - 8, y + 12, paint(11f, true, Color.WHITE, Paint.Align.RIGHT))
        y += 30f

        if (inv.paidAmount > 0) {
            row("Paid", inr(inv.paidAmount), true, Color.parseColor("#1B7F4B"))
            val bal = inv.grandTotal - inv.paidAmount
            if (bal > 0.01) row("Balance Due", inr(bal), true, Color.parseColor("#B3261E"))
        }

        // amount in words on the left
        val wordsTop = top + 6
        c.drawText("Amount in Words", M, wordsTop, paint(7.5f, true, ACCENT))
        var wy = wordsTop + 13
        wrap(amountInWords(inv.grandTotal), 40).forEach {
            c.drawText(it, M, wy, paint(8f, true)); wy += 11
        }

        // HSN tax summary
        wy += 8
        c.drawText("HSN / Tax Summary", M, wy, paint(7.5f, true, ACCENT)); wy += 12
        items.groupBy { it.hsn }.forEach { (hsn, group) ->
            val tax = group.sumOf { it.cgst + it.sgst + it.igst }
            val taxable = group.sumOf { it.taxable }
            c.drawText(
                "HSN $hsn  •  Taxable ${inr(taxable)}  •  Tax ${inr(tax)}",
                M, wy, paint(7.5f, false, MUTED)
            )
            wy += 10
        }

        return maxOf(y, wy) + 8f
    }

    private fun drawFooter(c: Canvas, biz: BusinessProfile, inv: Invoice, top: Float) {
        var y = maxOf(top, 640f)
        val stroke = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE; color = LINE; strokeWidth = 0.8f
        }

        // bank + UPI block
        c.drawRect(M, y, M + 250f, y + 62f, Paint().apply { color = ACCENT_LT })
        c.drawRect(M, y, M + 250f, y + 62f, stroke)
        c.drawText("PAYMENT DETAILS", M + 8, y + 14, paint(7.5f, true, ACCENT))
        c.drawText("${biz.bankName}", M + 8, y + 27, paint(8f))
        c.drawText("A/C: ${biz.accountNo}   IFSC: ${biz.ifsc}", M + 8, y + 39, paint(8f, false, MUTED))
        c.drawText("UPI: ${biz.upiId}", M + 8, y + 51, paint(8f, true, ACCENT))

        // signature
        val sx = W - M - 170f
        c.drawText("For ${biz.name}".take(34), sx, y + 14, paint(8.5f, true))
        c.drawLine(sx, y + 52, W - M, y + 52, stroke)
        c.drawText(biz.signatory, W - M, y + 62, paint(8f, false, MUTED, Paint.Align.RIGHT))

        y += 74f
        c.drawText("Terms & Conditions", M, y, paint(7.5f, true, ACCENT))
        y += 11
        biz.terms.split("\n").take(4).forEach {
            c.drawText(it.take(110), M, y, paint(7f, false, MUTED)); y += 9.5f
        }

        c.drawText(
            "This is a computer generated invoice.  •  Generated by VoltBill Pro",
            W / 2f, H - 22f, paint(7f, false, MUTED, Paint.Align.CENTER)
        )
    }

    private fun trimNum(v: Double): String =
        if (v == v.toLong().toDouble()) v.toLong().toString() else String.format("%.2f", v)

    private fun wrap(text: String, chars: Int): List<String> {
        if (text.isBlank()) return emptyList()
        val out = mutableListOf<String>()
        var line = StringBuilder()
        text.split(" ").forEach { w ->
            if (line.length + w.length + 1 > chars) {
                out += line.toString().trim(); line = StringBuilder()
            }
            line.append(w).append(' ')
        }
        if (line.isNotBlank()) out += line.toString().trim()
        return out
    }

    /** Opens the OS share sheet (WhatsApp, Gmail, Drive...) for a generated file. */
    fun share(context: Context, file: File, subject: String) {
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "application/pdf"
            putExtra(Intent.EXTRA_STREAM, uri)
            putExtra(Intent.EXTRA_SUBJECT, subject)
            putExtra(Intent.EXTRA_TEXT, "Please find attached: $subject")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        context.startActivity(Intent.createChooser(intent, "Share invoice").apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        })
    }
}
