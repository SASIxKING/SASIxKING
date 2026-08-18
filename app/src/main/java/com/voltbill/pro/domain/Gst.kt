package com.voltbill.pro.domain

import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import kotlin.math.abs
import kotlin.math.roundToLong

/** Rounds to 2 decimals the way accounting expects (half-up). */
fun money(v: Double): Double = (v * 100.0).roundToLong() / 100.0

/** ₹1,23,456.78 — Indian digit grouping. */
fun inr(v: Double): String {
    val neg = v < 0
    val a = abs(money(v))
    val whole = a.toLong()
    val paise = ((a - whole) * 100).roundToLong().toInt()
    val s = whole.toString()
    val grouped = if (s.length <= 3) s else {
        val last3 = s.substring(s.length - 3)
        var rest = s.substring(0, s.length - 3)
        val sb = StringBuilder()
        while (rest.length > 2) {
            sb.insert(0, "," + rest.substring(rest.length - 2))
            rest = rest.substring(0, rest.length - 2)
        }
        if (rest.isNotEmpty()) sb.insert(0, rest)
        "$sb,$last3"
    }
    return (if (neg) "-₹" else "₹") + grouped + "." + paise.toString().padStart(2, '0')
}

/** Result of costing a single invoice line. */
data class LineTax(
    val taxable: Double,
    val cgst: Double,
    val sgst: Double,
    val igst: Double,
    val total: Double
)

/**
 * Computes one line: qty × rate, less line discount %, then GST split.
 * Intra-state -> CGST+SGST (half each). Inter-state -> IGST.
 */
fun computeLine(
    qty: Double,
    rate: Double,
    discountPct: Double,
    gstRate: Double,
    interState: Boolean
): LineTax {
    val gross = qty * rate
    val taxable = money(gross - gross * (discountPct / 100.0))
    val tax = money(taxable * gstRate / 100.0)
    return if (interState) {
        LineTax(taxable, 0.0, 0.0, tax, money(taxable + tax))
    } else {
        val half = money(tax / 2.0)
        LineTax(taxable, half, half, 0.0, money(taxable + half * 2))
    }
}

data class InvoiceTotals(
    val subTotal: Double,
    val taxable: Double,
    val cgst: Double,
    val sgst: Double,
    val igst: Double,
    val exchange: Double,
    val roundOff: Double,
    val grandTotal: Double
) {
    val totalTax: Double get() = money(cgst + sgst + igst)
}

/** Aggregates lines, applies old-battery exchange deduction and round-off. */
fun computeTotals(lines: List<LineTax>, grossBeforeDiscount: Double, exchange: Double): InvoiceTotals {
    val taxable = money(lines.sumOf { it.taxable })
    val cgst = money(lines.sumOf { it.cgst })
    val sgst = money(lines.sumOf { it.sgst })
    val igst = money(lines.sumOf { it.igst })
    val beforeRound = money(taxable + cgst + sgst + igst - exchange)
    val rounded = Math.round(beforeRound).toDouble()
    return InvoiceTotals(
        subTotal = money(grossBeforeDiscount),
        taxable = taxable,
        cgst = cgst, sgst = sgst, igst = igst,
        exchange = money(exchange),
        roundOff = money(rounded - beforeRound),
        grandTotal = rounded
    )
}

/** "Rupees One Lakh Twenty Three Thousand Four Hundred Fifty Six and Seventy Eight Paise Only" */
fun amountInWords(amount: Double): String {
    val a = money(abs(amount))
    val rupees = a.toLong()
    val paise = ((a - rupees) * 100).roundToLong()
    val sb = StringBuilder("Rupees ").append(wordsFor(rupees))
    if (paise > 0) sb.append(" and ").append(wordsFor(paise)).append(" Paise")
    return sb.append(" Only").toString()
}

private val ones = arrayOf(
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen",
    "Eighteen", "Nineteen"
)
private val tens = arrayOf("", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety")

private fun twoDigits(n: Int): String = when {
    n == 0 -> ""
    n < 20 -> ones[n]
    else -> (tens[n / 10] + if (n % 10 != 0) " " + ones[n % 10] else "")
}

private fun threeDigits(n: Int): String {
    val h = n / 100
    val r = n % 100
    val sb = StringBuilder()
    if (h > 0) sb.append(ones[h]).append(" Hundred")
    if (r > 0) { if (h > 0) sb.append(" "); sb.append(twoDigits(r)) }
    return sb.toString()
}

/** Indian numbering: crore, lakh, thousand, hundred. */
fun wordsFor(value: Long): String {
    if (value == 0L) return "Zero"
    var n = value
    val parts = mutableListOf<String>()
    val crore = (n / 10_000_000L).toInt(); n %= 10_000_000L
    val lakh = (n / 100_000L).toInt(); n %= 100_000L
    val thousand = (n / 1_000L).toInt(); n %= 1_000L
    val rest = n.toInt()
    if (crore > 0) parts += threeDigits(crore) + " Crore"
    if (lakh > 0) parts += twoDigits(lakh) + " Lakh"
    if (thousand > 0) parts += twoDigits(thousand) + " Thousand"
    if (rest > 0) parts += threeDigits(rest)
    return parts.joinToString(" ")
}

// ---------- dates ----------

private val dmy = SimpleDateFormat("dd MMM yyyy", Locale.ENGLISH)
private val dmyShort = SimpleDateFormat("dd/MM/yy", Locale.ENGLISH)
private val full = SimpleDateFormat("dd MMM yyyy, hh:mm a", Locale.ENGLISH)

fun fmtDate(ts: Long): String = dmy.format(Date(ts))
fun fmtShort(ts: Long): String = dmyShort.format(Date(ts))
fun fmtDateTime(ts: Long): String = full.format(Date(ts))

fun addMonths(ts: Long, months: Int): Long = Calendar.getInstance().apply {
    timeInMillis = ts
    add(Calendar.MONTH, months)
}.timeInMillis

fun startOfDay(ts: Long = System.currentTimeMillis()): Long = Calendar.getInstance().apply {
    timeInMillis = ts
    set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0)
    set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
}.timeInMillis

fun endOfDay(ts: Long = System.currentTimeMillis()): Long = startOfDay(ts) + 86_399_999L

fun startOfMonth(ts: Long = System.currentTimeMillis()): Long = Calendar.getInstance().apply {
    timeInMillis = startOfDay(ts)
    set(Calendar.DAY_OF_MONTH, 1)
}.timeInMillis

fun endOfMonth(ts: Long = System.currentTimeMillis()): Long = Calendar.getInstance().apply {
    timeInMillis = startOfMonth(ts)
    add(Calendar.MONTH, 1)
}.timeInMillis - 1

/** Indian financial year start (April 1). */
fun startOfFinancialYear(ts: Long = System.currentTimeMillis()): Long {
    val c = Calendar.getInstance().apply { timeInMillis = startOfDay(ts) }
    val year = if (c.get(Calendar.MONTH) < Calendar.APRIL) c.get(Calendar.YEAR) - 1 else c.get(Calendar.YEAR)
    return Calendar.getInstance().apply {
        timeInMillis = 0
        set(year, Calendar.APRIL, 1, 0, 0, 0)
        set(Calendar.MILLISECOND, 0)
    }.timeInMillis
}

fun daysBetween(a: Long, b: Long): Int = ((b - a) / 86_400_000L).toInt()

/** VB/2025-26/0001 -> next serial in the current financial year. */
fun nextInvoiceNo(last: String?, prefix: String): String {
    val c = Calendar.getInstance()
    val y = if (c.get(Calendar.MONTH) < Calendar.APRIL) c.get(Calendar.YEAR) - 1 else c.get(Calendar.YEAR)
    val fy = "$y-${((y + 1) % 100).toString().padStart(2, '0')}"
    val seq = last?.substringAfterLast('/')?.toIntOrNull()?.plus(1) ?: 1
    return "$prefix/$fy/${seq.toString().padStart(4, '0')}"
}
